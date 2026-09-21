import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { shuffle, sample, isLiteral, childAge } from "../util.js";
import { playItem, say, visual, nativeLabel } from "../media.js";
import { sfx } from "../sfx.js";
import { emojiNodes } from "../../emoji.js";
import { spellingChoices } from "../../viet.js";
import { pick, listenBtn, rounds, SKIP } from "./phonics.js";
import { POOLS, meaningIn, sortGroups, toneGroups } from "../pools.js";

// Trò CHỈ có ở Luyện tập (không nằm trong bảng `activities` của bài học): chạy trên tập mục gộp từ nhiều bài/chủ đề.
// Cùng luật chung: đúng ngay lần đầu = đúng; sai 2 lần thì hiện đáp án rồi sang lượt kế (không phạt, không hiện "sai").
const shown = (...nodes) => nodes.filter(Boolean);

// 1) Hiểu nghĩa: 2 chiều xen kẽ. ① nghe/thấy từ Việt → chọn NGHĨA bản ngữ; ② thấy nghĩa bản ngữ → chọn từ Việt (không phát âm trước).
export async function runMeaning(ctx) {
  const lang = ctx.lang;
  const pool = POOLS.meaning_pick(ctx.items, { lang });
  if (pool.length < 3) return SKIP;
  return rounds(ctx, pool, (target, first) => {
    const n = Math.min(ctx.config.choices ?? 3, pool.length);
    const mine = meaningIn(target, lang);
    const others = sample(pool.filter((i) => i.id !== target.id && meaningIn(i, lang).toLowerCase() !== mine.toLowerCase()), n - 1);
    if (Math.random() < 0.5) {
      const options = shuffle([target, ...others]).map((o) => ({ key: o.id, cls: "opt-text", node: meaningIn(o, lang) }));
      return pick({ ctx, instr: T.instrMeaningToNative(nativeLabel()), top: shown(isLiteral(target) ? visual(target, "big") : null, el("p", { class: "word" }, target.text_vi), listenBtn(target)),
        options, correct: target.id, target, intro: first });
    }
    const options = shuffle([target, ...others]).map((o) => ({ key: o.id, cls: "opt-text", node: o.text_vi }));
    const nativeBtn = el("button", { class: "btn ghost", onclick: () => playItem(target, { lang }) }, "🔊 " + nativeLabel());
    return pick({ ctx, instr: T.instrMeaningToVi, top: shown(el("p", { class: "word" }, mine), nativeBtn),
      options, correct: target.id, target, intro: first, quiet: true });
  });
}

// 2) Nghe – chọn đúng thanh: nhóm tiếng cùng gốc (ma má mà mả mã mạ). Nghe 1 tiếng rồi chọn đúng CHỮ giữa các tiếng chỉ khác thanh.
export async function runTonePair(ctx) {
  const groups = [...toneGroups(ctx.items).values()];
  const pool = groups.flat();
  return rounds(ctx, pool, (target, first) => {
    const group = groups.find((g) => g.includes(target));
    const options = shuffle([target, ...sample(group.filter((x) => x !== target), 2)]).map((o) => ({ key: o.id, cls: "opt-text", node: o.text_vi }));
    return pick({ ctx, instr: T.instrTonePair, top: [listenBtn(target)], options, correct: target.id, target, intro: first });
  });
}

// 3) Chính tả: nghe + xem hình rồi chọn cách viết đúng giữa các bản hay nhầm (ch/tr, s/x, d/gi/r, l/n, c/k, g/gh, ng/ngh).
export async function runSpelling(ctx) {
  const pool = POOLS.pick_spelling(ctx.items);
  return rounds(ctx, pool, (target, first) => {
    const ch = spellingChoices(target.text_vi);
    const options = shuffle([ch.right, ...ch.wrongs]).map((k) => ({ key: k, cls: "opt-text", node: k }));
    return pick({ ctx, instr: T.instrSpelling, top: shown(isLiteral(target) ? visual(target, "big") : null, listenBtn(target)), options, correct: ch.right, target, intro: first });
  });
}

// 4) Phân loại: mỗi CHỦ ĐỀ là 1 giỏ (2 giỏ; 3 giỏ cho bé ≥ 6 tuổi). Thấy hình + nghe từ rồi chạm giỏ đúng.
export async function runSort(ctx) {
  const groups = sortGroups(ctx.items);
  if (groups.size < 2) return SKIP;
  const age = childAge(ctx.child);
  const k = age != null && age >= 6 && groups.size >= 3 ? 3 : 2;
  const units = sample([...groups.keys()], k);
  const total = Math.min(ctx.config.rounds ?? 6, units.reduce((a, u) => a + groups.get(u).length, 0));
  const per = Math.ceil(total / k);
  const cards = shuffle(units.flatMap((u) => sample(groups.get(u), per))).slice(0, total);
  const unitOf = new Map(units.map((u) => [u, groups.get(u)[0].unit ?? { id: u, title_vi: "", emoji: "📦" }]));
  const buckets = units.map((u) => ({ key: u, cls: "opt-bucket", node: [visual(unitOf.get(u)), el("span", { class: "bucket-name" }, unitOf.get(u).title_vi)] }));
  const wantText = age == null || age >= 5;
  let correct = 0;
  for (let i = 0; i < cards.length; i++) {
    ctx.setProgress(i, cards.length);
    const item = cards[i];
    const ok = await pick({ ctx, instr: T.instrSort, top: shown(visual(item, "big"), wantText ? el("p", { class: "word" }, item.text_vi) : null, listenBtn(item)),
      options: shuffle(buckets), correct: item.unit_id, target: item, intro: i === 0 });
    ctx.record(item.id, ok);
    if (ok) correct++;
  }
  return { correct, total: cards.length };
}

// 5) Trí nhớ: lật thẻ tìm cặp. Bé ≥ 5 tuổi: cặp hình ↔ chữ; bé nhỏ hơn: cặp hình ↔ hình (chạm thẻ nào nghe từ đó). Không giới hạn số lần lật.
export async function runMemory(ctx) {
  const pool = POOLS.memory_flip(ctx.items);
  if (pool.length < 3) return SKIP;
  const age = childAge(ctx.child);
  const young = age != null && age < 5;
  const n = Math.min(ctx.config.pairs ?? (young ? 3 : 4), pool.length);
  const chosen = sample(pool, n);
  const missed = new Set();
  let open = [];
  let locked = false;
  let matched = 0;
  const cards = shuffle(chosen.flatMap((item) => [{ item, word: false }, { item, word: !young }]));
  const faces = new Map();

  await new Promise((resolve) => {
    const buttons = cards.map((c) => {
      const b = el("button", { class: "mem-card", "aria-label": T.memoryCard, onclick: () => flip(c, b) },
        el("span", { class: "mem-back" }, ...emojiNodes("🐓")),
        el("span", { class: "mem-face" }, c.word ? el("span", { class: "mem-word" }, c.item.text_vi) : visual(c.item)));
      faces.set(c, b);
      return b;
    });
    function flip(c, b) {
      if (locked || b.classList.contains("open") || b.classList.contains("done")) return;
      b.classList.add("open");
      playItem(c.item);
      open.push(c);
      if (open.length < 2) return;
      const [a, d] = open;
      open = [];
      if (a.item.id === d.item.id) {
        sfx.good();
        for (const x of [a, d]) faces.get(x).classList.add("done");
        if (++matched === n) setTimeout(resolve, 1000);
      } else {
        sfx.oops();
        missed.add(a.item.id);
        missed.add(d.item.id);
        locked = true;
        setTimeout(() => { for (const x of [a, d]) faces.get(x).classList.remove("open"); locked = false; }, 1100);
      }
    }
    ctx.setProgress(0, 1);
    ctx.box.replaceChildren(el("p", { class: "instr" }, T.instrMemory),
      el("div", { class: "mem-grid", style: `--cols:${cards.length <= 6 ? 3 : 4}` }, buttons));
    say(T.instrMemory);
  });

  for (const item of chosen) ctx.record(item.id, !missed.has(item.id));
  return { correct: n - missed.size, total: n };
}
