import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { shuffle, sample, isLiteral } from "../util.js";
import { playItem, say, visual } from "../media.js";
import { sfx } from "../sfx.js";
import { TONES, toneOf, splitSyllable, words, bare } from "../../viet.js";

// Hoạt động học vần (Cấp 3). Cách chơi chung: đúng ngay lần đầu = đúng; sai 2 lần thì hiện đáp án rồi sang câu kế (không phạt).
// Mỗi hoạt động tự bỏ qua (total 0) nếu bài không có đủ mục phù hợp — vd bài toàn chữ cái không chơi được "ghép âm + vần".
export const SKIP = { correct: 0, total: 0 };
const others = (arr, keep, n) => sample(arr.filter((x) => x !== keep), n);

// 1 lượt chọn: options = [{ key, node, cls }]; trả về Promise<boolean> (true nếu không sai lần nào).
export function pick({ ctx, instr, top, options, correct, target, intro, reveal, wide = false }) {
  return new Promise((resolve) => {
    let mistakes = 0;
    let done = false;
    const buttons = options.map((o, i) => el("button", { class: `opt ${o.cls ?? ""}`, onclick: () => choose(o, buttons[i]) }, o.node));
    const grid = el("div", { class: "opt-grid" + (wide ? " wide" : "") }, buttons);
    const finish = (ok, delay) => {
      done = true;
      if (reveal) grid.after(reveal());
      setTimeout(() => resolve(ok), delay);
    };
    function choose(o, b) {
      if (done || b.disabled) return;
      if (o.key === correct) {
        sfx.good();
        b.classList.add("right");
        if (target) playItem(target);
        finish(mistakes === 0, 1200);
      } else {
        mistakes++;
        sfx.oops();
        b.classList.add("wrong");
        b.disabled = true;
        if (mistakes >= 2) {
          buttons[options.findIndex((x) => x.key === correct)].classList.add("right");
          if (target) playItem(target);
          finish(false, 1600);
        } else if (target) setTimeout(() => playItem(target), 500);
      }
    }
    ctx.box.replaceChildren(el("p", { class: "instr" }, instr), ...top, grid);
    (async () => {
      if (intro) await say(instr);
      if (!done && target) playItem(target);
    })();
  });
}

export const listenBtn = (item) => el("button", { class: "btn ghost", onclick: () => playItem(item) }, "🔊 " + T.listenVi);

export async function rounds(ctx, pool, play) {
  if (pool.length < 2) return SKIP;
  const targets = sample(pool, Math.min(ctx.config.rounds ?? 4, pool.length));
  let correct = 0;
  for (let i = 0; i < targets.length; i++) {
    ctx.setProgress(i, targets.length);
    const ok = await play(targets[i], i === 0);
    ctx.record(targets[i].id, ok);
    if (ok) correct++;
  }
  return { correct, total: targets.length };
}

// 1) Nghe – chọn thanh: nghe 1 tiếng rồi chọn ký hiệu đúng của thanh (➖ ↗️ ↘️ ❓ 〰️ ⬇️).
export async function runTone(ctx) {
  const pool = ctx.items.filter((i) => splitSyllable(i.text_vi));
  const inLesson = [...new Set(pool.map((i) => toneOf(i.text_vi)))];
  const n = Math.min(ctx.config.choices ?? 3, TONES.length);
  return rounds(ctx, pool, (target, first) => {
    const right = toneOf(target.text_vi);
    // Đáp án nhiễu ưu tiên các thanh xuất hiện trong bài (những thanh bé đang so sánh), thiếu thì lấy thêm thanh khác
    const wrong = [...others(inLesson, right, n - 1), ...shuffle(TONES.map((t) => t.key).filter((k) => k !== right && !inLesson.includes(k)))].slice(0, n - 1);
    const options = shuffle([right, ...wrong]).map((key) => {
      const t = TONES.find((x) => x.key === key);
      return { key, cls: "opt-tone", node: [el("span", { class: "tone-sym" }, t.symbol), el("span", { class: "tone-name" }, t.name)] };
    });
    return pick({ ctx, instr: T.instrTone, top: [listenBtn(target)], options, correct: right, target, intro: first,
      reveal: () => el("p", { class: "word" }, target.text_vi) });
  });
}

const slotBox = (text, on) => el("span", { class: "slot-box" + (on ? " on" : "") }, text);
const INITIAL_FALLBACK = ["b", "m", "c", "t", "n", "l", "h", "d", "x"];
const REST_FALLBACK = ["a", "o", "e", "i", "u", "ô", "ơ", "ư"];
const withInitial = (ctx) => ctx.items.filter((i) => splitSyllable(i.text_vi)?.initial);
// 3 lựa chọn gồm đáp án đúng + nhiễu lấy từ các mục trong bài (thiếu thì lấy dự phòng)
const choicesOf = (right, pool, fallback, n) => shuffle([right, ...others([...new Set([...pool, ...fallback])].filter((x) => x !== right), right, n - 1)]);
const asOpts = (list) => list.map((k) => ({ key: k, cls: "opt-text", node: k }));

// 2) Ghép âm + vần: nghe 1 tiếng có hình, chọn âm đầu rồi chọn phần vần (kèm dấu thanh) để ghép lại.
export async function runBuild(ctx) {
  const pool = withInitial(ctx);
  const parts = pool.map((i) => splitSyllable(i.text_vi));
  return rounds(ctx, pool, async (target, first) => {
    const { initial, rest } = splitSyllable(target.text_vi);
    const head = (a, b) => [el("div", { class: "spell" }, slotBox(a, a !== "＿"), "+", slotBox(b, b !== "＿"), "=", slotBox("？", false)), visual(target, "big"), listenBtn(target)];
    const okA = await pick({ ctx, instr: T.instrBuildInitial, top: head("＿", "＿"), options: asOpts(choicesOf(initial, parts.map((p) => p.initial), INITIAL_FALLBACK, 3)), correct: initial, target: null, intro: first });
    const okB = await pick({ ctx, instr: T.instrBuildRest, top: head(initial, "＿"), options: asOpts(choicesOf(rest, parts.map((p) => p.rest), REST_FALLBACK, 3)), correct: rest, target,
      reveal: () => el("p", { class: "word" }, target.text_vi) });
    return okA && okB;
  });
}

// 3) Điền chữ còn thiếu: thấy tiếng bị thiếu âm đầu (＿à) + hình + nghe; chọn âm đầu đúng.
export async function runFill(ctx) {
  const pool = withInitial(ctx);
  const inits = pool.map((i) => splitSyllable(i.text_vi).initial);
  return rounds(ctx, pool, (target, first) => {
    const { initial, rest } = splitSyllable(target.text_vi);
    return pick({ ctx, instr: T.instrFill, top: [visual(target, "big"), el("p", { class: "word" }, "＿" + rest), listenBtn(target)],
      options: asOpts(choicesOf(initial, inits, INITIAL_FALLBACK, 3)), correct: initial, target, intro: first,
      reveal: () => el("p", { class: "word" }, target.text_vi) });
  });
}

// 4) Đọc – chạm hình: thấy chữ (từ/câu) rồi chọn đúng hình. Không phát âm trước — bé tự đọc; chọn đúng mới nghe đáp án.
export async function runRead(ctx) {
  const pool = ctx.items.filter(isLiteral); // chỉ dùng mục có hình ĐÚNG NGHĨA (pic ≠ decor)
  const n = Math.min(ctx.config.choices ?? 3, pool.length);
  return rounds(ctx, pool, (target, first) => {
    const options = shuffle([target, ...others(pool, target, n - 1)]).map((o) => ({ key: o.id, node: visual(o) }));
    return pick({ ctx, instr: T.instrRead, top: [el("p", { class: "word" }, target.text_vi)], options, correct: target.id, target, intro: first });
  });
}

// 5) Sắp xếp từ thành câu: nghe câu có hình rồi chạm các từ theo đúng thứ tự.
export async function runOrder(ctx) {
  const pool = ctx.items.filter((i) => words(i.text_vi).length >= 3);
  return rounds(ctx, pool, (target, first) => new Promise((resolve) => {
    const expected = words(target.text_vi);
    const same = (a, b) => bare(a).toLowerCase() === bare(b).toLowerCase();
    let next = 0;
    let mistakes = 0;
    const line = el("div", { class: "tiles-line" });
    let order = shuffle(expected.map((w, i) => ({ w, i })));
    for (let t = 0; t < 5 && order.every((x, k) => x.i === k); t++) order = shuffle(order); // tránh xếp sẵn đúng thứ tự
    const btns = order.map((tile) => el("button", { class: "tile-word", onclick: () => tap(tile) }, tile.w));
    const btnOf = new Map(order.map((tile, k) => [tile, btns[k]]));
    const free = () => order.filter((x) => !btnOf.get(x).disabled);
    function place(tile) {
      const b = btnOf.get(tile);
      b.disabled = true;
      b.classList.add("used");
      line.append(el("span", { class: "tile-word placed" }, tile.w));
      next++;
    }
    function tap(tile) {
      if (btnOf.get(tile).disabled) return;
      if (same(tile.w, expected[next])) {
        sfx.good();
        place(tile);
        if (next === expected.length) { playItem(target); setTimeout(() => resolve(mistakes === 0), 1400); }
        return;
      }
      mistakes++;
      sfx.oops();
      const b = btnOf.get(tile);
      b.classList.add("wrong");
      setTimeout(() => b.classList.remove("wrong"), 400);
      if (mistakes >= 3) { // sai 3 lần: tự xếp đúng rồi sang câu kế
        while (next < expected.length) place(free().find((x) => same(x.w, expected[next])));
        playItem(target);
        setTimeout(() => resolve(false), 1800);
      }
    }
    ctx.box.replaceChildren(el("p", { class: "instr" }, T.instrOrder), visual(target, "big"), listenBtn(target), line, el("div", { class: "tiles-pool" }, btns));
    (async () => { if (first) await say(T.instrOrder); playItem(target); })();
  }));
}
