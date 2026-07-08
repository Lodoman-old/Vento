import { query } from "./db.js";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Inicializar Firebase Admin SDK con la cuenta de servicio
let fcmInitialized = false;
function initFcm() {
  if (fcmInitialized) return;
  const serviceAccountPath = path.join(__dirname, "..", "..", "vento-42787-firebase-adminsdk-fbsvc-3ab0a26e6d.json");
  // También soportar variable de entorno FCM_SERVICE_ACCOUNT (base64) para producción
  if (process.env.FCM_SERVICE_ACCOUNT) {
    try {
      const cred = JSON.parse(Buffer.from(process.env.FCM_SERVICE_ACCOUNT, "base64").toString());
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      fcmInitialized = true;
      console.log("[fcm] inicializado desde FCM_SERVICE_ACCOUNT env");
      return;
    } catch (e) {
      console.warn("[fcm] error cargando credenciales desde env:", e.message);
    }
  }
  if (fs.existsSync(serviceAccountPath)) {
    try {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath) });
      fcmInitialized = true;
      console.log("[fcm] inicializado desde archivo local");
    } catch (e) {
      console.warn("[fcm] error cargando credenciales:", e.message);
    }
  } else {
    console.warn("[fcm] archivo de cuenta de servicio no encontrado");
  }
}

async function sendPush(userId, title, body, data = {}) {
  if (!fcmInitialized) initFcm();
  if (!fcmInitialized) return;

  try {
    const { rows } = await query("SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL", [userId]);
    if (rows.length === 0 || !rows[0].fcm_token) return;

    const message = {
      token: rows[0].fcm_token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    };

    await admin.messaging().send(message);
  } catch (err) {
    console.warn(`[fcm] error enviando push a ${userId}:`, err.message);
  }
}

export async function createNotification({ userId, eventId, title, body, type }) {
  await query(
    `INSERT INTO notifications (user_id, event_id, title, body, type)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, eventId, title, body, type || "general"]
  );
  // También enviar push
  await sendPush(userId, title, body, { event_id: eventId || "", type: type || "general" });
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
