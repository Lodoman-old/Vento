import { Router } from "express";
import { authenticate, authorize, checkEventAccess } from "../middleware/auth.js";
import { query } from "../services/db.js";
import { getIO } from "../socket.js";
import { publishToRedis } from "../services/redis.js";
import { notifyAdmins } from "../services/notifications.js";

const router = Router();
router.use(authenticate);

// GET /api/event-suppliers?eventId=
router.get("/", checkEventAccess, async (req, res) => {
  try {
    const eventId = req.query.event_id || req.query.eventId;
    const { rows } = await query(
      `SELECT es.*, sc.name, sc.contact_name, sc.phone, sc.email, sc.category, sc.service_description
       FROM event_suppliers es
       JOIN supplier_catalog sc ON sc.id = es.supplier_id
       WHERE es.event_id = $1
       ORDER BY sc.category, sc.name`,
      [eventId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/event-suppliers — asignar proveedor a evento
router.post("/", authorize("administrador"), async (req, res) => {
  try {
    const eventId = req.body.event_id || req.body.eventId;
    const supplierId = req.body.supplier_id || req.body.supplierId;
    const budgetAmount = req.body.budget_amount ?? req.body.budgetAmount;
    const arrivalTime = req.body.arrival_time ?? req.body.arrivalTime;
    const { rows } = await query(
      `INSERT INTO event_suppliers (event_id, supplier_id, budget_amount, arrival_time)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [eventId, supplierId, budgetAmount || 0, arrivalTime || null]
    );
    const es = rows[0];
    const { rows: catalog } = await query("SELECT * FROM supplier_catalog WHERE id = $1", [supplierId]);

    getIO().to(`event:${eventId}`).emit("supplier:updated", { ...es, ...catalog[0] });

    await notifyAdmins({
      eventId,
      title: "Proveedor asignado",
      body: `Proveedor "${catalog[0].name}" asignado al evento`,
      type: "supplier",
    });
    await publishToRedis("supplier_channel", { event_id: eventId, supplier_id: supplierId, action: "INSERT" });

    res.status(201).json({ ...es, ...catalog[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "El proveedor ya está asignado a este evento" });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/event-suppliers/:id — actualizar estado, llegada, etc.
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    let idx = 1;

    const map = {
      contract_status: "contract_status", contractStatus: "contract_status",
      budget_amount: "budget_amount", budgetAmount: "budget_amount",
      arrival_time: "arrival_time", arrivalTime: "arrival_time",
      actual_arrival_time: "actual_arrival_time", actualArrivalTime: "actual_arrival_time",
      notes: "notes",
    };

    for (const [key, col] of Object.entries(map)) {
      if (req.body[key] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) return res.status(400).json({ error: "Sin campos para actualizar" });

    values.push(id);
    const { rows } = await query(
      `UPDATE event_suppliers SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });

    const es = rows[0];
    const { rows: catalog } = await query("SELECT * FROM supplier_catalog WHERE id = $1", [es.supplier_id]);
    const result = { ...es, ...catalog[0] };

    getIO().to(`event:${es.event_id}`).emit("supplier:updated", result);
    await publishToRedis("supplier_channel", { event_id: es.event_id, supplier_id: es.supplier_id, action: "UPDATE" });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/event-suppliers/:id — quitar proveedor del evento (no borra del catálogo)
router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query("DELETE FROM event_suppliers WHERE id = $1 RETURNING *", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });

    getIO().to(`event:${rows[0].event_id}`).emit("supplier:removed", { id: rows[0].id });
    await publishToRedis("supplier_channel", { event_id: rows[0].event_id, supplier_id: rows[0].supplier_id, action: "DELETE" });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
