import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath, nativeLang } from "../media.js";

// Chặng Đọc hiểu: đoạn văn ngắn rồi câu hỏi trắc nghiệm. Chấm ngay tại chỗ (client), KHÔNG lưu kết quả — chưa có
// bảng tiến độ cho "Tiếng Việt Bài Bản" (GĐ 4). `answer` đếm từ 1 (cùng quy ước content_items.extra Cấp 4).
export function run(box, step) {
  return new Promise((resolve) => {
    if (!step.content) {
      paint(box, el("p", { class: "muted" }, T.bbReadingEmpty), el("button", { class: "btn block", onclick: resolve }, T.next));
      return;
    }
    const { passage, questions } = step.content;
    const lang = nativeLang();
    showPassage();

    function showPassage() {
      paint(box,
        el("p", { class: "bb-passage" }, passage.passage_vi),
        passage.passage_tr?.[lang] ? el("p", { class: "muted" }, passage.passage_tr[lang]) : null,
        el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(passage.audio_path, passage.passage_vi) }, T.bbListen),
        el("button", { class: "btn block", onclick: () => (questions.length ? showQuestion(0) : resolve()) }, T.next));
    }

    function showQuestion(i) {
      const q = questions[i];
      const feedback = el("div", { class: "pron-feedback" });
      const opts = (q.choices ?? []).map((choice, idx) => {
        const b = el("button", { class: "opt", type: "button" }, el("span", { class: "opt-text" }, choice));
        b.addEventListener("click", () => {
          opts.forEach((o) => (o.disabled = true));
          const right = idx + 1 === q.answer;
          b.classList.add(right ? "right" : "wrong");
          if (!right) opts[q.answer - 1]?.classList.add("right");
          feedback.textContent = right ? T.bbCorrect : T.bbWrong(q.choices[q.answer - 1] ?? "");
        });
        return b;
      });
      paint(box,
        el("p", { class: "bb-step-dots" }, T.bbQuestionOf(i + 1, questions.length)),
        el("p", { class: "bb-question" }, q.question_vi),
        el("div", { class: "opt-grid" }, ...opts), feedback,
        el("button", { class: "btn block", onclick: () => (i + 1 < questions.length ? showQuestion(i + 1) : resolve()) }, T.next));
    }
  });
}
