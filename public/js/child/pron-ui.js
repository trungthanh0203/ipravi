import { el } from "../ui.js";
import { T } from "../strings.js";
import { say } from "./media.js";
import { sfx } from "./sfx.js";
import { pronunciationSupported, recognizeDetailed, assessReading, detailOf, tipOf, tier } from "../pronunciation.js";
import { spoken } from "../viet.js";

// Phần giao diện "bé đọc → chấm → phản hồi" dùng chung cho thẻ học từ mới (intro) và trò nói theo (listen-repeat).
// Chấm bằng assessReading (từng tiếng, có dấu thanh). Phản hồi cho bé: sao + từng tiếng (✓ hoặc 🔊 chạm nghe lại — không tô "sai") + 1 lời nhắc; không hiện điểm.

export const PASS_SCORE = 55; // đạt để tính là "đúng" cho tiến độ; ngưỡng dễ, sẽ chỉnh sau khi thử với giọng trẻ thật
export const stars = (n) => "⭐".repeat(n) + "☆".repeat(3 - n);

// Chấm điểm phát âm chỉ chạy khi phụ huynh đã bật (âm thanh của bé đi qua trình duyệt Google/Apple) VÀ trình duyệt hỗ trợ.
export const pronReady = (ctx) => Boolean(ctx.account?.pronunciation_enabled) && pronunciationSupported();

const syllableChips = (a) => el("div", { class: "syl-row" }, a.syllables.map((s) =>
  el("button", { class: `syl ${s.status === "ok" ? "ok" : "again"}`, type: "button", onclick: () => say(s.text) }, s.status === "ok" ? "✓ " : "🔊 ", s.text)));
const tipLine = (a) => {
  const tip = tipOf(a);
  return tip ? el("p", { class: "muted" }, T.pronTip[tip.kind](tip.word)) : null;
};

// Nghe bé đọc 1 lần và chấm. Vẽ phản hồi vào `feedback`, bật/tắt hiệu ứng nghe trên nút `mic`.
// Trả { status: "ok", score, tier, assessment } | { status: "nospeech" } | { status: "error", denied }.
export async function attemptRead(ctx, item, mic, feedback) {
  mic.classList.add("listening");
  feedback.textContent = T.pronListening;
  try {
    const heard = await recognizeDetailed("vi-VN");
    if (!heard.text) { feedback.textContent = T.pronNoSpeech; return { status: "nospeech" }; }
    const a = assessReading(spoken(item), heard.alts); // lấy phương án nhận dạng gần mẫu nhất
    ctx.savePron(item.id, a.score, a.heard, detailOf(a));
    const t = tier(a.score);
    t.stars >= 2 ? sfx.star() : sfx.oops();
    feedback.replaceChildren(...[el("div", { class: "stars" }, stars(t.stars)), el("p", null, T.pronMsg[t.key]), syllableChips(a), tipLine(a)].filter(Boolean));
    return { status: "ok", score: a.score, tier: t, assessment: a };
  } catch (e) {
    const denied = /not-allowed/.test(e.message);
    feedback.textContent = denied ? T.pronMicDenied : T.pronRetry;
    return { status: "error", denied };
  } finally {
    mic.classList.remove("listening");
  }
}

// Nút 🎤 + khung phản hồi cho 1 mục (thẻ học từ mới). Chưa bật chấm điểm / trình duyệt chưa hỗ trợ: bấm vào sẽ được giải thích thay vì im lặng.
export function readAloudBox(ctx, item) {
  const feedback = el("div", { class: "pron-feedback" });
  let busy = false;
  const mic = el("button", { class: "mic sm", type: "button", "aria-label": T.micLabel, title: T.micLabel, onclick: async () => {
    if (busy) return;
    if (!pronunciationSupported()) { feedback.textContent = T.pronUnsupported; return; }
    if (!ctx.account?.pronunciation_enabled) { feedback.textContent = T.pronNeedParent; return; }
    busy = true;
    try { await attemptRead(ctx, item, mic, feedback); } finally { busy = false; }
  } }, "🎤");
  return [mic, feedback];
}
