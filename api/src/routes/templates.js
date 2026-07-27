import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query } from "../services/db.js";

const router = Router();
router.use(authenticate);

// GET /api/templates?type=agenda|checklist
router.get("/", async (req, res) => {
  try {
    const type = req.query.type;
    let sql = "SELECT * FROM event_templates";
    const params = [];
    if (type) {
      sql += " WHERE template_type = $1";
      params.push(type);
    }
    sql += " ORDER BY sort_order, created_at";
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/templates
router.post("/", authorize("administrador"), async (req, res) => {
  try {
    const { template_type, title, description, category, hours_from_base } = req.body;
    if (!template_type || !title) {
      return res.status(400).json({ error: "template_type y title son requeridos" });
    }
    const { rows: maxOrder } = await query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM event_templates WHERE template_type = $1",
      [template_type]
    );
    const { rows } = await query(
      `INSERT INTO event_templates (template_type, title, description, category, hours_from_base, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [template_type, title, description || null, category || "logistica", hours_from_base ?? null, maxOrder[0].next]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/templates/reorder — reorder all templates of a type
router.put("/reorder/batch", authorize("administrador"), async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: "items array requerido" });
    for (const item of items) {
      await query("UPDATE event_templates SET sort_order = $1 WHERE id = $2", [item.sort_order, item.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/templates/:id
router.put("/:id", authorize("administrador"), async (req, res) => {
  try {
    const { title, description, category, hours_from_base, sort_order, is_active } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); values.push(category); }
    if (hours_from_base !== undefined) { fields.push(`hours_from_base = $${idx++}`); values.push(hours_from_base); }
    if (sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(sort_order); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
    if (fields.length === 0) return res.status(400).json({ error: "Sin campos para actualizar" });
    fields.push("updated_at = NOW()");
    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE event_templates SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: "Plantilla no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/templates/:id
router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    const result = await query("DELETE FROM event_templates WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Plantilla no encontrada" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
