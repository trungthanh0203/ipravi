import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { shuffle, sample, isLiteral } from "../util.js";
import { playItem, say, visual } from "../media.js";
import { sfx } from "../sfx.js";

// Nghe – chạm: nghe từ tiếng Việt rồi chọn đúng hình (mode "picture") hoặc đúng chữ (mode "text").
// Đúng ngay lần đầu = đúng; sai 2 lần thì hiện đáp án rồi sang câu kế (không phạt).
function round(ctx, pool, target, mode, withIntro) {
  return new Promise((resolve) => {
    const n = Math.min(ctx.config.choices ?? 3, pool.length);
    const opts = shuffle([target, ...sample(pool.filter((i) => i.id !== target.id), n - 1)]);
    const instr = mode === "text" ? T.instrPickText : T.instrPick;
    let mistakes = 0;
    let done = false;

    const buttons = opts.map((o) => {
      const b = el("button", { class: mode === "text" ? "opt opt-text" : "opt", onclick: () => choose(o, b) },
        mode === "text" ? o.text_vi : visual(o));
      return b;
    });

    function choose(o, b) {
      if (done || b.disabled) return;
      if (o.id === target.id) {
        done = true;
        sfx.good();
        b.classList.add("right");
        playItem(target);
        setTimeout(() => resolve(mistakes === 0), 1100);
      } else {
        mistakes++;
        sfx.oops();
        b.classList.add("wrong");
        b.disabled = true;
        if (mistakes >= 2) {
          done = true;
          buttons[opts.indexOf(target)].classList.add("right");
          playItem(target);
          setTimeout(() => resolve(false), 1500);
        } else {
          setTimeout(() => playItem(target), 500);
        }
      }
    }

    ctx.box.replaceChildren(
      el("p", { class: "instr" }, instr),
      el("button", { class: "btn ghost", onclick: () => playItem(target) }, "🔊 " + T.listenVi),
      el("div", { class: "opt-grid" }, buttons)
    );
    (async () => {
      if (withIntro) await say(instr);
      if (!done) playItem(target);
    })();
  });
}

async function play(ctx, mode) {
  // Chọn theo HÌNH chỉ dùng mục có hình đúng nghĩa (pic ≠ decor); chọn theo chữ dùng mọi mục
  const pool = mode === "picture" ? ctx.items.filter(isLiteral) : ctx.items;
  if (pool.length < 2) return { correct: 0, total: 0 };
  const rounds = Math.min(ctx.config.rounds ?? 5, pool.length);
  const targets = sample(pool, rounds);
  let correct = 0;
  for (let i = 0; i < targets.length; i++) {
    ctx.setProgress(i, targets.length);
    const ok = await round(ctx, pool, targets[i], mode, i === 0);
    ctx.record(targets[i].id, ok);
    if (ok) correct++;
  }
  return { correct, total: targets.length };
}

export const run = (ctx) => play(ctx, "picture");
export const runText = (ctx) => play(ctx, "text");
