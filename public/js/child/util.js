export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Lấy ngẫu nhiên n phần tử (không lặp).
export const sample = (arr, n) => shuffle(arr).slice(0, Math.max(0, n));

// Hình của mục có dùng làm ĐÁP ÁN/GỢI Ý được không: có hình (emoji/ảnh) và không bị đánh dấu "trang trí" (pic = 'decor').
export const isLiteral = (item) => item.pic !== "decor" && Boolean(item.emoji || item.image_path);

export function childAge(child) {
  return child?.birth_year ? new Date().getFullYear() - child.birth_year : null;
}
