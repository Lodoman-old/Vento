import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { catalogRules } from "../middleware/validate.js";
import { query } from "../services/db.js";

const router = Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const { category, showAll } = req.query;
    let sql = "SELECT * FROM catalog_items";
    const params = [];
    const conds = [];

    if (showAll !== "true") {
      conds.push("is_active = true");
    }

    if (category) {
      conds.push("category = $" + (params.length + 1));
      params.push(category);
    }

    if (conds.length) sql += " WHERE " + conds.join(" AND ");
    sql += " ORDER BY is_active DESC, category, name";
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const showAll = req.query.showAll === "true";
    const sql = showAll
      ? "SELECT DISTINCT category FROM catalog_items ORDER BY category"
      : "SELECT DISTINCT category FROM catalog_items WHERE is_active = true ORDER BY category";
    const { rows } = await query(sql);
    res.json(rows.map((r) => r.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authorize("administrador"), ...catalogRules, async (req, res) => {
  try {
    const { name, category, unitPrice, unitType, description, stockAvailable, imageUrl } = req.body;
    const { rows } = await query(
      `INSERT INTO catalog_items (name, category, unit_price, unit_type, description, stock_available, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, category, unitPrice, unitType, description, stockAvailable, imageUrl]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", authorize("administrador"), async (req, res) => {
  try {
    const allowed = ["name", "category", "unit_price", "unit_type", "description", "stock_available", "is_active", "image_url"];
    const fieldMap = { name: "name", category: "category", unitPrice: "unit_price", unitType: "unit_type", description: "description", stockAvailable: "stock_available", isActive: "is_active", imageUrl: "image_url" };
    const sets = [];
    const params = [];
    let idx = 1;
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (req.body[camel] !== undefined) {
        sets.push(`${snake}=$${idx++}`);
        params.push(req.body[camel]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: "No hay campos para actualizar" });
    params.push(req.params.id);
    const sql = `UPDATE catalog_items SET ${sets.join(", ")} WHERE id=$${idx} RETURNING *`;
    const { rows } = await query(sql, params);
    if (rows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
