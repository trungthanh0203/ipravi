import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath, speakFallback } from "../media.js";
import { quizBlock } from "./quiz.js";

// Chặng Luyện nghe: mirror Luyện đọc (bb_listening_passages/_questions cùng hình dạng bb_reading_*) nhưng KHÔNG
// hiện chữ đoạn văn — chỉ nghe "cả đoạn" (audio_path thật nếu có, chưa có thì đọc tạm bằng giọng trình duyệt) hoặc
// TỪNG CÂU (tách từ passage_vi lúc chạy, luôn bằng giọng trình duyệt vì chưa có audio riêng từng câu — kiểu iLapra).
function splitSentences(text) {
  return String(text ?? "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function run(box, step) {
  return new Promise((resolve) => {
    if (!step.content) {
      paint(box, el("p", { class: "muted" }, T.bbListeningEmpty), el("button", { class: "btn block", onclick: resolve }, T.bbFinish));
      return;
    }
    const { passage, questions } = step.content;
    const sentences = splitSentences(passage.passage_vi);
    render();

    function render() {
      const sentBtns = sentences.map((s, i) =>
        el("button", { class: "btn small ghost", type: "button", onclick: () => speakFallback(s, "vi") }, T.bbListenSentence(i + 1)));
      paint(box,
        el("button", { class: "btn small", type: "button", onclick: () => playPath(passage.audio_path, passage.passage_vi) }, T.bbListenFull),
        el("div", { class: "row-btns" }, ...sentBtns),
        ...(questions.length ? quizBlock(questions, resolve, render) : [el("button", { class: "btn block", onclick: resolve }, T.bbFinish)]));
    }
  });
}
