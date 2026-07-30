import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDb, query } from "./services/db.js";
import { setupRedis } from "./services/redis.js";
import { setupSocketEvents } from "./socket.js";
import { authenticate, authorize } from "./middleware/auth.js";
import { notifyAdmins } from "./services/notifications.js";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import agendaRoutes from "./routes/agenda.js";
import supplierRoutes from "./routes/suppliers.js";
import supplierCatalogRoutes from "./routes/supplierCatalog.js";
import catalogRoutes from "./routes/catalog.js";
import quoteRoutes from "./routes/quotes.js";
import settingsRoutes from "./routes/settings.js";
import uploadRoutes from "./routes/upload.js";
import notificationRoutes from "./routes/notifications.js";
import userRoutes from "./routes/users.js";
import checklistRoutes from "./routes/checklist.js";
import paymentRoutes from "./routes/payments.js";
import templateRoutes from "./routes/templates.js";
import reportRoutes from "./routes/reports.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || "*" },
});

app.use(cors());
app.use(express.json());
// app.use("/uploads", express.static("uploads")); // removido — ahora se usa Cloudinary

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public Firebase client config endpoint (no auth required)
app.get("/api/firebase-config", async (req, res) => {
  try {
    const { rows } = await query("SELECT firebase_config FROM company_settings LIMIT 1");
    const cfg = rows[0]?.firebase_config || {};
    const { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId } = cfg;
    if (!apiKey || !projectId) return res.json({ configured: false });
    res.json({ configured: true, apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId });
  } catch (err) {
    res.json({ configured: false });
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/agenda", agendaRoutes);
app.use("/api/supplier-catalog", supplierCatalogRoutes);
app.use("/api/event-suppliers", supplierRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/checklist", checklistRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/reports", reportRoutes);

// Quote-items endpoints (edit/delete items from a quote)
app.put("/api/quote-items/:id", authenticate, authorize("administrador"), async (req, res) => {
  try {
    const { item_name, quantity, unit_price } = req.body;
    const { rows } = await query(
      `UPDATE quote_items SET item_name = COALESCE($1, item_name), quantity = COALESCE($2, quantity), unit_price = COALESCE($3, unit_price)
       WHERE id = $4 RETURNING *`,
      [item_name || null, quantity || null, unit_price || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Item no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/quote-items/:id", authenticate, authorize("administrador"), async (req, res) => {
  try {
    const result = await query("DELETE FROM quote_items WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Item no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.io
setupSocketEvents(io);

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDb();
  await setupRedis();

  // Ensure inventory_movements table exists
  await query(`CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    movement_type VARCHAR(20) NOT NULL,
    moved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await query("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS needs_return BOOLEAN DEFAULT false");
  await query("ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS needs_return BOOLEAN DEFAULT false");
  await query("UPDATE catalog_items SET needs_return = true WHERE LOWER(category) IN ('loza', 'sillas', 'mesas', 'cubiertos') OR LOWER(name) IN ('loza', 'sillas', 'mesas', 'cubiertos') OR LOWER(category) LIKE '%loza%' OR LOWER(category) LIKE '%silla%' OR LOWER(category) LIKE '%mesa%' OR LOWER(category) LIKE '%cubiert%'");
  await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0");
  await query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS applied_to UUID REFERENCES payments(id)");

  // Event templates table
  await query(`CREATE TABLE IF NOT EXISTS event_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_type   VARCHAR(20) NOT NULL CHECK (template_type IN ('agenda', 'checklist')),
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    category        VARCHAR(50) DEFAULT 'logistica',
    hours_from_base DECIMAL(5,2),
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`);
  await query("CREATE INDEX IF NOT EXISTS idx_event_templates_type ON event_templates(template_type)");

  // Advanced config columns
  await query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS db_config JSONB DEFAULT '{}'::jsonb");
  await query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS firebase_config JSONB DEFAULT '{}'::jsonb");
  await query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS storage_config JSONB DEFAULT '{}'::jsonb");

  // Seed default templates if empty
  const { rows: tplCount } = await query("SELECT COUNT(*)::int AS count FROM event_templates");
  if (tplCount[0].count === 0) {
    const agendaTemplates = [
      { title: "Decoración general del salón", description: "Globos, letreros, cortinas y ambientación", category: "decoracion", hoursFromBase: -1 },
      { title: "Montaje de mesas", description: "Colocar y alinear todas las mesas según el plano del evento", category: "logistica", hoursFromBase: 1 },
      { title: "Montaje de sillas", description: "Colocar sillas en cada mesa según el número de invitados", category: "logistica", hoursFromBase: 2 },
      { title: "Colocación de mantelería", description: "Poner manteles, cubremanteles y servilletas", category: "logistica", hoursFromBase: 3 },
      { title: "Montaje de vajilla y cubiertos", description: "Colocar platos, cubiertos y copas en cada lugar", category: "logistica", hoursFromBase: 3 },
      { title: "Centros de mesa y decoración", description: "Colocar centros de mesa, velas y adornos", category: "decoracion", hoursFromBase: 3 },
      { title: "Señalética y bienvenida", description: "Colocar letreros de bienvenida, mesas y direccionales", category: "logistica", hoursFromBase: 3.5 },
      { title: "Revisión general", description: "Recorrido final para verificar que todo esté listo", category: "logistica", hoursFromBase: 4 },
    ];
    const checklistTemplates = [
      "Cinchos para mesas", "Mecate / Cuerda", "Rafia", "Martillo", "Pistola de silicon y barras",
      "Tijeras", "Cinta adhesiva transparente", "Cinta masking tape", "Desarmadores", "Nivel de burbuja",
      "Extensión eléctrica", "Focos / Bombillas extra", "Linterna", "Kit de primeros auxilios", "Botiquín de costura",
    ];
    for (let i = 0; i < agendaTemplates.length; i++) {
      const t = agendaTemplates[i];
      await query(
        "INSERT INTO event_templates (template_type, title, description, category, hours_from_base, sort_order) VALUES ('agenda', $1, $2, $3, $4, $5)",
        [t.title, t.description, t.category, t.hoursFromBase, i]
      );
    }
    for (let i = 0; i < checklistTemplates.length; i++) {
      await query(
        "INSERT INTO event_templates (template_type, title, sort_order) VALUES ('checklist', $1, $2)",
        [checklistTemplates[i], i]
      );
    }
    console.log("[db] plantillas por defecto insertadas");
  }

  // CRON: Payment reminders — check every hour for payments due in next 24h
  setInterval(async () => {
    try {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const { rows: duePayments } = await query(
        `SELECT p.id, p.amount, p.payment_date, p.notes, q.client_name, q.event_id, e.name AS event_name
         FROM payments p
         JOIN quotes q ON q.id = p.quote_id
         JOIN events e ON e.id = q.event_id
         WHERE p.method IN ('enganche', 'mensualidad')
           AND (p.paid_amount IS NULL OR p.paid_amount < p.amount)
           AND p.payment_date BETWEEN $1 AND $2`,
        [today, tomorrow]
      );
      for (const p of duePayments) {
        await notifyAdmins({
          eventId: p.event_id,
          title: "Recordatorio de pago",
          body: `${p.client_name || "Cliente"} — $${Number(p.amount).toLocaleString()} (${p.notes || "Cuota"}) vence el ${new Date(p.payment_date).toLocaleDateString("es-MX")}`,
          type: "general",
        });
      }
    } catch (e) { console.error("[cron] error recordatorio pagos:", e.message); }
  }, 3600000);

  httpServer.listen(PORT, () => {
    console.log(`[vento-api] corriendo en http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("[vento-api] error fatal en start():", err);
  process.exit(1);
});
