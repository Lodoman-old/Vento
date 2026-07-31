self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let title = "Vento";
  let body = "";
  let data = {};
  try {
    const payload = event.data?.json();
    title = payload?.notification?.title || payload?.data?.title || "Vento";
    body = payload?.notification?.body || payload?.data?.body || "";
    data = payload?.data || payload?.notification || {};
  } catch {}

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/vento-icon.svg",
      badge: "/vento-icon.svg",
      data,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.registration.scope)) {
          return client.focus();
        }
      }
      return self.clients.openWindow("/");
    })
  );
});
