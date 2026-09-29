import { el } from "../../ui.js";
import { T } from "../../strings.js";

// Khối câu hỏi trắc nghiệm DÙNG CHUNG cho Luyện đọc + Luyện nghe (kiểu iLapra — khác bản trước hiện từng câu một:
// giờ hiện HẾT câu hỏi cùng lúc, 1 nút "Kiểm tra" chấm hết, tô đúng/sai + hiện điểm, rồi "Làm lại"/"Hoàn thành").
// `onRetry` vẽ lại TOÀN BỘ màn (kể cả phần trên quiz, vd đoạn văn/nút nghe) — quiz không tự giữ trạng thái riêng
// qua các lần "Làm lại", đơn giản hơn là vá lại từng ô đã chọn.
export function quizBlock(questions, resolve, onRetry) {
  const picks = new Array(questions.length).fill(null);
  const score = el("p", { class: "bb-quiz-score" });
  const qBlocks = questions.map((q, qi) => {
    const feedback = el("p", { class: "pron-feedback" });
    const opts = (q.choices ?? []).map((choice, ci) => {
      const b = el("button", { class: "opt", type: "button" }, el("span", { class: "opt-text" }, choice));
      b.addEventListener("click", () => {
        if (b.disabled) return;
        opts.forEach((o) => o.classList.remove("sel"));
        b.classList.add("sel");
        picks[qi] = ci + 1;
      });
      return b;
    });
    return { row: el("div", { class: "card bb-task" }, el("p", { class: "bb-question" }, `${qi + 1}. ${q.question_vi}`), el("div", { class: "opt-grid" }, ...opts), feedback), opts, feedback };
  });
  const finishRow = el("div", { class: "row-btns", style: "display:none" },
    el("button", { class: "btn small ghost", type: "button", onclick: onRetry }, T.bbRetry),
    el("button", { class: "btn block", onclick: resolve }, T.bbFinish));
  const checkBtn = el("button", {
    class: "btn block", type: "button",
    onclick: () => {
      let correct = 0;
      questions.forEach((q, qi) => {
        const { opts, feedback } = qBlocks[qi];
        opts.forEach((o) => { o.disabled = true; });
        const picked = picks[qi];
        const right = picked === q.answer;
        if (right) correct++;
        if (picked != null) opts[picked - 1].classList.add(right ? "right" : "wrong");
        if (!right) opts[q.answer - 1].classList.add("right");
        feedback.textContent = right ? T.bbCorrect : T.bbWrong(q.choices[q.answer - 1] ?? "");
      });
      score.textContent = T.bbScoreOf(correct, questions.length);
      checkBtn.style.display = "none";
      finishRow.style.display = "";
    },
  }, T.bbCheckAnswer);
  return [...qBlocks.map((b) => b.row), checkBtn, score, finishRow];
}
