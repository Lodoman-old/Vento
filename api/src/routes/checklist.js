import { Router } from "express";
import { authenticate, authorize, checkEventAccess } from "../middleware/auth.js";
import { query } from "../services/db.js";
import { notifyAdmins, notifyStaff } from "../services/notifications.js";

const router = Router();
router.use(authenticate);

// GET /api/checklist?eventId=
router.get("/", checkEventAccess, async (req, res) => {
  try {
    const eventId = req.query.event_id || req.query.eventId;
    const { rows } = await query(
      "SELECT * FROM checklist_items WHERE event_id = $1 ORDER BY sort_order, created_at",
      [eventId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/checklist
router.post("/", authorize("administrador"), async (req, res) => {
  try {
    const eventId = req.body.event_id || req.body.eventId;
    const title = req.body.title;
    const { rows } = await query(
      `INSERT INTO checklist_items (event_id, title, sort_order)
       VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM checklist_items WHERE event_id = $1))
       RETURNING *`,
      [eventId, title]
    );
    await notifyStaff({ eventId, title: "Nuevo item en checklist", body: `"${title}" agregado al checklist`, type: "checklist" });
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/checklist/:id
router.patch("/:id", authorize("administrador"), async (req, res) => {
  try {
    const title = req.body.title;
    const isCompleted = req.body.is_completed ?? req.body.isCompleted;
    const sortOrder = req.body.sort_order ?? req.body.sortOrder;
    const fields = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (isCompleted !== undefined) { fields.push(`is_completed = $${idx++}`); values.push(isCompleted); }
    if (sortOrder !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(sortOrder); }
    if (fields.length === 0) return res.status(400).json({ error: "Sin campos" });
    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE checklist_items SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });

    if (isCompleted) {
      await notifyAdmins({ eventId: rows[0].event_id, title: "Checklist completado", body: `"${rows[0].title}" marcado como completado`, type: "checklist" });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/checklist/:id
router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query("DELETE FROM checklist_items WHERE id = $1 RETURNING event_id", [req.params.id]);
    if (rows.length > 0) {
      await notifyAdmins({ eventId: rows[0].event_id, title: "Checklist eliminado", body: "Un item del checklist fue eliminado", type: "checklist" });
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
