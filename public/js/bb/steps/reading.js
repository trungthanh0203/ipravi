import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath, nativeLang } from "../media.js";
import { quizBlock } from "./quiz.js";

// Chặng Luyện đọc: hiện NGUYÊN đoạn văn + TẤT CẢ câu hỏi cùng lúc (kiểu iLapra, xem quiz.js) — KHÔNG lưu kết quả
// (chưa có bảng tiến độ riêng cho chặng này, xem GĐ 4).
export function run(box, step) {
  return new Promise((resolve) => {
    if (!step.content) {
      paint(box, el("p", { class: "muted" }, T.bbReadingEmpty), el("button", { class: "btn block", onclick: resolve }, T.bbFinish));
      return;
    }
    const { passage, questions } = step.content;
    const lang = nativeLang();
    render();

    function render() {
      paint(box,
        el("p", { class: "bb-passage" }, passage.passage_vi),
        passage.passage_tr?.[lang] ? el("p", { class: "muted" }, passage.passage_tr[lang]) : null,
        el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(passage.audio_path, passage.passage_vi) }, T.bbListen),
        ...(questions.length ? quizBlock(questions, resolve, render) : [el("button", { class: "btn block", onclick: resolve }, T.bbFinish)]));
    }
  });
}
