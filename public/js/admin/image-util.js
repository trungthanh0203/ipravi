// Hàm THUẦN cho ảnh minh hoạ (có test): tính kích thước, ghép tên file với mục.

export const MAX_SIDE = 512; // cạnh dài tối đa sau khi thu nhỏ (khung hiển thị chỉ ~200 px, ×2 cho màn hình nét cao)
export const MAX_BYTES = 300 * 1024; // ảnh sau nén nên ≤ ~300 KB (thường 20–80 KB dạng WebP)

// Thu nhỏ để cạnh dài ≤ max, giữ tỉ lệ, KHÔNG phóng to.
export function fitSize(w, h, max = MAX_SIDE) {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

// "bánh chưng" → "banh-chung"; "Đà Nẵng" → "da-nang".
export function slugify(text) {
  return String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const baseName = (filename) => String(filename).replace(/\.[^.]+$/, "");

// Ghép file với mục của bài theo TÊN FILE: ưu tiên khớp đúng chữ có dấu ("bánh chưng.png"), sau đó khớp không dấu ("banh-chung.png")
// nếu không mơ hồ (vd "ba" và "bà" cùng dạng không dấu → phải đặt tên đúng chữ có dấu). Trả { matched:[{file,item}], unmatched:[tên], ambiguous:[tên] }.
export function matchFiles(files, items) {
  const norm = (s) => String(s).normalize("NFC").toLowerCase().trim();
  const exact = new Map(items.map((i) => [norm(i.text_vi), i]));
  const bySlug = new Map();
  for (const i of items) { const k = slugify(i.text_vi); bySlug.set(k, [...(bySlug.get(k) ?? []), i]); }
  const matched = [], unmatched = [], ambiguous = [];
  for (const file of files) {
    const base = baseName(file.name);
    const hit = exact.get(norm(base));
    if (hit) { matched.push({ file, item: hit }); continue; }
    const cands = bySlug.get(slugify(base)) ?? [];
    if (cands.length === 1) matched.push({ file, item: cands[0] });
    else if (cands.length > 1) ambiguous.push(file.name);
    else unmatched.push(file.name);
  }
  return { matched, unmatched, ambiguous };
}

// Loại file ảnh nhận được. SVG bị từ chối (có thể chứa mã chạy được).
export function checkImageFile(file) {
  if (!file?.type?.startsWith("image/")) return "Không phải file ảnh.";
  if (/svg/i.test(file.type) || /\.svg$/i.test(file.name ?? "")) return "Không nhận ảnh SVG (dùng PNG, JPG hoặc WebP).";
  if (file.size > 12 * 1024 * 1024) return "Ảnh lớn hơn 12 MB — hãy thu nhỏ trước.";
  return null;
}
