import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { query } from "../services/db.js";
import { authRules } from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
const SECRET = process.env.JWT_SECRET || "dev_secret";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos. Intenta de nuevo en 15 minutos" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email/usuario y contraseña requeridos" });
    }

    let { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
    if (rows.length === 0) {
      ({ rows } = await query("SELECT * FROM users WHERE username = $1", [email]));
    }

    if (rows.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = rows[0];
    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return res.status(401).json({ error: "Acceso expirado" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, displayName: user.display_name },
      SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.display_name,
        email: user.email,
        role: user.role,
        photo: user.photo_url,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/register", authenticate, authorize("administrador"), ...authRules, async (req, res) => {
  try {
    const displayName = req.body.display_name ?? req.body.displayName;
    const email = req.body.email;
    const password = req.body.password;
    const role = req.body.role;
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (display_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, display_name, email, role`,
      [displayName, email, hash, role || "staff"]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email ya registrado" });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — perfil del usuario logueado
router.get("/me", authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, display_name, email, phone, role, photo_url FROM users WHERE id = $1",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
