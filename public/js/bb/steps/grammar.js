import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { nativeLang } from "../media.js";

// Chặng Ngữ pháp: "công thức hình họa" (vd "Chào + đại từ") + vài câu ví dụ. Không cần âm thanh/chấm phát âm.
export function run(box, step) {
  return new Promise((resolve) => {
    const points = step.content ?? [];
    if (points.length === 0) {
      paint(box, el("p", { class: "muted" }, T.bbGrammarEmpty), el("button", { class: "btn block", onclick: resolve }, T.next));
      return;
    }
    const lang = nativeLang();
    const cards = points.map((g) => el("div", { class: "card bb-grammar-card" },
      el("p", { class: "bb-formula" }, g.formula),
      g.formula_tr?.[lang] ? el("p", { class: "muted" }, g.formula_tr[lang]) : null,
      (g.examples ?? []).length ? el("ul", { class: "bb-examples" },
        (g.examples ?? []).map((ex) => el("li", null, el("span", null, ex.vi), ex.tr?.[lang] ? el("span", { class: "muted" }, " — " + ex.tr[lang]) : null))) : null));
    paint(box, ...cards, el("button", { class: "btn block", onclick: resolve }, T.next));
  });
}
