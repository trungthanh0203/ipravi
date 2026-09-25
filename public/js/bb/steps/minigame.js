import { el, mount as paint } from "../../ui.js";
import { T } from "../../strings.js";
import { playPath, nativeLang } from "../media.js";
import { shuffle, sample } from "../../child/util.js";

// Chặng Mini-game: KHÔNG có bảng nội dung riêng — mỗi engine tự lấy Từ vựng/Ngữ pháp/Ngữ âm/Hội thoại CÙNG BÀI
// (nhận qua tham số `steps` = TOÀN BỘ chặng của bài, do bb/runner.js truyền vào — xem KE_HOACH_TIENG_VIET_BAI_BAN.md
// mục 3 "5 engine" gốc). Admin chọn engine cho từng chặng Mini-game ở `admin/bb.js` (`config.kind`, cột jsonb có
// sẵn từ migration 022); chưa chọn hoặc chọn engine chưa cài (lật thẻ/đóng vai hội thoại — làm sau) → hiện màn chỗ
// đứng như trước. Bài không đủ dữ liệu cho engine đã chọn → tự hiện thông báo, KHÔNG lỗi (giống nguyên tắc "tự bỏ
// qua nếu bài không đủ mục phù hợp" của khu trẻ em).
const poolOf = (steps, type) => (steps ?? []).filter((s) => s.step_type === type).flatMap((s) => s.content ?? []);

function emptyOut(box, resolve) {
  paint(box, el("p", { class: "muted" }, T.bbMinigameEmpty), el("button", { class: "btn block", onclick: resolve }, T.next));
}
function doneOut(box, resolve) {
  paint(box, el("p", { class: "muted", style: "text-align:center" }, T.bbMinigameRoundDone), el("button", { class: "btn block", onclick: resolve }, T.next));
}

// ---- Ghép nghĩa: nghe 1 từ tiếng Việt → chọn đúng nghĩa (bản ngữ) trong 4 lựa chọn, nhiễu lấy từ CÁC TỪ KHÁC
// cùng bài (dựa theo trò meaning_pick bên khu trẻ em: "nghe từ Việt ↔ nghĩa bản ngữ"). ----
function meaningPick(box, resolve, steps) {
  const lang = nativeLang();
  const pool = poolOf(steps, "vocab").filter((w) => w.meaning?.[lang]);
  if (pool.length < 4) return emptyOut(box, resolve);
  const order = sample(pool, Math.min(pool.length, 8));
  let i = 0;
  round();
  function round() {
    if (i >= order.length) return doneOut(box, resolve);
    const target = order[i];
    const choices = shuffle([target, ...sample(pool.filter((w) => w.id !== target.id), 3)]);
    const feedback = el("p", { class: "pron-feedback" }, " ");
    const btns = choices.map((c) => el("button", { class: "opt", type: "button" }, el("span", { class: "opt-text" }, c.meaning[lang])));
    btns.forEach((b, idx) => b.addEventListener("click", () => {
      btns.forEach((x) => { x.disabled = true; });
      const c = choices[idx];
      feedback.textContent = c.id === target.id ? T.bbCorrect : T.bbWrong(target.meaning[lang]);
      setTimeout(() => { i++; round(); }, 900);
    }));
    paint(box,
      el("p", { class: "bb-step-dots" }, T.bbCardOf(i + 1, order.length)),
      el("div", { class: "card", style: "text-align:center" },
        el("div", { class: "bb-vocab-word" }, target.word_vi),
        el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(target.audio_path, target.word_vi) }, T.bbListen)),
      el("div", { class: "row-btns" }, ...btns), feedback);
  }
}

// ---- Phân biệt âm: nghe 1 âm trong cặp dễ nhầm (vd ch/tr) → đoán đúng âm nào, nhiễu = âm còn lại của CHÍNH cặp đó
// (dựa theo trò tone_pair bên khu trẻ em; đúng "phonics discrimination" trong 5-engine gốc). ----
function phonicsDiscrim(box, resolve, steps) {
  const pool = poolOf(steps, "phonics");
  if (pool.length === 0) return emptyOut(box, resolve);
  const order = sample(pool, Math.min(pool.length, 8));
  let i = 0;
  round();
  function round() {
    if (i >= order.length) return doneOut(box, resolve);
    const pair = order[i];
    const playA = Math.random() < 0.5;
    const target = playA ? pair.sound_a : pair.sound_b;
    const path = playA ? pair.audio_a_path : pair.audio_b_path;
    const feedback = el("p", { class: "pron-feedback" }, " ");
    const sounds = [pair.sound_a, pair.sound_b];
    const btns = sounds.map((s) => el("button", { class: "btn big", type: "button" }, s));
    btns.forEach((b, idx) => b.addEventListener("click", () => {
      btns.forEach((x) => { x.disabled = true; });
      feedback.textContent = sounds[idx] === target ? T.bbCorrect : T.bbWrong(target);
      setTimeout(() => { i++; round(); }, 900);
    }));
    paint(box,
      el("p", { class: "bb-step-dots" }, T.bbCardOf(i + 1, order.length)),
      el("div", { class: "card", style: "text-align:center" },
        el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(path, target) }, T.bbListen)),
      el("div", { class: "row-btns", style: "justify-content:center" }, ...btns), feedback);
  }
}

// ---- Xếp câu: chạm chữ theo đúng thứ tự để xếp lại 1 câu hội thoại hoặc 1 câu ví dụ ngữ pháp CÙNG BÀI (tái dùng
// ĐÚNG cơ chế orderTask() của bb/steps/writing.js — chỉ khác nguồn câu: tự tách chữ từ dữ liệu có sẵn thay vì admin
// soạn riêng cột "words"; hiện thực hoá đúng nhận xét trong tài liệu nguồn "công thức hình họa dễ số hoá thành bài
// tập kéo-thả" — đúng "sentence builder" trong 5-engine gốc). ----
function sentenceBuilder(box, resolve, steps) {
  const dialogueSentences = poolOf(steps, "dialogue").map((d) => d.line_vi);
  const grammarSentences = poolOf(steps, "grammar").flatMap((g) => (g.examples ?? []).map((e) => e.vi));
  const pool = [...new Set([...dialogueSentences, ...grammarSentences])]
    .filter((s) => (s ?? "").trim().split(/\s+/).filter(Boolean).length >= 2);
  if (pool.length === 0) return emptyOut(box, resolve);
  const order = sample(pool, Math.min(pool.length, 6));
  let i = 0;
  round();
  function round() {
    if (i >= order.length) return doneOut(box, resolve);
    const words = order[i].trim().split(/\s+/).filter(Boolean);
    const shuffled = shuffle(words);
    const chosen = [];
    const feedback = el("p", { class: "pron-feedback" }, " ");
    const chosenRow = el("div", { class: "row-btns" });
    const btns = shuffled.map((w) => {
      const b = el("button", { class: "opt", type: "button" }, el("span", { class: "opt-text" }, w));
      b.addEventListener("click", () => {
        b.disabled = true;
        chosen.push(w);
        chosenRow.append(el("span", { class: "pill" }, w));
        if (chosen.length === words.length) {
          feedback.textContent = chosen.join(" ") === words.join(" ") ? T.bbCorrect : T.bbWrong(words.join(" "));
          setTimeout(() => { i++; round(); }, 1100);
        }
      });
      return b;
    });
    paint(box, el("p", { class: "bb-step-dots" }, T.bbCardOf(i + 1, order.length)),
      el("div", { class: "card bb-task" }, el("p", { class: "muted" }, T.bbMinigameSentenceHint), chosenRow, el("div", { class: "row-btns" }, ...btns), feedback));
  }
}

// 2 engine còn lại của 5-engine gốc (lật thẻ trí nhớ, đóng vai hội thoại chấm phát âm) CHƯA cài — `config.kind`
// không khớp key nào ở đây thì rơi về màn chỗ đứng cũ.
const ENGINES = { meaning_pick: meaningPick, phonics_discrim: phonicsDiscrim, sentence_builder: sentenceBuilder };

export function run(box, step, steps) {
  return new Promise((resolve) => {
    const engine = ENGINES[step.config?.kind];
    if (!engine) {
      paint(box, el("p", { class: "muted" }, T.bbMinigamePlaceholder), el("button", { class: "btn block", onclick: resolve }, T.next));
      return;
    }
    engine(box, resolve, steps);
  });
}
