import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath, speakFallback } from "../media.js";

// Chặng Ngữ âm: cặp âm dễ nhầm (vd ch/tr), nghe từng âm + ví dụ minh hoạ. Ví dụ hiện thành DANH SÁCH NÚT riêng
// từng cái (khác bản trước nối liền bằng " · ", khó bấm nghe từng ví dụ) — chưa có audio riêng từng ví dụ nên bấm
// đọc tạm bằng giọng trình duyệt (speakFallback, giống cách bb/steps/listening.js đọc từng câu).
// 1 cặp âm (2 nút nghe + các ví dụ) — dùng cả ở Luyện tập (từng thẻ có Trước/Tiếp).
export function pairCard(p) {
  return el("div", { class: "bb-phonics-pair" },
    el("div", { class: "row-btns" },
      el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(p.audio_a_path, p.sound_a) }, "🔊 " + p.sound_a),
      el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(p.audio_b_path, p.sound_b) }, "🔊 " + p.sound_b)),
    (p.examples ?? []).length ? el("div", { class: "row-btns bb-phonics-examples" },
      ...p.examples.map((ex) => el("button", { class: "btn small ghost", type: "button", onclick: () => speakFallback(ex, "vi") }, ex))) : null);
}

export function run(box, step) {
  return new Promise((resolve) => {
    const pairs = step.content ?? [];
    if (pairs.length === 0) {
      paint(box, el("p", { class: "muted" }, T.bbPhonicsEmpty), el("button", { class: "btn block", onclick: resolve }, T.bbFinish));
      return;
    }
    const rows = pairs.map((p) => pairCard(p));
    paint(box, ...rows, el("button", { class: "btn block", onclick: resolve }, T.bbFinish));
  });
}
