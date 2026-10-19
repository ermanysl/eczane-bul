// Uygulama kabuğunu önbelleğe alır; eczane verisi her zaman ağdan gelir.
const CACHE = "eczane-v3";
const SHELL = ["./", "index.html", "style.css", "app.js", "icon.svg", "icon-192.png", "icon-512.png", "manifest.webmanifest", "ilceler.json"];

self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
