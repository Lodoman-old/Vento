import jwt from "jsonwebtoken";
import { query } from "../services/db.js";

const SECRET = process.env.JWT_SECRET || "dev_secret";

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(header.split(" ")[1], SECRET);
    const { rows } = await query(
      "SELECT id, is_active, expires_at FROM users WHERE id = $1",
      [decoded.id]
    );
    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ error: "Usuario desactivado" });
    }
    if (rows[0].expires_at && new Date(rows[0].expires_at) < new Date()) {
      return res.status(401).json({ error: "Acceso expirado" });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No tienes permiso" });
    }
    next();
  };
}

export async function checkEventAccess(req, res, next) {
  if (req.user.role === "administrador") return next();
  const eventId = req.params.id || req.query.event_id || req.query.eventId || req.body.event_id || req.body.eventId;
  if (!eventId) return res.status(400).json({ error: "eventId requerido" });
  let ok;
  if (req.user.role === "cliente") {
    const { rows } = await query(
      "SELECT 1 FROM events WHERE id = $1 AND client_id = $2",
      [eventId, req.user.id]
    );
    ok = rows.length > 0;
  } else {
    const { rows } = await query(
      `SELECT 1 FROM events e
       LEFT JOIN event_staff es ON es.event_id = e.id
       LEFT JOIN agenda_items a ON a.event_id = e.id AND a.assigned_to = $2
       WHERE e.id = $1 AND (es.user_id = $2 OR a.assigned_to = $2)`,
      [eventId, req.user.id]
    );
    ok = rows.length > 0;
  }
  if (!ok) return res.status(403).json({ error: "No tienes acceso a este evento" });
  next();
}
