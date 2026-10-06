// Chọn phiên ôn tập ở trình duyệt — hàm thuần, không gọi mạng (cùng tinh thần với child/practice-core.js: dữ liệu
// tải 1 lần, mọi lựa chọn tính ở phía trình duyệt). Test: tests/bb.test.mjs.

export const isDue = (item, now = new Date()) => new Date(item.due_at) <= now;
export const dueCount = (items, now = new Date()) => items.filter((i) => isDue(i, now)).length;

// Ưu tiên mục đến hạn (hạn xa nhất trước), rồi tới mục chưa đến hạn nhưng lâu chưa ôn nhất — phiên không bao giờ
// trống nếu còn ít nhất 1 mục đã gặp qua (item_type đã có trong bb_progress/bb_srs_state).
export function pickSession(items, { limit = 8, now = new Date() } = {}) {
  const due = items.filter((i) => isDue(i, now)).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  const rest = items.filter((i) => !isDue(i, now)).sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  return [...due, ...rest].slice(0, limit);
}

// Phiên ôn theo bộ lọc: ÍT (≤ threshold) thì ôn HẾT; NHIỀU thì lấy ngẫu nhiên `ratio` (50%) của tổng để không quá tải.
// shuffle=true: xáo trộn thứ tự (từ vựng); false: giữ thứ tự gốc của các mục được chọn (hội thoại/ngữ pháp… có mạch).
export function sampleReview(items, { threshold = 30, ratio = 0.5, shuffle = true, rand = Math.random } = {}) {
  const idx = items.map((_, k) => k);
  for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; } // xáo trộn Fisher–Yates
  const take = items.length > threshold ? Math.ceil(items.length * ratio) : items.length;
  const chosen = idx.slice(0, take);
  if (!shuffle) chosen.sort((a, b) => a - b);
  return chosen.map((k) => items[k]);
}

// Ngữ pháp: mỗi lượt chỉ ôn các điểm ngữ pháp của MỘT bài ngẫu nhiên (không trộn nhiều bài). Nhóm theo `lesson_id` (mục không rõ bài
// thì mỗi mục là 1 nhóm riêng). Trả { items: các mục của bài được chọn (thứ tự gốc), lessonId, lessonTitle }.
export function pickLessonGroup(items, { rand = Math.random } = {}) {
  if (!items.length) return { items: [], lessonId: null, lessonTitle: null };
  const groups = new Map();
  items.forEach((it, k) => {
    const key = it.lesson_id ?? `solo:${k}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  });
  const all = [...groups.values()];
  const chosen = all[Math.floor(rand() * all.length)];
  return { items: chosen, lessonId: chosen[0].lesson_id ?? null, lessonTitle: chosen[0].lesson_title ?? null };
}
