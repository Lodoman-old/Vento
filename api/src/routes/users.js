import { Router } from "express";
import bcrypt from "bcryptjs";
import { authenticate, authorize } from "../middleware/auth.js";
import { query } from "../services/db.js";

const router = Router();

router.use(authenticate);

// GET /api/users
router.get("/", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, display_name, email, phone, role, photo_url, is_active, created_at FROM users ORDER BY display_name"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:id
router.get("/:id", authorize("administrador"), async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, display_name, email, phone, role, photo_url, is_active, created_at FROM users WHERE id = $1",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post("/", authorize("administrador"), async (req, res) => {
  try {
    const displayName = req.body.display_name ?? req.body.displayName;
    const email = req.body.email;
    const password = req.body.password;
    const phone = req.body.phone;
    const role = req.body.role;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (display_name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, display_name, email, phone, role, is_active, created_at`,
      [displayName, email, hash, phone, role || "staff"]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email ya registrado" });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put("/:id", authorize("administrador"), async (req, res) => {
  try {
    const displayName = req.body.display_name ?? req.body.displayName;
    const email = req.body.email;
    const password = req.body.password;
    const phone = req.body.phone;
    const role = req.body.role;
    const isActive = req.body.is_active ?? req.body.isActive;

    if (email) {
      const { rows: dup } = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, req.params.id]);
      if (dup.length > 0) return res.status(409).json({ error: "Email ya registrado" });
    }

    const setClauses = [];
    const values = [];
    let idx = 1;

    if (displayName !== undefined) { setClauses.push(`display_name = $${idx++}`); values.push(displayName); }
    if (email !== undefined) { setClauses.push(`email = $${idx++}`); values.push(email); }
    if (phone !== undefined) { setClauses.push(`phone = $${idx++}`); values.push(phone); }
    if (role !== undefined) { setClauses.push(`role = $${idx++}`); values.push(role); }
    if (isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(isActive); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      setClauses.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    if (setClauses.length === 0) return res.status(400).json({ error: "Sin campos" });

    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE users SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING id, display_name, email, phone, role, is_active`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id (soft delete: set is_active = false)
router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "No puedes desactivarte a ti mismo" });
    }
    const { rows } = await query(
      "UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
