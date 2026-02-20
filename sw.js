const CACHE_NAME = "tanaw-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/feed.html",
  "/more.html",
  "/style.css",
  "/app.js",
  "/feed.js",
  "/more.js",
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
  self.addEventListener("message", (event) => {
  const alert = event.data;
  if (!alert) return;

  self.registration.showNotification("🚨 Calamity Alert", {
    body: `${alert.type} – ${alert.area}`,
    icon: "icon-192.png",
    vibrate: [200, 100, 200]
  });
});

});


