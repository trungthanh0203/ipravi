import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath, imageOf, nativeLang } from "../media.js";
import { micButton } from "../pron.js";

// Chặng Từ vựng: thẻ chữ + loại từ + nghĩa + hình (nếu có) + nghe + đọc thử, cho từng từ trong chặng.
export function run(box, step) {
  return new Promise((resolve) => {
    const words = step.content ?? [];
    if (words.length === 0) {
      paint(box, el("p", { class: "muted" }, T.bbVocabEmpty), el("button", { class: "btn block", onclick: resolve }, T.next));
      return;
    }
    const lang = nativeLang();
    const cards = words.map((w) => {
      const img = imageOf(w);
      const [mic, feedback] = micButton(w.word_vi);
      return el("div", { class: "bb-vocab-card" },
        img ? el("img", { class: "visual", src: img, alt: "" }) : null,
        el("div", { class: "bb-vocab-word" }, w.word_vi, w.pos ? el("span", { class: "pill" }, w.pos) : null),
        w.meaning?.[lang] ? el("p", { class: "muted" }, w.meaning[lang]) : null,
        el("div", { class: "row" },
          el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(w.audio_path, w.word_vi) }, T.bbListen),
          mic),
        feedback);
    });
    paint(box, el("div", { class: "bb-vocab-grid" }, ...cards), el("button", { class: "btn block", onclick: resolve }, T.next));
  });
}
