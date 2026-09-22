import { el } from "../../ui.js";
import { T } from "../../strings.js";
import { playItem, say } from "../media.js";
import { sfx } from "../sfx.js";
import { pronunciationSupported } from "../../pronunciation.js";
import { PASS_SCORE, attemptRead } from "../pron-ui.js";
import { SKIP } from "./phonics.js";

// "Bài giao tiếp" (kỹ năng Giao tiếp, nhóm Nghe – Nói): nhiều lượt hỏi-đáp nối tiếp trong CÙNG 1 bài. Vai trò từng dòng
// theo VỊ TRÍ (không có cột riêng, xem migration 019): dòng lẻ (1,3,5…) = hệ thống nói (chỉ phát âm thanh), dòng chẵn
// (2,4,6…) = bé đọc câu trả lời có sẵn — chấm phát âm giống listen_repeat. ctx.items = MỌI dòng của bài, ĐÚNG THỨ TỰ.
function turn(ctx, ask, reply, withIntro) {
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
      try {
        const r = await attemptRead(ctx, reply, mic, feedback);
        if (r.status === "ok") {
          attempts++;
          best = Math.max(best, r.score);
          if (r.tier.stars >= 2 || attempts >= 3) showNext();
        } else if (r.status === "error") {
          skipped = true; // lỗi micro/nhận dạng: không phạt trẻ, cho đi tiếp
          showNext();
        }
      } finally {
        busy = false;
      }
    }

    const mic = pronOn
      ? el("button", { class: "mic", "aria-label": "micro", onclick: tryMic }, "🎤")
      : el("button", { class: "btn", onclick: () => { sfx.good(); resolve(true); } }, T.iSaidIt);

    ctx.box.replaceChildren(
      el("p", { class: "instr" }, T.instrDialogue),
      el("div", { class: "dialog-line dialog-ask" }, el("button", { class: "btn tiny ghost", onclick: () => playItem(ask) }, "🔊"), " ", ask.text_vi),
      el("div", { class: "dialog-line dialog-reply" }, el("b", null, T.dialogueYou + ": "), reply.text_vi),
      mic, feedback, nextBtn
    );
    (async () => { if (withIntro) await say(T.instrDialogue); await playItem(ask); })();
  });
}

export async function runDialogue(ctx) {
  const list = ctx.items;
  if (list.length < 4) return SKIP; // ít nhất 2 lượt hỏi-đáp
  let correct = 0;
  let total = 0;
  for (let i = 0; i + 1 < list.length; i += 2) {
    ctx.setProgress(total, Math.floor(list.length / 2));
    const ok = await turn(ctx, list[i], list[i + 1], i === 0);
    ctx.record(list[i + 1].id, ok);
    total++;
    if (ok) correct++;
  }
  return { correct, total };
}
