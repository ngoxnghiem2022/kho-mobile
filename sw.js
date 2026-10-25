// Service worker Kho Mobile: cache khung app để mở nhanh / dùng khi mạng chập chờn.
// KHÔNG cache dữ liệu Supabase (mọi thao tác kho luôn cần mạng để đảm bảo an toàn tồn kho).
const CACHE = "kho-mobile-v22";
const CORE = [
  "./", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Luôn lấy bản mới nhất từ mạng cho HTML/config (bỏ qua cả cache HTTP của trình duyệt),
// chỉ rơi về cache khi mất mạng.
function networkFirst(req) {
  return fetch(req, { cache: "reload" })
    .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
    .catch(() => caches.match(req).then(r => r || caches.match("./")));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  // chỉ xử lý tài nguyên cùng nguồn (bỏ qua Supabase API + CDN)
  if (u.origin !== self.location.origin) return;
  // HTML, config.js: ưu tiên mạng (luôn mới), cache dự phòng khi offline
  if (req.mode === "navigate" || u.pathname.endsWith("/") ||
      u.pathname.endsWith("index.html") || u.pathname.endsWith("config.js")) {
    e.respondWith(networkFirst(req));
    return;
  }
  // tài nguyên tĩnh (icon, manifest…): cache trước
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(resp => {
      const cp = resp.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return resp;
    }))
  );
});
