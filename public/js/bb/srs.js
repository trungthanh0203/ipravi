// Toán Leitner thuần cho ôn tập của "Tiếng Việt Bài Bản" — xem KE_HOACH_TIENG_VIET_BAI_BAN.md GĐ 4.
// CHỈ 'vocab' dùng box thật (tự đánh giá Nhớ/Quên ở màn Luyện tập); 3 loại còn lại (grammar/phonics/dialogue)
// không chấm, chỉ "ôn lại" nên box luôn ở 1 — chỉ due_at đổi (xem practice-core.js). Test: tests/bb.test.mjs.

// Khoảng cách tới lần ôn kế tiếp theo từng hộp (ngày) — Leitner cổ điển, 5 hộp.
export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16]; // index = box (1..5), box 0 không dùng

// Hộp kế tiếp sau khi tự đánh giá: nhớ → tăng hộp (tối đa 5); quên → về hộp 1.
export function nextBox(box, remembered) {
  return remembered ? Math.min(5, (box ?? 1) + 1) : 1;
}

// Hạn ôn kế tiếp tính từ hộp mới.
export function dueAfter(box, from = new Date()) {
  const days = INTERVAL_DAYS[box] ?? INTERVAL_DAYS[INTERVAL_DAYS.length - 1];
  return new Date(from.getTime() + days * 86_400_000);
}
