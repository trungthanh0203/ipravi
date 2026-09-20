import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { sample } from "../util.js";
import { playItem, say, visual, nativeLang, nativeLabel } from "../media.js";
import { sfx } from "../sfx.js";
import { pronunciationSupported, recognizeOnce, scorePronunciation, tier } from "../../pronunciation.js";
import { spoken } from "../../viet.js";

const PASS_SCORE = 55; // đạt để tính là "đúng" cho tiến độ; ngưỡng dễ, sẽ chỉnh sau khi thử với giọng trẻ thật
const stars = (n) => "⭐".repeat(n) + "☆".repeat(3 - n);

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
        const text = await recognizeOnce("vi-VN");
        if (!text) { feedback.textContent = T.pronNoSpeech; return; }
        attempts++;
        const score = scorePronunciation(spoken(item), text);
        best = Math.max(best, score);
        ctx.savePron(item.id, score, text);
        const t = tier(score);
        t.stars >= 2 ? sfx.star() : sfx.oops();
        feedback.replaceChildren(el("div", { class: "stars" }, stars(t.stars)), el("p", null, T.pronMsg[t.key]));
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
