import { query } from "./db.js";

export async function createNotification({ userId, eventId, title, body, type }) {
  await query(
    `INSERT INTO notifications (user_id, event_id, title, body, type)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, eventId, title, body, type || "general"]
  );
}

export async function notifyAdmins({ eventId, title, body, type }) {
  const { rows: admins } = await query(
    "SELECT id FROM users WHERE role = 'administrador'"
  );
  for (const admin of admins) {
    await createNotification({ userId: admin.id, eventId, title, body, type });
  }
}

export async function notifyStaff({ eventId, title, body, type }) {
  const { rows: staff } = await query(
    "SELECT user_id FROM event_staff WHERE event_id = $1",
    [eventId]
  );
  for (const s of staff) {
    await createNotification({ userId: s.user_id, eventId, title, body, type });
  }
}
