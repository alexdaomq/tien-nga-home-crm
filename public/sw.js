// Service worker tối giản cho PWA Tiến Nga CRM.
// Nguyên tắc: KHÔNG đụng request ghi (POST/PATCH/DELETE) và KHÔNG cache /api/
// -> dữ liệu khách hàng luôn tươi. Chỉ cache tài nguyên tĩnh + cho phép cài app.
const CACHE = "tien-nga-crm-v1";
const STATIC = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // để form gửi thẳng lên mạng
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // API luôn đi mạng, không cache

  // Tài nguyên tĩnh: lấy cache trước cho nhanh, không có thì tải mạng rồi lưu.
  if (/\.(?:woff2?|png|jpe?g|svg|webmanifest|css|js|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Trang: ưu tiên mạng (để luôn mới sau mỗi lần deploy), offline thì lấy cache.
  event.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
  );
});
