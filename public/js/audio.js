// Chọn + phát âm thanh. Luật chọn giọng nằm ở MỘT hàm (pickAudio) để sau này thêm giọng
// người thật / trẻ em / người lớn / vùng miền chỉ là thêm dữ liệu (bảng content_audio), không sửa code.

// rows: các dòng content_audio của 1 mục. Trả về dòng tốt nhất, hoặc null (=> ẩn nút nghe).
// prefs: { lang, speed = "normal", gender, voiceKind, region }
// gender ("female"|"male") là lựa chọn RÕ của bé/phụ huynh nên được ưu tiên cao nhất: giọng đúng giới thắng cả giọng người thật
// khác giới. Không có giọng đúng giới thì vẫn dùng giọng còn lại (không bao giờ im lặng nếu còn file nào).
export function pickAudio(rows, prefs) {
  const { lang, speed = "normal", voiceKind, region, gender } = prefs;
  const candidates = rows.filter((r) => r.lang === lang && r.speed === speed);
  if (candidates.length === 0) return null;
  const score = (r) =>
    (gender && r.gender === gender ? 150 : 0) +
    (r.source === "human" ? 100 : 0) +
    (voiceKind && r.voice_kind === voiceKind ? 10 : 0) +
    (region && r.region === region ? 5 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

// iOS Safari chặn tự phát nếu chưa có cú chạm: chỉ gọi playUrl() từ trình xử lý sự kiện chạm/nhấn.
let current = null;

export function stopAudio() {
  if (current) {
    current.pause();
    current = null;
  }
  if ("speechSynthesis" in globalThis) speechSynthesis.cancel();
}

// Bộ nhớ đệm âm thanh: tải NGUYÊN file trước (nền) rồi phát từ blob → bấm 🔊 là nghe ngay, không chờ mạng mỗi lần
// (phát trực tiếp qua thẻ <audio> thì mỗi lần bấm đều xin lại từ máy chủ). Lỗi/hết chỗ → tự quay về phát theo URL.
const MAX_CACHED = 300;
const blobUrls = new Map(); // url → objectURL
const inflight = new Set();
let running = 0;
const waiting = [];

function pump() {
  while (running < 4 && waiting.length) {
    const url = waiting.shift();
    running++;
    fetch(url)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b) return;
        if (blobUrls.size >= MAX_CACHED) {
          const [oldest, obj] = blobUrls.entries().next().value;
          URL.revokeObjectURL(obj);
          blobUrls.delete(oldest);
        }
        blobUrls.set(url, URL.createObjectURL(b));
      })
      .catch(() => {})
      .finally(() => { running--; inflight.delete(url); pump(); });
  }
}

export function prefetchAudio(urls) {
  for (const url of urls) {
    if (!url || blobUrls.has(url) || inflight.has(url)) continue;
    inflight.add(url);
    waiting.push(url);
  }
  pump();
}

// Trả về Promise resolve khi phát XONG (hoặc lỗi) — để nối tiếp các bước, không bao giờ reject.
export function playUrl(url) {
  stopAudio();
  const a = new Audio(blobUrls.get(url) ?? url);
  current = a;
  return new Promise((resolve) => {
    a.onended = () => resolve();
    a.onerror = () => resolve();
    a.play().catch(() => resolve());
  });
}
