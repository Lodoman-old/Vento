import { initializeApp } from "firebase-app";
import { getMessaging } from "firebase-messaging/sw";

const firebaseConfig = {
  apiKey: "AIzaSyAO5JyRfYlC_GpJbUnNM5V9WzsizkscQcQ",
  authDomain: "vento-42787.firebaseapp.com",
  projectId: "vento-42787",
  storageBucket: "vento-42787.firebasestorage.app",
  messagingSenderId: "130851491683",
  appId: "1:130851491683:web:vento",
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Vento";
  const options = {
    body: payload.notification?.body || "",
    icon: "/vento-icon.svg",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});
