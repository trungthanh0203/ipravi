import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { nativeLang } from "../media.js";

// Chặng Luyện viết: 3 dạng (task_type) — fill (điền từ, tự chấm so khớp chữ), order (xếp từ thành câu, tự chấm theo
// đúng thứ tự đã soạn), write (viết đoạn tự do, KHÔNG tự chấm — chỉ cho xem câu mẫu, vì chưa có cách chấm văn bản
// tự do đáng tin — xem quy tắc "Không dùng AI/dịch máy ở khu admin" trong CLAUDE.md, áp dụng tinh thần tương tự ở
// đây: không bịa điểm cho bài viết tự do).
const norm = (s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function promptBlock(t, lang) {
  return [el("p", { class: "bb-question" }, t.prompt_vi), t.prompt_tr?.[lang] ? el("p", { class: "muted" }, t.prompt_tr[lang]) : null];
}

function fillTask(t, lang) {
  const feedback = el("div", { class: "pron-feedback" });
  const input = el("input", { type: "text", placeholder: T.bbFillPlaceholder });
  const check = el("button", {
    class: "btn small", type: "button",
    onclick: () => {
      const right = norm(input.value) === norm(t.content?.answer);
      feedback.textContent = right ? T.bbCorrect : T.bbWrong(t.content?.answer ?? "");
    },
  }, T.bbCheckAnswer);
  return el("div", { class: "card bb-task" }, ...promptBlock(t, lang),
    t.content?.sentence ? el("p", { class: "bb-fill-sentence" }, t.content.sentence) : null,
    input, check, feedback);
}

function orderTask(t, lang) {
  const words = t.content?.words ?? [];
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const chosen = [];
  const feedback = el("div", { class: "pron-feedback" });
  const chosenRow = el("div", { class: "row-btns" });
  const buttons = shuffled.map((w) => {
    const b = el("button", { class: "opt", type: "button" }, el("span", { class: "opt-text" }, w));
    b.addEventListener("click", () => {
      b.disabled = true;
      chosen.push(w);
      chosenRow.append(el("span", { class: "pill" }, w));
      if (chosen.length === words.length) {
        const right = chosen.join(" ") === words.join(" ");
        feedback.textContent = right ? T.bbCorrect : T.bbWrong(words.join(" "));
      }
    });
    return b;
  });
  return el("div", { class: "card bb-task" }, ...promptBlock(t, lang), chosenRow, el("div", { class: "row-btns" }, ...buttons), feedback);
}

function writeTask(t, lang) {
  const ta = el("textarea", { rows: "3", placeholder: T.bbWritePlaceholder, class: "bb-write-area" });
  const sample = el("p", { class: "muted", style: "display:none" }, t.content?.sample ?? "");
  const toggle = el("button", {
    class: "btn small ghost", type: "button",
    onclick: () => {
      const showing = sample.style.display !== "none";
      sample.style.display = showing ? "none" : "";
      toggle.textContent = showing ? T.bbShowSample : T.bbHideSample;
    },
  }, T.bbShowSample);
  return el("div", { class: "card bb-task" }, ...promptBlock(t, lang),
    t.content?.min_words ? el("p", { class: "muted" }, T.bbMinWords(t.content.min_words)) : null,
    ta, t.content?.sample ? el("div", null, toggle, sample) : null);
}

export function run(box, step) {
  return new Promise((resolve) => {
    const tasks = step.content ?? [];
    if (tasks.length === 0) {
      paint(box, el("p", { class: "muted" }, T.bbWritingEmpty), el("button", { class: "btn block", onclick: resolve }, T.next));
      return;
    }
    const lang = nativeLang();
    const cards = tasks.map((t) => (t.task_type === "fill" ? fillTask(t, lang) : t.task_type === "order" ? orderTask(t, lang) : writeTask(t, lang)));
    paint(box, ...cards, el("button", { class: "btn block", onclick: resolve }, T.next));
  });
}
