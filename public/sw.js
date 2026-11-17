/* Solo almacena la pantalla pública sin conexión; nunca la agenda ni respuestas autenticadas. */
const CACHE = "glowbook-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/offline.html",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("glowbook-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
});
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    /* Siempre muestra un aviso visible, incluso si el cuerpo no es JSON. */
  }
  const body =
    typeof data.body === "string" ? data.body : "Hay una novedad en tu agenda.";
  const url = new URL(
    typeof data.url === "string" ? data.url : "/panel",
    self.location.origin,
  );
  const path =
    url.origin === self.location.origin && url.pathname.startsWith("/panel")
      ? url.pathname + url.search
      : "/panel";
  event.waitUntil(
    self.registration.showNotification(
      typeof data.title === "string" ? data.title : "GlowBook",
      {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: typeof data.tag === "string" ? data.tag : "glowbook-agenda",
        renotify: false,
        data: { url: path },
      },
    ),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.url ?? "/panel",
    self.location.origin,
  );
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/panel"))
    return;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const app = clients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (app) {
          await app.navigate(url.href);
          return app.focus();
        }
        return self.clients.openWindow(url.href);
      }),
  );
});
