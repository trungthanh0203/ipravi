import { contentUrl } from "../supabase.js";
import { playUrl } from "../audio.js";
// Dùng lại nguyên (không sửa): mọi hàm này agnostic-giáo-trình (chỉ cần state.activeChildId/child_profiles hoặc
// thing.title_vi/title_tr — cùng hình dạng bên Bài Bản lẫn khu Trẻ em), không riêng gì khu trẻ em.
// profileHeader/sessionFooter: header/footer dùng CHUNG cho mọi màn điều hướng chính (xem child/media.js).
import { speakFallback, nativeLang, nativeLabel, titleIn, titleSpeakers, profileHeader, sessionFooter, crumbBar } from "../child/media.js";
export { speakFallback, nativeLang, nativeLabel, titleIn, titleSpeakers, profileHeader, sessionFooter, crumbBar };

// Phát 1 đường dẫn âm thanh trong bucket "content"; CHƯA có file (Bài Bản chưa có pipeline TTS/thu âm riêng, xem
// GĐ 5 trong kế hoạch) → đọc tạm bằng giọng trình duyệt.
export function playPath(path, fallbackText) {
  if (path) return playUrl(contentUrl(path));
  return speakFallback(fallbackText, "vi");
}

export function imageOf(row) {
  return row?.image_path ? contentUrl(row.image_path) : null;
}
