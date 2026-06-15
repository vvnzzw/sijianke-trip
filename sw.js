// 四賤客小旅行 — Service Worker（離線快取）
var CACHE = "sjk-trip-v2";
var ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./data.js",
  "./manifest.json", "./icon.svg"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = e.request.url;
  // 全部走 network-first：連線時拿最新（並回填快取），離線時用快取後備
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.status === 200 && url.indexOf("http") === 0 &&
          url.indexOf("open-meteo.com") === -1 && url.indexOf("google.com/maps") === -1) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        return hit || caches.match("./index.html");
      });
    })
  );
});
