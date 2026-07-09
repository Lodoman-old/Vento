import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authenticate, authorize, checkEventAccess } from "../middleware/auth.js";
import { eventRules } from "../middleware/validate.js";
import { query } from "../services/db.js";
import { notifyStaff } from "../services/notifications.js";

// Agenda por defecto cuando el evento se activa
const DEFAULT_AGENDA = [
  { title: "Decoración general del salón", description: "Globos, letreros, cortinas y ambientación", category: "decoracion", hoursFromBase: -1 },
  { title: "Montaje de mesas", description: "Colocar y alinear todas las mesas según el plano del evento", category: "logistica", hoursFromBase: 1 },
  { title: "Montaje de sillas", description: "Colocar sillas en cada mesa según el número de invitados", category: "logistica", hoursFromBase: 2 },
  { title: "Colocación de mantelería", description: "Poner manteles, cubremanteles y servilletas", category: "logistica", hoursFromBase: 3 },
  { title: "Montaje de vajilla y cubiertos", description: "Colocar platos, cubiertos y copas en cada lugar", category: "logistica", hoursFromBase: 3 },
  { title: "Centros de mesa y decoración", description: "Colocar centros de mesa, velas y adornos", category: "decoracion", hoursFromBase: 3 },
  { title: "Señalética y bienvenida", description: "Colocar letreros de bienvenida, mesas y direccionales", category: "logistica", hoursFromBase: 3.5 },
  { title: "Revisión general", description: "Recorrido final para verificar que todo esté listo", category: "logistica", hoursFromBase: 4 },
];

async function generateDefaultAgenda(eventId, eventDate) {
  // Only generate if no agenda items exist yet
  const { rows: existing } = await query("SELECT COUNT(*)::int AS count FROM agenda_items WHERE event_id = $1", [eventId]);
  if (existing[0].count > 0) return;

  const baseTime = new Date(eventDate);
  // Start setup 4 hours before event
  baseTime.setHours(baseTime.getHours() - 4);

  for (let i = 0; i < DEFAULT_AGENDA.length; i++) {
    const item = DEFAULT_AGENDA[i];
    const startTime = new Date(baseTime.getTime() + item.hoursFromBase * 60 * 60 * 1000);
    await query(
      `INSERT INTO agenda_items (event_id, title, description, start_time, category, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [eventId, item.title, item.description, startTime.toISOString(), item.category, i]
    );
  }
}

const router = Router();

router.use(authenticate);

// GET /api/events?page=&limit=
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    let baseSql, countSql, params, countParams;

    if (req.user.role === "administrador") {
      baseSql = "SELECT * FROM events ORDER BY date DESC LIMIT $1 OFFSET $2";
      countSql = "SELECT COUNT(*)::int AS total FROM events";
      params = [limit, offset];
      countParams = [];
    } else if (req.user.role === "cliente") {
      baseSql = "SELECT * FROM events WHERE client_id = $1 ORDER BY date DESC LIMIT $2 OFFSET $3";
      countSql = "SELECT COUNT(*)::int AS total FROM events WHERE client_id = $1";
      params = [req.user.id, limit, offset];
      countParams = [req.user.id];
    } else {
      baseSql = `SELECT e.* FROM events e
                 JOIN event_staff es ON es.event_id = e.id
                 WHERE es.user_id = $1
                 ORDER BY e.date DESC LIMIT $2 OFFSET $3`;
      countSql = `SELECT COUNT(*)::int AS total FROM events e
                  JOIN event_staff es ON es.event_id = e.id
                  WHERE es.user_id = $1`;
      params = [req.user.id, limit, offset];
      countParams = [req.user.id];
    }

    const [data, countResult] = await Promise.all([
      query(baseSql, params),
      query(countSql, countParams),
    ]);

    res.json({
      data: data.rows,
      total: countResult.rows[0].total,
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/calendar?year=&month= — eventos agrupados por dia del mes
router.get("/calendar", async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

    const isAdmin = req.user.role === "administrador";
    let sql, params;
    if (isAdmin) {
      sql = `SELECT id, name, date, status, venue, TO_CHAR(date, 'YYYY-MM-DD') AS day FROM events
             WHERE date::date >= $1 AND date::date <= $2
             ORDER BY date`;
      params = [start, end];
    } else {
      sql = `SELECT e.id, e.name, e.date, e.status, e.venue, TO_CHAR(e.date, 'YYYY-MM-DD') AS day FROM events e
             JOIN event_staff es ON es.event_id = e.id
             WHERE es.user_id = $1 AND e.date::date >= $2 AND e.date::date <= $3
             ORDER BY e.date`;
      params = [req.user.id, start, end];
    }

    const { rows } = await query(sql, params);
    const byDate = {};
    rows.forEach((r) => {
      if (!byDate[r.day]) byDate[r.day] = [];
      byDate[r.day].push({ id: r.id, name: r.name, date: r.date, status: r.status, venue: r.venue });
    });
    res.json({ year, month, days: byDate, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id
router.get("/:id", checkEventAccess, async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM events WHERE id = $1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Evento no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events
router.post("/", authorize("administrador"), ...eventRules, async (req, res) => {
  try {
    const name = req.body.name;
    const description = req.body.description;
    const date = req.body.date;
    const venue = req.body.venue;
    const totalBudget = req.body.total_budget ?? req.body.totalBudget;
    const clientId = req.body.client_id || req.body.clientId;
    const status = req.body.status || "borrador";
    const { rows } = await query(
      `INSERT INTO events (name, description, date, venue, total_budget, client_id, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, description, date, venue, totalBudget || 0, clientId, req.user.id, status]
    );
    if (status === "activo") {
      await generateDefaultAgenda(rows[0].id, date);
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/events/:id
router.put("/:id", authorize("administrador"), async (req, res) => {
  try {
    const { rows: old } = await query("SELECT status, name, date FROM events WHERE id = $1", [req.params.id]);
    if (old.length === 0) return res.status(404).json({ error: "Evento no encontrado" });

    const sets = [];
    const params = [];
    let idx = 1;

    if (req.body.name !== undefined) { sets.push(`name=$${idx++}`); params.push(req.body.name); }
    if (req.body.description !== undefined) { sets.push(`description=$${idx++}`); params.push(req.body.description); }
    if (req.body.date !== undefined) { sets.push(`date=$${idx++}`); params.push(req.body.date); }
    if (req.body.venue !== undefined) { sets.push(`venue=$${idx++}`); params.push(req.body.venue); }
    if (req.body.total_budget !== undefined || req.body.totalBudget !== undefined) {
      sets.push(`total_budget=$${idx++}`);
      params.push(req.body.total_budget ?? req.body.totalBudget);
    }
    if (req.body.status !== undefined) { sets.push(`status=$${idx++}`); params.push(req.body.status); }

    if (sets.length === 0) return res.status(400).json({ error: "Nada que actualizar" });

    sets.push("updated_at=NOW()");
    params.push(req.params.id);

    const { rows } = await query(
      `UPDATE events SET ${sets.join(", ")} WHERE id=$${idx} RETURNING *`,
      params
    );

    const newStatus = req.body.status;
    if (old.length > 0 && old[0].status !== newStatus) {
      await notifyStaff({
        eventId: req.params.id,
        title: "Estado del evento cambiado",
        body: `"${old[0].name}" cambió de "${old[0].status}" a "${newStatus}"`,
        type: "evento",
      });

      if (newStatus === "activo") {
        const eventDate = req.body.date || old[0].date;
        await generateDefaultAgenda(req.params.id, eventDate);
      }
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/events/:id
router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    await query("DELETE FROM events WHERE id = $1", [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id/staff — staff asignado al evento
router.get("/:id/staff", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.display_name, u.email, u.role, u.phone FROM users u
       JOIN event_staff es ON es.user_id = u.id
       WHERE es.event_id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id/available-staff — usuarios staff NO asignados
router.get("/:id/available-staff", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, display_name, email, phone FROM users
       WHERE role = 'staff' AND is_active = true
       AND id NOT IN (SELECT user_id FROM event_staff WHERE event_id = $1)`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/staff — asignar staff al evento
router.post("/:id/staff", authorize("administrador"), async (req, res) => {
  try {
    const userId = req.body.user_id || req.body.userId;
    await query(
      "INSERT INTO event_staff (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.params.id, userId]
    );
    res.status(201).json({ assigned: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/events/:id/staff/:userId — remover staff del evento
router.delete("/:id/staff/:userId", authorize("administrador"), async (req, res) => {
  try {
    await query(
      "DELETE FROM event_staff WHERE event_id = $1 AND user_id = $2",
      [req.params.id, req.params.userId]
    );
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id/client-access — obtener acceso cliente del evento
router.get("/:id/client-access", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.display_name, u.username, u.role, u.is_active, u.expires_at
       FROM users u JOIN events e ON e.client_id = u.id
       WHERE e.id = $1 AND u.role = 'cliente'`,
      [req.params.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/client-access — crear acceso cliente
router.post("/:id/client-access", authorize("administrador"), async (req, res) => {
  try {
    const { rows: evt } = await query("SELECT date FROM events WHERE id = $1", [req.params.id]);
    if (evt.length === 0) return res.status(404).json({ error: "Evento no encontrado" });

    const eventDate = evt[0].date;
    const dayStr = typeof eventDate === "string" ? eventDate.slice(0, 10) : new Date(eventDate).toISOString().slice(0, 10);
    const username = `cliente_${dayStr.replace(/-/g, "")}`;
    const password = crypto.randomUUID().slice(0, 10);
    const hash = await bcrypt.hash(password, 10);
    const expiresAt = new Date(eventDate);
    expiresAt.setDate(expiresAt.getDate() + 1);

    const { rows: user } = await query(
      `INSERT INTO users (display_name, username, password_hash, role, expires_at)
       VALUES ($1, $2, $3, 'cliente', $4)
       ON CONFLICT (username) DO UPDATE SET password_hash = $3, expires_at = $4, is_active = true
       RETURNING id`,
      [`Cliente ${dayStr}`, username, hash, expiresAt]
    );

    await query("UPDATE events SET client_id = $1 WHERE id = $2", [user[0].id, req.params.id]);

    await notifyStaff({ eventId: req.params.id, title: "Acceso cliente creado", body: "Se generó acceso para el cliente del evento", type: "cliente" });

    res.status(201).json({ username, password, expiresAt, userId: user[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/events/:id/client-access — revocar acceso cliente
router.delete("/:id/client-access", authorize("administrador"), async (req, res) => {
  try {
    const { rows: evt } = await query("SELECT client_id FROM events WHERE id = $1", [req.params.id]);
    if (evt.length === 0 || !evt[0].client_id) return res.status(404).json({ error: "Sin acceso cliente" });

    await query("UPDATE users SET is_active = false WHERE id = $1", [evt[0].client_id]);
    await query("UPDATE events SET client_id = NULL WHERE id = $1", [req.params.id]);

    await notifyStaff({ eventId: req.params.id, title: "Acceso cliente revocado", body: "Se revocó el acceso del cliente al evento", type: "cliente" });
    res.json({ revoked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/reset-client-password — regenerar contraseña del cliente
router.post("/:id/reset-client-password", authorize("administrador"), async (req, res) => {
  try {
    const { rows: evt } = await query("SELECT client_id, date FROM events WHERE id = $1", [req.params.id]);
    if (evt.length === 0 || !evt[0].client_id) return res.status(404).json({ error: "Sin acceso cliente" });

    const password = crypto.randomUUID().slice(0, 10);
    const hash = await bcrypt.hash(password, 10);
    const eventDate = evt[0].date;
    const expiresAt = new Date(eventDate);
    expiresAt.setDate(expiresAt.getDate() + 1);

    await query(
      "UPDATE users SET password_hash = $1, expires_at = $2, is_active = true WHERE id = $3",
      [hash, expiresAt, evt[0].client_id]
    );

    const { rows: user } = await query("SELECT username FROM users WHERE id = $1", [evt[0].client_id]);
    res.json({ username: user[0]?.username, password, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id/inventory — calcula el inventario necesario desde la cotización aceptada
router.get("/:id/inventory", async (req, res) => {
  try {
    const { rows: quotes } = await query(
      "SELECT id FROM quotes WHERE event_id = $1 AND status = 'aceptado' ORDER BY created_at DESC LIMIT 1",
      [req.params.id]
    );
    if (quotes.length === 0) return res.json([]);

    const { rows: items } = await query(
      "SELECT item_name, quantity, needs_return FROM quote_items WHERE quote_id = $1 AND is_supplier_cost = false ORDER BY id",
      [quotes[0].id]
    );

    const { rows: movements } = await query(
      "SELECT item_name, quantity, movement_type FROM inventory_movements WHERE event_id = $1",
      [req.params.id]
    );

    function getMovements(itemName, type) {
      return movements
        .filter(m => m.movement_type === type && m.item_name.toLowerCase() === itemName.toLowerCase())
        .reduce((s, m) => s + Number(m.quantity), 0);
    }

    const inventory = items.map(i => ({
      name: i.item_name,
      quantity: Number(i.quantity),
      needs_return: i.needs_return,
      llevado: getMovements(i.item_name, 'llevado') - getMovements(i.item_name, 'regresado'),
    }));

    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/inventory-movement — registrar llevado/regresado
router.post("/:id/inventory-movement", async (req, res) => {
  try {
    const { item_name, quantity, movement_type } = req.body;
    if (!item_name || !quantity || !['llevado', 'regresado'].includes(movement_type)) {
      return res.status(400).json({ error: "item_name, quantity y movement_type (llevado/regresado) requeridos" });
    }
    const { rows } = await query(
      `INSERT INTO inventory_movements (event_id, item_name, quantity, movement_type, moved_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, item_name, quantity, movement_type, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
