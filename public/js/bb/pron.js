import { el } from "../ui.js";
import { T } from "../strings.js";
import { pronunciationSupported, recognizeDetailed, assessReading, tier } from "../pronunciation.js";

// Nút "🎤 Đọc thử" dùng lại nguyên hàm chấm phát âm của app (pronunciation.js) — CHỈ luyện tập, KHÔNG lưu kết quả:
// chưa có bảng tiến độ cho "Tiếng Việt Bài Bản" (bb_progress làm ở GĐ 4), và pronunciation_attempts khoá cứng vào
// content_items (khu trẻ em) nên không dùng lại được nguyên bảng đó cho nội dung bb_*.
export function micButton(text) {
  const feedback = el("div", { class: "pron-feedback" });
  let busy = false;
  const mic = el("button", {
    class: "mic sm", type: "button", "aria-label": T.bbMicLabel, title: T.bbMicLabel,
    onclick: async () => {
      if (busy) return;
      if (!pronunciationSupported()) { feedback.textContent = T.bbPronUnsupported; return; }
      busy = true;
      mic.classList.add("listening");
      feedback.textContent = T.bbPronListening;
      try {
        const heard = await recognizeDetailed("vi-VN");
        if (!heard.text) { feedback.textContent = T.bbPronNoSpeech; return; }
        const a = assessReading(text, heard.alts);
        const t = tier(a.score);
        feedback.textContent = T.bbPronMsg[t.key] ?? T.bbPronMsg.retry;
      } catch (e) {
        feedback.textContent = /not-allowed/.test(e.message ?? "") ? T.bbPronMicDenied : T.bbPronRetry;
      } finally {
        mic.classList.remove("listening");
        busy = false;
      }
    },
  }, "🎤");
  return [mic, feedback];
}
