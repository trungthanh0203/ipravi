import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath, nativeLang } from "../media.js";
import { micButton } from "../pron.js";

// Chặng Từ vựng: bảng danh sách trên-xuống-dưới (mỗi dòng 1 từ: Tiếng Việt | Loại từ | Nghe | Đọc thử | Nghĩa) —
// khác bản thẻ-lưới trước đây, đỡ tốn chỗ khi bài có nhiều từ (yêu cầu chủ dự án 2026-09-30).
export function run(box, step) {
  return new Promise((resolve) => {
    const words = step.content ?? [];
    if (words.length === 0) {
      paint(box, el("p", { class: "muted" }, T.bbVocabEmpty), el("button", { class: "btn block", onclick: resolve }, T.bbFinish));
      return;
    }
    const lang = nativeLang();
    const rows = words.map((w) => {
      const spoken = w.say_vi || w.word_vi; // chữ ĐỌC (vd "b" đọc "bờ") — dùng cho cả nghe mẫu và chấm phát âm
      const [mic, feedback] = micButton(spoken);
      return el("tr", null,
        el("td", null, w.word_vi, w.say_vi ? el("div", { class: "muted bb-vocab-say" }, `Đọc là: “${w.say_vi}”`) : null),
        el("td", null, w.pos ? el("span", { class: "pill" }, w.pos) : null),
        el("td", null, el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(w.audio_path, spoken) }, T.bbListen)),
        el("td", null, mic, feedback),
        el("td", null, w.meaning?.[lang] ?? ""));
    });
    paint(box,
      el("div", { class: "table-wrap" },
        el("table", { class: "tbl" },
          el("thead", null, el("tr", null,
            el("th", null, T.bbColWord), el("th", null, T.bbColPos), el("th", null, T.bbListen),
            el("th", null, T.bbPracticeRead), el("th", null, T.bbColMeaning))),
          el("tbody", null, ...rows))),
      el("button", { class: "btn block", onclick: resolve }, T.bbFinish));
  });
}
