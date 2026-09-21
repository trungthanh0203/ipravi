import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { shuffle, sample, isLiteral } from "../util.js";
import { playItem, say, visual } from "../media.js";
import { sfx } from "../sfx.js";
import { stopAudio } from "../../audio.js";
import { words, bare } from "../../viet.js";
import { pick, listenBtn, rounds, SKIP } from "./phonics.js";
import { POOLS, variants } from "../pools.js";

// Hoạt động Cấp 4 (đọc hiểu, chính tả, viết). Cùng luật chung: đúng ngay lần đầu = đúng; sai 2–3 lần thì hiện đáp án rồi sang câu kế (không phạt).
const same = (a, b) => bare(String(a)).toLowerCase() === bare(String(b)).toLowerCase();

// ---- Xếp thứ tự dùng chung (xếp chữ thành từ, xếp câu thành chuyện) ----
// tokens: [{ key, label, item? }]; expected: [key…] theo đúng thứ tự; extras: ô nhiễu (không thuộc đáp án). Trả Promise<boolean>.
export function arrange({ ctx, instr, top, tokens, expected, extras = [], target, first, card = false, maxMistakes = 3, onPlace }) {
  return new Promise((resolve) => {
    let next = 0;
    let mistakes = 0;
    const line = el("div", { class: "tiles-line" });
    let order = shuffle([...tokens, ...extras]);
    for (let t = 0; t < 5 && !extras.length && order.every((x, k) => x.key === expected[k]); t++) order = shuffle(order); // tránh xếp sẵn đúng
    const face = (tk) => (card ? [tk.item ? visual(tk.item) : null, el("span", null, tk.label)] : tk.label);
    const btns = order.map((tk) => el("button", { class: card ? "tile-word tile-card" : "tile-word", onclick: () => tap(tk) }, face(tk)));
    const btnOf = new Map(order.map((tk, k) => [tk, btns[k]]));
    const free = () => order.filter((x) => !btnOf.get(x).disabled);
    function place(tk) {
      const b = btnOf.get(tk);
      b.disabled = true;
      b.classList.add("used");
      line.append(el("span", { class: card ? "tile-word tile-card placed" : "tile-word placed" }, face(tk)));
      next++;
      onPlace?.(tk);
    }
    function tap(tk) {
      if (btnOf.get(tk).disabled) return;
      if (tk.key === expected[next]) {
        sfx.good();
        place(tk);
        if (next === expected.length) { if (target) playItem(target); setTimeout(() => resolve(mistakes === 0), 1300); }
        return;
      }
      mistakes++;
      sfx.oops();
      const b = btnOf.get(tk);
      b.classList.add("wrong");
      setTimeout(() => b.classList.remove("wrong"), 400);
      if (mistakes >= maxMistakes) {
        while (next < expected.length) place(free().find((x) => x.key === expected[next]));
        if (target) playItem(target);
        setTimeout(() => resolve(false), 1800);
      }
    }
    ctx.box.replaceChildren(el("p", { class: "instr" }, instr), ...top, line, el("div", { class: "tiles-pool" }, btns));
    (async () => { if (first) await say(instr); if (target) playItem(target); })();
  });
}

// 1) Đọc đoạn – trả lời câu hỏi. Đoạn = các mục thường của bài (theo thứ tự); câu hỏi = các mục type question.
export async function runQuiz(ctx) {
  const qs = ctx.questions ?? [];
  if (!qs.length || ctx.items.length < 1) return SKIP;
  let stop = false;
  const makePassage = () => el("div", { class: "passage" }, ctx.items.map((it) =>
    el("p", { class: "passage-line" }, el("button", { class: "btn tiny ghost", title: T.listenVi, onclick: () => playItem(it) }, "🔊"), " ", it.text_vi)));
  const playAll = async () => { stop = false; for (const it of ctx.items) { if (stop) break; await playItem(it); } };
  await new Promise((resolve) => {
    ctx.box.replaceChildren(el("p", { class: "instr" }, T.instrReadPassage), makePassage(),
      el("div", { class: "row-btns", style: "justify-content:center" },
        el("button", { class: "btn ghost", onclick: playAll }, T.readListenAll),
        el("button", { class: "btn", onclick: () => { stop = true; stopAudio(); resolve(); } }, T.readDone)));
    say(T.instrReadPassage);
  });
  let correct = 0;
  for (let i = 0; i < qs.length; i++) {
    ctx.setProgress(i, qs.length);
    const q = qs[i];
    const { choices, answer } = q.extra;
    const options = shuffle(choices.map((c, k) => ({ key: k, cls: "opt-text", node: c })));
    const again = el("details", { class: "passage-again" }, el("summary", null, T.readAgain), makePassage());
    const ok = await pick({ ctx, instr: T.instrQuestion, top: [el("p", { class: "word q-text" }, q.text_vi), listenBtn(q), again], options, correct: answer - 1, target: null, wide: true });
    ctx.record(q.id, ok);
    if (ok) correct++;
  }
  return { correct, total: qs.length };
}

// 2) Điền từ vào chỗ trống: bỏ 1 từ trong câu, chọn từ đúng trong 3 từ (nhiễu lấy từ các câu khác của bài).
export async function runFillWord(ctx) {
  const pool = POOLS.fill_word(ctx.items);
  const vocab = [...new Set(pool.flatMap((i) => words(i.text_vi).map((w) => bare(w).toLowerCase())).filter((w) => w.length >= 2))];
  if (vocab.length < 4) return SKIP;
  return rounds(ctx, pool, (target, first) => {
    const ws = words(target.text_vi);
    // Chỉ bỏ từ viết thường (không bỏ tên riêng/từ đầu câu) — nếu không, đáp án "viết hoa" lộ ra ngay
    const lower = ws.map((w, i) => i).filter((i) => bare(ws[i]).length >= 2 && bare(ws[i])[0] === bare(ws[i])[0].toLowerCase());
    const cand = lower.length ? lower : ws.map((w, i) => i).filter((i) => bare(ws[i]).length >= 2);
    const idx = cand[Math.floor(Math.random() * cand.length)];
    const right = bare(ws[idx]);
    const wrong = sample(vocab.filter((v) => v !== right.toLowerCase()), 2);
    const shown = ws.map((w, i) => (i === idx ? "＿＿＿" + (w.slice(bare(w).length) || "") : w)).join(" ");
    const options = shuffle([right, ...wrong]).map((k) => ({ key: k, cls: "opt-text", node: k }));
    return pick({ ctx, instr: T.instrFillWord, top: [visual(target, "big"), el("p", { class: "word" }, shown), listenBtn(target)], options, correct: right, target, intro: first,
      reveal: () => el("p", { class: "word" }, target.text_vi) });
  });
}

// 3) Chọn câu viết đúng: 1 câu đúng (viết hoa đầu câu + dấu câu) và các bản sai (quên viết hoa, thiếu/sai dấu câu).
export async function runWriteCheck(ctx) {
  const pool = POOLS.write_check(ctx.items);
  return rounds(ctx, pool, (target, first) => {
    const options = shuffle([target.text_vi, ...sample(variants(target.text_vi), 2)]).map((k) => ({ key: k, cls: "opt-text", node: k }));
    return pick({ ctx, instr: T.instrWriteCheck, top: [visual(target, "big"), listenBtn(target)], options, correct: target.text_vi, target, intro: first, wide: true });
  });
}

// 4) Chính tả: nghe + xem hình rồi xếp các chữ cái thành từ (có 2 chữ nhiễu).
export async function runSpell(ctx) {
  const pool = POOLS.spell_word(ctx.items);
  const alphabet = [...new Set(pool.flatMap((i) => [...i.text_vi.normalize("NFC").toLowerCase()]))];
  return rounds(ctx, pool, (target, first) => {
    const chars = [...target.text_vi.normalize("NFC").toLowerCase()];
    const extras = sample(alphabet.filter((c) => !chars.includes(c)), 2).map((c) => ({ key: "x:" + c, label: c }));
    return arrange({ ctx, instr: T.instrSpell, top: [visual(target, "big"), listenBtn(target)], tokens: chars.map((c) => ({ key: c, label: c })), expected: chars, extras, target, first });
  });
}

// 5) Xếp câu thành chuyện: các mục của bài (theo thứ tự đã soạn) bị xáo; bé chạm theo đúng trình tự. Mỗi lần chạm nghe câu đó.
export async function runStory(ctx) {
  const list = ctx.items.slice(0, 6);
  if (list.length < 3) return SKIP;
  ctx.setProgress(0, 1);
  const ok = await arrange({
    ctx, instr: T.instrStory, top: [], card: true, first: true, maxMistakes: 4,
    tokens: list.map((item) => ({ key: item.id, label: item.text_vi, item })), expected: list.map((i) => i.id),
    onPlace: (tk) => playItem(tk.item),
  });
  for (const it of list) ctx.record(it.id, ok);
  return { correct: ok ? 1 : 0, total: 1 };
}
