// Service worker: mạng trước (luôn lấy bản mới của trang/JS), rơi về cache khi mất mạng;
// hình + âm thanh nội dung (Supabase Storage bucket "content") cache trước để phát tức thì.
// Đổi VERSION để xoá cache cũ.
const VERSION = "v2"; // đổi khi tải lại public/vendor/ (vendor được cache-trước)
const SHELL = `shell-${VERSION}`;
const MEDIA = `media-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== SHELL && k !== MEDIA).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.pathname.includes("/storage/v1/object/public/content/")) {
    if (req.headers.has("range")) return; // <audio> xin từng khúc (206): để trình duyệt tự xử lý; app tự tải nguyên file để cache (audio.js prefetch)
    e.respondWith(cacheFirst(req, MEDIA));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(url.pathname.startsWith("/vendor/") ? cacheFirst(req, SHELL) : networkFirst(req, SHELL));
  }
  // Các yêu cầu khác (Supabase API, CDN) để trình duyệt xử lý bình thường.
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200) cache.put(req, res.clone()); // 206 (một phần) không cache được
  return res;
}
