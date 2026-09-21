import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { shuffle, sample, isLiteral } from "../util.js";
import { playItem, say, visual } from "../media.js";
import { sfx } from "../sfx.js";
import { POOLS } from "../pools.js";

// Ghép cặp: nối hình (cột trái) với chữ Việt (cột phải). Chạm 1 chữ là nghe đọc chữ đó,
// nên trẻ chưa biết đọc vẫn ghép được nhờ âm thanh.
export async function run(ctx) {
  const pool = POOLS.match(ctx.items); // ghép hình ↔ chữ: chỉ mục có hình đúng nghĩa
  if (pool.length < 2) return { correct: 0, total: 0 };
  const n = Math.min(ctx.config.pairs ?? 4, pool.length);
  const chosen = sample(pool, n);
  const missed = new Set();
  let matched = 0;
  let selL = null;
  let selR = null;

  await new Promise((resolve) => {
    const cell = (item, side) => {
      const b = el("button", { class: "opt", onclick: () => pick(item, side, b) },
        side === "l" ? visual(item) : el("span", { class: "match-word" }, item.text_vi));
      return b;
    };

    function pick(item, side, b) {
      if (b.disabled) return;
      if (side === "r") playItem(item);
      const cur = side === "l" ? selL : selR;
      cur?.b.classList.remove("sel");
      if (cur?.b === b) {
        if (side === "l") selL = null; else selR = null;
        return;
      }
      b.classList.add("sel");
      if (side === "l") selL = { item, b }; else selR = { item, b };
      if (!(selL && selR)) return;

      const [l, r] = [selL, selR];
      selL = selR = null;
      if (l.item.id === r.item.id) {
        sfx.good();
        for (const x of [l, r]) { x.b.classList.remove("sel"); x.b.classList.add("right"); x.b.disabled = true; }
        if (++matched === n) setTimeout(resolve, 900);
      } else {
        sfx.oops();
        missed.add(l.item.id);
        missed.add(r.item.id);
        for (const x of [l, r]) x.b.classList.add("wrong");
        setTimeout(() => { for (const x of [l, r]) x.b.classList.remove("wrong", "sel"); }, 500);
      }
    }

    ctx.setProgress(0, 1);
    ctx.box.replaceChildren(
      el("p", { class: "instr" }, T.instrMatch),
      el("div", { class: "match-grid" },
        el("div", { class: "match-col" }, shuffle(chosen).map((i) => cell(i, "l"))),
        el("div", { class: "match-col" }, shuffle(chosen).map((i) => cell(i, "r"))))
    );
    say(T.instrMatch);
  });

  for (const item of chosen) ctx.record(item.id, !missed.has(item.id));
  return { correct: n - missed.size, total: n };
}
