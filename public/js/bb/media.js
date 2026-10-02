import { contentUrl } from "../supabase.js";
import { el } from "../ui.js";
import { T } from "../strings.js";
import { playUrl } from "../audio.js";
// Dùng lại nguyên (không sửa): mọi hàm này agnostic-giáo-trình (chỉ cần state.activeChildId/child_profiles hoặc
// thing.title_vi/title_tr — cùng hình dạng bên Bài Bản lẫn khu Trẻ em), không riêng gì khu trẻ em.
// profileHeader/sessionFooter: header/footer dùng CHUNG cho mọi màn điều hướng chính (xem child/media.js).
import { speakFallback, nativeLang, nativeLabel, titleIn, titleSpeakers, profileHeader, sessionFooter } from "../child/media.js";
export { speakFallback, nativeLang, nativeLabel, titleIn, titleSpeakers, profileHeader, sessionFooter };

// Phát 1 đường dẫn âm thanh trong bucket "content"; CHƯA có file (Bài Bản chưa có pipeline TTS/thu âm riêng, xem
// GĐ 5 trong kế hoạch) → đọc tạm bằng giọng trình duyệt.
export function playPath(path, fallbackText) {
  if (path) return playUrl(contentUrl(path));
  return speakFallback(fallbackText, "vi");
}

// Thanh điều hướng đầu mỗi màn Bài Bản: bên TRÁI là đường dẫn chữ (vd "A0: Bảng chữ cái: Từ vựng"), bên PHẢI là
// nút Quay lại — dùng chung cho danh sách chủ đề/bài/lưới chặng/màn 1 chặng (yêu cầu chủ dự án 2026-10-03).
export function crumbBar(text, onBack) {
  return el("div", { class: "bb-crumb" },
    el("span", { class: "bb-crumb-text" }, text),
    el("button", { class: "btn ghost small", type: "button", onclick: onBack }, "◀ " + T.back));
}

export function imageOf(row) {
  return row?.image_path ? contentUrl(row.image_path) : null;
}
