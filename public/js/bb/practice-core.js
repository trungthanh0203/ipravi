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
