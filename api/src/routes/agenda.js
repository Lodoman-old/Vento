import { Router } from "express";
import { authenticate, authorize, checkEventAccess } from "../middleware/auth.js";
import { agendaRules, patchAgendaRules } from "../middleware/validate.js";
import { query } from "../services/db.js";
import { getIO } from "../socket.js";
import { publishToRedis } from "../services/redis.js";
import { createNotification, notifyAdmins } from "../services/notifications.js";

const router = Router();

router.use(authenticate);

// GET /api/agenda?eventId=
router.get("/", checkEventAccess, async (req, res) => {
  try {
    const eventId = req.query.event_id || req.query.eventId;
    const { rows } = await query(
      `SELECT a.*, u.display_name as assigned_name
       FROM agenda_items a
       LEFT JOIN users u ON u.id = a.assigned_to
       WHERE a.event_id = $1
       ORDER BY a.sort_order, a.start_time`,
      [eventId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agenda
router.post("/", authorize("administrador"), ...agendaRules, async (req, res) => {
  try {
    const eventId = req.body.event_id || req.body.eventId;
    const title = req.body.title;
    const description = req.body.description || null;
    const startTime = req.body.start_time ?? req.body.startTime;
    const endTime = req.body.end_time ?? req.body.endTime;
    const assignedTo = req.body.assigned_to ?? req.body.assignedTo;
    const category = req.body.category || null;
    const { rows } = await query(
      `INSERT INTO agenda_items (event_id, title, description, start_time, end_time, assigned_to, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [eventId, title, description, startTime, endTime, assignedTo, category]
    );
    if (assignedTo) {
      await createNotification({
        userId: assignedTo,
        eventId,
        title: "Nueva tarea asignada",
        body: `Te asignaron "${title}"`,
        type: "agenda",
      });
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/agenda/:id — staff completa tarea
router.patch("/:id", ...patchAgendaRules, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario puede modificar este item
    const { rows: check } = await query(
      "SELECT assigned_to, event_id FROM agenda_items WHERE id = $1",
      [id]
    );
    if (check.length === 0) return res.status(404).json({ error: "No encontrado" });

    const item = check[0];
    if (req.user.role !== "administrador" && item.assigned_to !== req.user.id) {
      return res.status(403).json({ error: "No asignado a esta tarea" });
    }

    const isCompleted = req.body.is_completed ?? req.body.isCompleted;
    const notes = req.body.notes;
    const { rows } = await query(
      `UPDATE agenda_items SET
        is_completed = COALESCE($1, is_completed),
        completed_at = CASE WHEN $1 = true THEN NOW() ELSE completed_at END,
        notes = COALESCE($2, notes),
        updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [isCompleted, notes, id]
    );

    // Emitir via socket + Redis
    const io = getIO();
    if (io) {
      io.to(`event:${item.event_id}`).emit("agenda:updated", rows[0]);
    }
    publishToRedis("agenda:updated", `event:${item.event_id}`, rows[0]);

    // Notificar según quién complete
    if (isCompleted) {
      if (req.user.role !== "administrador") {
        await notifyAdmins({
          eventId: item.event_id,
          title: "Tarea completada",
          body: `${req.user.displayName || "Staff"} completó "${rows[0].title}"`,
          type: "agenda",
        });
        // Notificar a otros staff, no a quien completó
        const { rows: otros } = await query(
          "SELECT user_id FROM event_staff WHERE event_id = $1 AND user_id != $2",
          [item.event_id, req.user.id]
        );
        for (const s of otros) {
          await createNotification({
            userId: s.user_id,
            eventId: item.event_id,
            title: "Tarea completada",
            body: `${req.user.displayName || "Staff"} completó "${rows[0].title}"`,
            type: "agenda",
          });
        }
      } else {
        await notifyStaff({
          eventId: item.event_id,
          title: "Tarea completada por administrador",
          body: `"${rows[0].title}" fue marcada como completada`,
          type: "agenda",
        });
      }
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/agenda/:id — admin edita
router.put("/:id", authorize("administrador"), async (req, res) => {
  try {
    const title = req.body.title;
    const description = req.body.description || null;
    const startTime = req.body.start_time ?? req.body.startTime;
    const endTime = req.body.end_time ?? req.body.endTime;
    const assignedTo = req.body.assigned_to ?? req.body.assignedTo;
    const category = req.body.category || null;
    const isCompleted = req.body.is_completed ?? req.body.isCompleted;
    const notes = req.body.notes;
    const sortOrder = req.body.sort_order ?? req.body.sortOrder;
    const { rows: old } = await query("SELECT assigned_to, event_id FROM agenda_items WHERE id = $1", [req.params.id]);

    const { rows } = await query(
      `UPDATE agenda_items SET
        title=$1, description=$2, start_time=$3, end_time=$4,
        assigned_to=$5, category=$6, is_completed=$7, notes=$8,
        sort_order=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [title, description, startTime, endTime, assignedTo, category, isCompleted, notes, sortOrder, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrado" });

    if (assignedTo && (!old[0].assigned_to || old[0].assigned_to !== assignedTo)) {
      await createNotification({
        userId: assignedTo,
        eventId: old[0].event_id,
        title: "Tarea asignada",
        body: `Te asignaron "${rows[0].title}"`,
        type: "agenda",
      });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agenda/:id
router.delete("/:id", authorize("administrador"), async (req, res) => {
  try {
    const { rows: item } = await query("SELECT event_id FROM agenda_items WHERE id = $1", [req.params.id]);
    if (item.length === 0) return res.status(404).json({ error: "Tarea no encontrada" });

    await query("DELETE FROM agenda_items WHERE id = $1", [req.params.id]);

    const io = getIO();
    if (io) {
      io.to(`event:${item[0].event_id}`).emit("agenda:deleted", { agendaId: req.params.id });
    }
    publishToRedis("agenda:deleted", `event:${item[0].event_id}`, { agendaId: req.params.id });

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
