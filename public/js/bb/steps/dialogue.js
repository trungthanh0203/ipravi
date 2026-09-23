import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath, nativeLang } from "../media.js";
import { micButton } from "../pron.js";

// Chặng Hội thoại: hiện cả đoạn hội thoại (mỗi dòng = vai + câu + nghĩa), nghe từng dòng, đọc thử (tái dùng
// audio.js/pronunciation.js — xem KE_HOACH_TIENG_VIET_BAI_BAN.md mục 8 GĐ 3).
export function run(box, step) {
  return new Promise((resolve) => {
    const lines = step.content ?? [];
    if (lines.length === 0) {
      paint(box, el("p", { class: "muted" }, T.bbDialogueEmpty), el("button", { class: "btn block", onclick: resolve }, T.next));
      return;
    }
    const lang = nativeLang();
    const rows = lines.map((line) => {
      const [mic, feedback] = micButton(line.line_vi);
      return el("div", { class: "bb-line" },
        el("div", { class: "bb-line-head" },
          el("span", { class: "pill" }, line.speaker),
          el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(line.audio_path, line.line_vi) }, T.bbListen)),
        el("p", { class: "bb-line-vi" }, line.line_vi),
        line.line_tr?.[lang] ? el("p", { class: "muted" }, line.line_tr[lang]) : null,
        el("div", { class: "row" }, mic, feedback));
    });
    paint(box, ...rows, el("button", { class: "btn block", onclick: resolve }, T.next));
  });
}
