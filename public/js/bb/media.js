import { contentUrl } from "../supabase.js";
import { playUrl } from "../audio.js";
// Dùng lại nguyên (không sửa): giọng trình duyệt tạm thời + ngôn ngữ ở nhà của phụ huynh — 2 khái niệm chung, không
// riêng gì khu trẻ em (xem KE_HOACH_TIENG_VIET_BAI_BAN.md mục "Dùng lại nguyên công nghệ/UI đã làm cho app trẻ em").
// titleIn/titleSpeakers cũng dùng lại NGUYÊN: hàm agnostic-giáo-trình, chỉ cần thing.title_vi/title_tr — đúng
// hình dạng bb_units/bb_lessons đã có (title_tr, migration 022+025) như units/lessons bên khu trẻ em.
import { speakFallback, nativeLang, nativeLabel, titleIn, titleSpeakers } from "../child/media.js";
export { speakFallback, nativeLang, nativeLabel, titleIn, titleSpeakers };

// Phát 1 đường dẫn âm thanh trong bucket "content"; CHƯA có file (Bài Bản chưa có pipeline TTS/thu âm riêng, xem
// GĐ 5 trong kế hoạch) → đọc tạm bằng giọng trình duyệt.
export function playPath(path, fallbackText) {
  if (path) return playUrl(contentUrl(path));
  return speakFallback(fallbackText, "vi");
}

export function imageOf(row) {
  return row?.image_path ? contentUrl(row.image_path) : null;
}
