import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { sample, sleep } from "../util.js";
import { playItem, say, visual, playPart, loadPartAudio } from "../media.js";
import { stopAudio } from "../../audio.js";
import { spellParts } from "../../viet.js";
import { arrange } from "./reading.js";
import { SKIP } from "./phonics.js";

// Đánh vần theo từng phần: bờ – a – ba – huyền – bà. Mỗi vòng 2 bước:
//  ① Nghe – nhìn: các phần lần lượt sáng lên khi được đọc (chạm phần nào nghe phần đó);
//  ② Tự đánh vần: bé chạm các phần theo đúng thứ tự (mỗi lần chạm nghe âm đó), cuối cùng nghe cả tiếng.
// Âm của từng phần lấy từ "ngân hàng âm" (giọng người thật nếu đã thu, không thì file TTS, không thì giọng trình duyệt).
const ROLE_LABEL = { initial: "âm đầu", van: "vần", base: "tiếng", tone: "dấu", whole: "cả tiếng" };

export async function runSpellAlong(ctx) {
  const pool = ctx.items.filter((i) => (spellParts(i.text_vi)?.length ?? 0) >= 2);
  if (pool.length < 2) return SKIP;
  await loadPartAudio(); // tải sẵn ngân hàng âm (lỗi thì bỏ qua → dùng giọng trình duyệt)
  const targets = sample(pool, Math.min(ctx.config.rounds ?? 3, pool.length));
  let correct = 0;
  for (let i = 0; i < targets.length; i++) {
    ctx.setProgress(i, targets.length);
    const target = targets[i];
    const parts = spellParts(target.text_vi);
    await watch(ctx, target, parts, i === 0);
    if (!ctx.box.isConnected) return { correct, total: i };
    const ok = await selfSpell(ctx, target, parts);
    ctx.record(target.id, ok);
    if (ok) correct++;
  }
  return { correct, total: targets.length };
}

const playPartOf = (target, p) => (p.role === "whole" ? playItem(target) : playPart(p.text));

// ① Nghe – nhìn. Trả Promise khi bé bấm "Con tự đánh vần".
function watch(ctx, target, parts, first) {
  return new Promise((resolve) => {
    let run = 0;
    const tiles = parts.map((p) => el("button", { class: `spell-part role-${p.role}`, onclick: () => { run++; stopAudio(); light(p); playPartOf(target, p); } },
      el("span", { class: "sp-text" }, p.text), el("span", { class: "sp-role" }, ROLE_LABEL[p.role])));
    const light = (p) => tiles.forEach((t, k) => t.classList.toggle("on", parts[k] === p));
    async function sequence() {
      const id = ++run;
      for (const p of parts) {
        if (id !== run || !ctx.box.isConnected) return;
        light(p);
        await playPartOf(target, p);
        await sleep(250);
      }
      if (id === run) tiles.forEach((t) => t.classList.remove("on"));
    }
    ctx.box.replaceChildren(
      el("p", { class: "instr" }, T.instrSpellWatch),
      visual(target, "big"),
      el("div", { class: "spell-parts" }, tiles),
      el("div", { class: "row-btns", style: "justify-content:center" },
        el("button", { class: "btn ghost", onclick: sequence }, T.spellAgain),
        el("button", { class: "btn", onclick: () => { run++; stopAudio(); resolve(); } }, T.spellSelf)));
    (async () => { if (first) await say(T.instrSpellWatch); sequence(); })();
  });
}

// ② Tự đánh vần: xếp các phần theo đúng thứ tự.
function selfSpell(ctx, target, parts) {
  return arrange({
    ctx, instr: T.instrSpellAlong, first: false, maxMistakes: 3,
    top: [visual(target, "big")],
    tokens: parts.map((p, i) => ({ key: i, label: p.text, part: p })), expected: parts.map((_, i) => i),
    onPlace: (tk) => playPartOf(target, tk.part),
  });
}
