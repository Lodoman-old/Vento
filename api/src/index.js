import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDb, query } from "./services/db.js";
import { setupRedis } from "./services/redis.js";
import { setupSocketEvents } from "./socket.js";
import { authenticate, authorize } from "./middleware/auth.js";
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
  httpServer.listen(PORT, () => {
    console.log(`[vento-api] corriendo en http://localhost:${PORT}`);
  });
}

start();
