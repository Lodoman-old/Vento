import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { api } from "./api";

const VAPID_KEY = "BLa6EFSg2A8U2ONKvpXvqpPsE5RUSDxsYqF5AEro2LjR5KAHLocZvpw_xfMYra0ZlamsrYNc08Obg9l7BIzVbIs";
const SW_PATH = "/firebase-messaging-sw.js";

let messaging = null;
let configCache = null;

export async function getFirebaseConfig() {
  if (configCache) return configCache;
  try {
    const data = await api.get("/firebase-config");
    if (data.configured) {
      configCache = data;
      return data;
    }
  } catch (err) {
    console.warn("[fcm] no se pudo obtener config:", err.message);
  }
  return null;
}

export async function getFirebaseMessaging() {
  if (messaging) return messaging;
  const config = await getFirebaseConfig();
  if (!config) return null;
  try {
    const app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
    messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.warn("[fcm] error inicializando firebase:", err.message);
    return null;
  }
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register(SW_PATH);
    }
    if (!reg.active) {
      reg = await navigator.serviceWorker.ready;
    }
    return reg || null;
  } catch (err) {
    console.warn("[fcm] error registrando service worker:", err.message);
    return null;
  }
}

export async function requestFcmToken() {
  if (!("Notification" in window)) return null;
  if (Notification.permission === "denied") return null;

  const sw = await registerServiceWorker();
  if (!sw) return null;

  const msg = await getFirebaseMessaging();
  if (!msg) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw });
    if (token) {
      await api.post("/notifications/register-token", { token, platform: "web" });
      return token;
    }
  } catch (err) {
    console.warn("[fcm] error obteniendo token:", err.message);
  }
  return null;
}

export function listenForegroundMessages(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
}
