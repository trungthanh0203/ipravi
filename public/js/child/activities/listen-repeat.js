import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { sample } from "../util.js";
import { playItem, say, visual, nativeLang, nativeLabel } from "../media.js";
import { sfx } from "../sfx.js";
import { pronunciationSupported, recognizeDetailed, assessReading, detailOf, tipOf, tier } from "../../pronunciation.js";
import { spoken } from "../../viet.js";

const PASS_SCORE = 55; // đạt để tính là "đúng" cho tiến độ; ngưỡng dễ, sẽ chỉnh sau khi thử với giọng trẻ thật
const stars = (n) => "⭐".repeat(n) + "☆".repeat(3 - n);

// Từng tiếng của câu mẫu: xanh ✓ = đúng; các tiếng còn lại KHÔNG bị tô "sai" — hiện 🔊 để bé chạm nghe lại tiếng đó rồi đọc lại (không phạt).
const syllableChips = (a) => el("div", { class: "syl-row" }, a.syllables.map((s) =>
  el("button", { class: `syl ${s.status === "ok" ? "ok" : "again"}`, type: "button", onclick: () => say(s.text) }, s.status === "ok" ? "✓ " : "🔊 ", s.text)));
const tipLine = (a) => {
  const tip = tipOf(a);
  return tip ? el("p", { class: "muted" }, T.pronTip[tip.kind](tip.word)) : null;
};

// Nghe – nhắc lại. Có bật chấm phát âm: trẻ nói → nhận dạng → so với mẫu → 1–3 sao. Tối đa 3 lần thử
// rồi vẫn cho đi tiếp; điểm thấp không khoá bài. Không bật/không hỗ trợ: trẻ tự nói rồi bấm "xong".
function round(ctx, item, withIntro) {
  return new Promise((resolve) => {
    const pronOn = Boolean(ctx.account.pronunciation_enabled) && pronunciationSupported();
    let attempts = 0;
    let best = 0;
    let skipped = false;
    let busy = false;

    const feedback = el("div", { class: "pron-feedback" });
    const nextBtn = el("button", { class: "btn", style: "display:none", onclick: () => resolve(skipped || best >= PASS_SCORE) }, T.next);
    const showNext = () => { nextBtn.style.display = ""; };

    async function tryMic() {
      if (busy) return;
      busy = true;
      mic.classList.add("listening");
      feedback.textContent = T.pronListening;
      try {
        const heard = await recognizeDetailed("vi-VN");
        if (!heard.text) { feedback.textContent = T.pronNoSpeech; return; }
        attempts++;
        const a = assessReading(spoken(item), heard.alts); // lấy phương án nhận dạng gần mẫu nhất
        const score = a.score;
        best = Math.max(best, score);
        ctx.savePron(item.id, score, a.heard, detailOf(a));
        const t = tier(score);
        t.stars >= 2 ? sfx.star() : sfx.oops();
        feedback.replaceChildren(...[el("div", { class: "stars" }, stars(t.stars)), el("p", null, T.pronMsg[t.key]), syllableChips(a), tipLine(a)].filter(Boolean));
        if (t.stars >= 2 || attempts >= 3) showNext();
      } catch (e) {
        skipped = true; // lỗi micro/nhận dạng: không phạt trẻ, cho đi tiếp
        feedback.textContent = /not-allowed/.test(e.message) ? T.pronMicDenied : T.pronRetry;
        showNext();
      } finally {
        busy = false;
        mic.classList.remove("listening");
      }
    }

    const mic = pronOn
      ? el("button", { class: "mic", "aria-label": "micro", onclick: tryMic }, "🎤")
      : el("button", { class: "btn", onclick: () => { sfx.good(); resolve(true); } }, T.iSaidIt);

    ctx.box.replaceChildren(
      el("p", { class: "instr" }, T.instrRepeat),
      visual(item, "big"),
      el("div", { class: "word" }, item.text_vi),
      el("div", { class: "row-btns" },
        el("button", { class: "btn small", onclick: () => playItem(item) }, "🔊 " + T.listenVi),
        el("button", { class: "btn small ghost", onclick: () => playItem(item, { slow: true }) }, "🐢 " + T.listenSlow),
        el("button", { class: "btn small ghost", onclick: () => playItem(item, { lang: nativeLang() }) }, "🔊 " + nativeLabel())),
      mic, feedback, nextBtn
    );
    (async () => {
      if (withIntro) await say(T.instrRepeat);
      playItem(item);
    })();
  });
}

export async function run(ctx) {
  const rounds = Math.min(ctx.config.rounds ?? 3, ctx.items.length);
  const targets = sample(ctx.items, rounds);
  let correct = 0;
  for (let i = 0; i < targets.length; i++) {
    ctx.setProgress(i, targets.length);
    const ok = await round(ctx, targets[i], i === 0);
    ctx.record(targets[i].id, ok);
    if (ok) correct++;
  }
  return { correct, total: targets.length };
}
