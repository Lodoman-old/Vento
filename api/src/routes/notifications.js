import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../services/db.js";

const router = Router();

router.use(authenticate);

// GET /api/notifications?eventId=&days=
router.get("/", async (req, res) => {
  try {
    const { eventId, days } = req.query;
    let sql, params;

    if (req.user.role === "administrador") {
      sql = "SELECT n.*, e.name AS event_name FROM notifications n LEFT JOIN events e ON e.id = n.event_id WHERE n.user_id = $1";
      params = [req.user.id];
    } else {
      // staff solo ve notificaciones de eventos donde está asignado
      sql = `SELECT n.*, e.name AS event_name FROM notifications n
             LEFT JOIN events e ON e.id = n.event_id
             WHERE n.user_id = $1 AND (
               n.event_id IS NULL OR
               EXISTS (SELECT 1 FROM event_staff es WHERE es.event_id = n.event_id AND es.user_id = $1)
             )`;
      params = [req.user.id];
    }

    if (eventId) {
      sql += " AND n.event_id = $2";
      params.push(eventId);
    }

    if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(days));
      const idx = params.length + 1;
      sql += ` AND n.created_at >= $${idx}`;
      params.push(cutoff);
    }

    sql += " ORDER BY n.created_at DESC LIMIT 100";

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false",
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res) => {
  try {
    const { rows } = await query(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all
router.post("/read-all", async (req, res) => {
  try {
    await query("UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false", [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/cleanup — eliminar notificaciones leídas mayores a 30 días
router.delete("/cleanup", async (req, res) => {
  try {
    const { rowCount } = await query(
      "DELETE FROM notifications WHERE user_id = $1 AND is_read = true AND created_at < NOW() - INTERVAL '30 days'",
      [req.user.id]
    );
    res.json({ deleted: rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
