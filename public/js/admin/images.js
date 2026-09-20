import { sb } from "../supabase.js";
import { fitSize, checkImageFile, MAX_SIDE, MAX_BYTES } from "./image-util.js";

// Ảnh minh hoạ riêng cho mục/chủ đề (ưu tiên hơn emoji ở khu bé — xem child/media.js visual()).
// Nén NGAY TRONG TRÌNH DUYỆT (thu nhỏ ≤ 512 px, WebP ~20–80 KB) để bé tải nhanh và Storage nhẹ; sw.js cache-trước nên mỗi ảnh chỉ tải 1 lần.
const check = ({ error }) => { if (error) throw error; };

async function toBlob(canvas, type, q) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, q));
}

// Trả { blob, ext, width, height }. WebP (giữ nền trong suốt); trình duyệt không mã hoá được WebP (Safari cũ) → PNG nếu gốc là PNG, không thì JPEG.
export async function compressImage(file, { max = MAX_SIDE } = {}) {
  const problem = checkImageFile(file);
  if (problem) throw new Error(problem);
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error("Không đọc được ảnh (file hỏng hoặc định dạng lạ)."); }
  let side = max;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { w, h } = fitSize(bitmap.width, bitmap.height, side);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const g = canvas.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(bitmap, 0, 0, w, h);
    let quality = 0.85;
    let blob = await toBlob(canvas, "image/webp", quality);
    let ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      if (/png/i.test(file.type)) { blob = await toBlob(canvas, "image/png"); ext = "png"; }
      else { blob = await toBlob(canvas, "image/jpeg", quality); ext = "jpg"; }
    }
    while (blob.size > MAX_BYTES && quality > 0.5 && ext !== "png") { quality -= 0.1; blob = await toBlob(canvas, ext === "webp" ? "image/webp" : "image/jpeg", quality); }
    if (blob.size <= MAX_BYTES || attempt === 2) { bitmap.close?.(); return { blob, ext, width: w, height: h }; }
    side = Math.round(side * 0.75); // vẫn quá nặng → thu nhỏ thêm rồi thử lại
  }
}

const TYPES = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };

// table: "content_items" | "units". Thay ảnh cũ (nếu có) sau khi ảnh mới đã lưu thành công.
export async function setImage(table, row, file) {
  const { blob, ext } = await compressImage(file);
  const path = `img/${table === "units" ? "unit" : "item"}-${row.id}-${Date.now()}.${ext}`;
  const up = await sb.storage.from("content").upload(path, blob, { contentType: TYPES[ext], upsert: false });
  if (up.error) throw new Error("Tải ảnh lên thất bại: " + up.error.message);
  const { error } = await sb.from(table).update({ image_path: path }).eq("id", row.id);
  if (error) { await sb.storage.from("content").remove([path]); throw error; }
  if (row.image_path) await sb.storage.from("content").remove([row.image_path]);
  row.image_path = path;
  return { path, bytes: blob.size };
}

export async function clearImage(table, row) {
  if (!row.image_path) return;
  check(await sb.from(table).update({ image_path: null }).eq("id", row.id));
  await sb.storage.from("content").remove([row.image_path]);
  row.image_path = null;
}
