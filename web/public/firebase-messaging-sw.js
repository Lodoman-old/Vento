const VAPID_KEY = "BLa6EFSg2A8U2ONKvpXvqpPsE5RUSDxsYqF5AEro2LjR5KAHLocZvpw_xfMYra0ZlamsrYNc08Obg9l7BIzVbIs";

let firebaseApp = null;
let messaging = null;

async function getConfig() {
  try {
    const res = await fetch("/api/firebase-config");
    const data = await res.json();
    if (data.configured) return data;
  } catch (err) {
    console.warn("[sw] error fetching firebase config:", err);
  }
  return null;
}

async function initFirebaseMessaging() {
  if (messaging) return messaging;
  const config = await getConfig();
  if (!config) return null;

  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
    const { getMessaging: getMessagingFn } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js");

    firebaseApp = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
    messaging = getMessagingFn(firebaseApp);
    return messaging;
  } catch (err) {
    console.warn("[sw] error init firebase:", err);
    return null;
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Vento", body: "" };
  try {
    const payload = event.data?.json();
    data.title = payload.notification?.title || payload.data?.title || "Vento";
    data.body = payload.notification?.body || payload.data?.body || "";
  } catch {}

  const options = {
    body: data.body,
    icon: "/vento-icon.svg",
    badge: "/vento-icon.svg",
    data: data,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/")) {
          client.focus();
          return;
        }
      }
      self.clients.openWindow("/");
    })
  );
});
