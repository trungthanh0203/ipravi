// Chọn + phát âm thanh. Luật chọn giọng nằm ở MỘT hàm (pickAudio) để sau này thêm giọng
// người thật / trẻ em / người lớn / vùng miền chỉ là thêm dữ liệu (bảng content_audio), không sửa code.

// rows: các dòng content_audio của 1 mục. Trả về dòng tốt nhất, hoặc null (=> ẩn nút nghe).
// prefs: { lang, speed = "normal", voiceKind, region }
export function pickAudio(rows, prefs) {
  const { lang, speed = "normal", voiceKind, region } = prefs;
  const candidates = rows.filter((r) => r.lang === lang && r.speed === speed);
  if (candidates.length === 0) return null;
  const score = (r) =>
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

// Trả về Promise resolve khi phát XONG (hoặc lỗi) — để nối tiếp các bước, không bao giờ reject.
export function playUrl(url) {
  stopAudio();
  const a = new Audio(url);
  current = a;
  return new Promise((resolve) => {
    a.onended = () => resolve();
    a.onerror = () => resolve();
    a.play().catch(() => resolve());
  });
}
