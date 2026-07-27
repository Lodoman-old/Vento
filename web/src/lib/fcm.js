import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { api } from "./api";

const firebaseConfig = {
  apiKey: "AIzaSyAO5JyRfYlC_GpJbUnNM5V9WzsizkscQcQ",
  authDomain: "vento-42787.firebaseapp.com",
  projectId: "vento-42787",
  storageBucket: "vento-42787.firebasestorage.app",
  messagingSenderId: "130851491683",
  appId: "1:130851491683:web:vento",
};

const VAPID_KEY = "BLa6EFSg2A8U2ONKvpXvqpPsE5RUSDxsYqF5AEro2LjR5KAHLocZvpw_xfMYra0ZlamsrYNc08Obg9l7BIzVbIs";

let messaging = null;
let fcmApp = null;

function getFirebaseMessaging() {
  if (messaging) return messaging;
  try {
    fcmApp = initializeApp(firebaseConfig);
    messaging = getMessaging(fcmApp);
    return messaging;
  } catch (err) {
    console.warn("[fcm] error inicializando firebase:", err.message);
    return null;
  }
}

export async function requestFcmToken() {
  if (!("Notification" in window)) return null;
  if (Notification.permission === "denied") return null;

  const sw = await navigator.serviceWorker?.ready;
  if (!sw) return null;

  const msg = getFirebaseMessaging();
  if (!msg) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw });
    if (token) {
      await api.post("/notifications/register-token", { token });
      return token;
    }
  } catch (err) {
    console.warn("[fcm] error obteniendo token:", err.message);
  }
  return null;
}

export function listenForegroundMessages(callback) {
  const msg = getFirebaseMessaging();
  if (!msg) return () => {};
  return onMessage(msg, (payload) => {
    callback(payload);
  });
}
