import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { shuffle, sample } from "../util.js";
import { playItem, say, visual } from "../media.js";
import { sfx } from "../sfx.js";
import { caseParts, lookalikes, capitalIndexes, hasProperName, words, bare } from "../../viet.js";
import { pick, listenBtn, rounds, SKIP } from "./phonics.js";

// Chữ hoa. Mục chữ hoa có dạng "A a" (chữ hoa + chữ thường). Cả 3 hoạt động tự sinh từ dữ liệu có sẵn, không cần cột mới.
const pairsOf = (ctx) => ctx.items.filter((i) => caseParts(i.text_vi));

// 1) Ghép chữ hoa ↔ chữ thường. Chạm chữ nào nghe âm của chữ đó (bé chưa đọc giỏi vẫn ghép được nhờ hình dạng + âm).
export async function runMatchCase(ctx) {
  const pool = pairsOf(ctx);
  if (pool.length < 2) return SKIP;
  const chosen = sample(pool, Math.min(ctx.config.pairs ?? 4, pool.length));
  const missed = new Set();
  let matched = 0;
  let selL = null;
  let selR = null;
  await new Promise((resolve) => {
    const cell = (item, side) => {
      const p = caseParts(item.text_vi);
      const b = el("button", { class: "opt opt-text case-cell", onclick: () => choose(item, side, b) }, side === "l" ? p.upper : p.lower);
      return b;
    };
    function choose(item, side, b) {
      if (b.disabled) return;
      playItem(item);
      const cur = side === "l" ? selL : selR;
      cur?.b.classList.remove("sel");
      if (cur?.b === b) { if (side === "l") selL = null; else selR = null; return; }
      b.classList.add("sel");
      if (side === "l") selL = { item, b }; else selR = { item, b };
      if (!(selL && selR)) return;
      const [l, r] = [selL, selR];
      selL = selR = null;
      if (l.item.id === r.item.id) {
        sfx.good();
        for (const x of [l, r]) { x.b.classList.remove("sel"); x.b.classList.add("right"); x.b.disabled = true; }
        if (++matched === chosen.length) setTimeout(resolve, 900);
      } else {
        sfx.oops();
        missed.add(l.item.id); missed.add(r.item.id);
        for (const x of [l, r]) x.b.classList.add("wrong");
        setTimeout(() => { for (const x of [l, r]) x.b.classList.remove("wrong", "sel"); }, 500);
      }
    }
    ctx.setProgress(0, 1);
    ctx.box.replaceChildren(el("p", { class: "instr" }, T.instrMatchCase),
      el("div", { class: "match-grid" },
        el("div", { class: "match-col" }, shuffle(chosen).map((i) => cell(i, "l"))),
        el("div", { class: "match-col" }, shuffle(chosen).map((i) => cell(i, "r")))));
    say(T.instrMatchCase);
  });
  for (const it of chosen) ctx.record(it.id, !missed.has(it.id));
  return { correct: chosen.filter((i) => !missed.has(i.id)).length, total: chosen.length };
}

// 2) Chọn chữ tương ứng: thấy "b" chọn "B" (hoặc ngược lại) trong 3 chữ; đáp án nhiễu ưu tiên chữ HÌNH GẦN GIỐNG (B/D/P, Q/O/G…).
export async function runPickCase(ctx) {
  const pool = pairsOf(ctx);
  const all = [...new Set(pool.flatMap((i) => Object.values(caseParts(i.text_vi))))];
  return rounds(ctx, pool, (target, first) => {
    const p = caseParts(target.text_vi);
    const toUpper = Math.random() < 0.5;
    const shown = toUpper ? p.lower : p.upper;
    const right = toUpper ? p.upper : p.lower;
    const near = lookalikes(p.upper).map((u) => (toUpper ? u : u.toLowerCase()));
    const inPool = all.filter((x) => (toUpper ? x[0] === x[0].toUpperCase() : x[0] === x[0].toLowerCase()) && x !== right);
    const wrong = [...sample(near.filter((x) => inPool.includes(x)), 2), ...shuffle(inPool)].filter((x, i, a) => a.indexOf(x) === i).slice(0, 2);
    if (wrong.length < 2) wrong.push(...sample(near, 2 - wrong.length));
    const options = shuffle([right, ...wrong]).map((k) => ({ key: k, cls: "opt-text", node: k }));
    return pick({ ctx, instr: toUpper ? T.instrPickUpper : T.instrPickLower, top: [el("div", { class: "rec-text" }, shown), listenBtn(target)],
      options, correct: right, target, intro: first });
  });
}

// 3) Chạm từ cần viết hoa: câu hiện TOÀN CHỮ THƯỜNG; bé chạm các từ phải viết hoa (từ đầu câu + tên riêng), bấm "Xong". Được sửa lại 1 lần.
export async function runFixCapital(ctx) {
  const pool = ctx.items.filter((i) => words(i.text_vi).length >= 3 && hasProperName(i.text_vi));
  return rounds(ctx, pool, (target, first) => new Promise((resolve) => {
    const ws = words(target.text_vi);
    const need = new Set(capitalIndexes(target.text_vi));
    const sel = new Set();
    let tries = 0;
    const btns = ws.map((w, i) => el("button", { class: "tile-word", onclick: () => toggle(i) }, w.toLowerCase()));
    const paint = () => btns.forEach((b, i) => b.classList.toggle("placed", sel.has(i)));
    function toggle(i) {
      sel.has(i) ? sel.delete(i) : sel.add(i);
      paint();
    }
    const finish = (ok) => {
      btns.forEach((b, i) => { b.textContent = ws[i]; b.disabled = true; b.classList.toggle("placed", need.has(i)); });
      playItem(target);
      setTimeout(() => resolve(ok), 1800);
    };
    const check = () => {
      const ok = sel.size === need.size && [...sel].every((i) => need.has(i));
      if (ok) { sfx.good(); return finish(tries === 0); }
      sfx.oops();
      if (++tries >= 2) return finish(false);
      btns.forEach((b, i) => { if (sel.has(i) !== need.has(i)) { b.classList.add("wrong"); setTimeout(() => b.classList.remove("wrong"), 500); } });
    };
    ctx.box.replaceChildren(el("p", { class: "instr" }, T.instrFixCapital), visual(target, "big"), listenBtn(target),
      el("div", { class: "tiles-pool" }, btns),
      el("div", { class: "row-btns", style: "justify-content:center" }, el("button", { class: "btn", onclick: check }, T.fixDone)));
    (async () => { if (first) await say(T.instrFixCapital); playItem(target); })();
  }));
}
