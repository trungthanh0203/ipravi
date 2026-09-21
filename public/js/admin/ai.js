import { sb } from "../supabase.js";
import { CONFIG } from "../config.js";

// Gọi /api/suggest (Worker → Gemini) để dịch chữ Việt sang các ngôn ngữ của trung tâm + gợi ý emoji. Khoá AI nằm ở Worker, không bao giờ ở đây.
// Kết quả CHỈ là gợi ý: giao diện luôn cho admin xem lại rồi mới lưu.
export const aiEnabled = () => Boolean(CONFIG?.aiEnabled);
export const BATCH = 40; // khớp MAX_ENTRIES của Worker

async function token() {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token;
}

async function call(entries, { context, langs, wantEmoji }) {
  const res = await fetch("/api/suggest", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ entries, context, langs, wantEmoji }),
  });
  let data = null;
  try { data = await res.json(); } catch { /* không phải JSON */ }
  if (!res.ok) throw new Error(data?.error || `AI lỗi ${res.status}`);
  return data;
}

// entries: [{ vi, lesson? }] (hoặc chuỗi). Chia lô 40 mục, gọi lần lượt (tránh vượt hạn mức). Trả { results, error }:
// results[i] = { emoji, tr:{lang:nghĩa} } hoặc undefined nếu lô đó lỗi; error = lỗi đầu tiên (đã dừng ở đó) hoặc null; model/fellBack = mô hình đã trả lời.
// (Lỗi tạm thời như 503 "high demand" đã được Worker tự thử lại + chuyển mô hình dự phòng trước khi báo lỗi.)
export async function suggest(entries, { context = {}, langs, wantEmoji = false, onProgress = () => {} } = {}) {
  const results = new Array(entries.length);
  let done = 0;
  let model = "";
  let fellBack = false; // đã phải dùng mô hình dự phòng (mô hình chính quá tải)
  onProgress(0, entries.length);
  for (let from = 0; from < entries.length; from += BATCH) {
    const part = entries.slice(from, from + BATCH).map((e) => (typeof e === "string" ? { vi: e } : e));
    try {
      const data = await call(part, { context, langs, wantEmoji });
      data.items.forEach((it, k) => { results[from + k] = it; });
      model = data.model ?? model;
      fellBack = fellBack || Boolean(data.fellBack);
    } catch (e) {
      return { results, error: e, model, fellBack };
    }
    done += part.length;
    onProgress(done, entries.length);
  }
  return { results, error: null, model, fellBack };
}
