import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath } from "../media.js";

// Chặng Ngữ âm: cặp âm dễ nhầm (vd ch/tr), nghe từng âm + ví dụ minh hoạ.
export function run(box, step) {
  return new Promise((resolve) => {
    const pairs = step.content ?? [];
    if (pairs.length === 0) {
      paint(box, el("p", { class: "muted" }, T.bbPhonicsEmpty), el("button", { class: "btn block", onclick: resolve }, T.next));
      return;
    }
    const rows = pairs.map((p) => el("div", { class: "bb-phonics-pair" },
      el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(p.audio_a_path, p.sound_a) }, "🔊 " + p.sound_a),
      el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(p.audio_b_path, p.sound_b) }, "🔊 " + p.sound_b),
      (p.examples ?? []).length ? el("p", { class: "muted" }, (p.examples ?? []).join(" · ")) : null));
    paint(box, ...rows, el("button", { class: "btn block", onclick: resolve }, T.next));
  });
}
