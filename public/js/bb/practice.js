import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import * as api from "./api.js";
import { pickSession, dueCount } from "./practice-core.js";
import { SKILLS } from "./skills.js";
import { playPath, imageOf, nativeLang } from "./media.js";
import { micButton } from "./pron.js";
import * as dialogueStep from "./steps/dialogue.js";
import * as grammarStep from "./steps/grammar.js";
import * as phonicsStep from "./steps/phonics.js";

// Màn "Luyện tập" của người học: SRS từ vựng kiểu Leitner (tự đánh giá Nhớ/Quên) + ôn hội thoại/ngữ pháp/ngữ âm
// (chỉ xem lại, không chấm) — xem KE_HOACH_TIENG_VIET_BAI_BAN.md GĐ 4. Chỉ ôn mục ĐÃ GẶP QUA (bb_progress); chưa
// học bài nào thì màn này trống, không lỗi.
const RUN_BY_TYPE = { dialogue: dialogueStep.run, grammar: grammarStep.run, phonics: phonicsStep.run };

export async function showSkills(root, { childId, onBack }) {
  paint(root, el("p", { class: "boot" }, T.loading));
  let catalog;
  try {
    catalog = await api.loadReviewCatalog(childId);
  } catch {
    paint(root, el("div", { class: "card" }, msg("err", T.bbLoadError), el("button", { class: "btn", onclick: onBack }, T.back)));
    return;
  }
  const total = SKILLS.reduce((n, s) => n + catalog[s.itemType].length, 0);
  paint(root,
    el("button", { class: "btn ghost small", onclick: onBack }, "◀ " + T.back),
    el("h1", { style: "text-align:center" }, T.bbPracticeTitle),
    total === 0 ? el("div", { class: "card" }, el("p", { class: "muted" }, T.bbNoReview)) :
      el("div", { class: "unit-grid" }, SKILLS.map((s) => {
        const items = catalog[s.itemType];
        const n = dueCount(items);
        return el("button", { class: "unit-card", disabled: items.length === 0,
          onclick: () => runSkill(root, s, items, { childId, onBack: () => showSkills(root, { childId, onBack }) }) },
          el("span", { class: "visual emoji" }, s.emoji),
          el("span", null, s.name),
          el("span", { class: "muted" }, n > 0 ? T.bbDueCount(n) : T.bbNoDue));
      })));
}

function runSkill(root, skill, items, { childId, onBack }) {
  const session = pickSession(items, { limit: 8 });
  if (skill.itemType === "vocab") return runVocabReview(root, session, { childId, onBack });
  return runReviewList(root, skill, session, { childId, onBack });
}

// Hội thoại/Ngữ pháp/Ngữ âm: tái dùng NGUYÊN renderer của chặng bài học (xem bb/steps/*.js) — chỉ khác là mục lấy
// từ nhiều bài đã học thay vì 1 chặng, và cuối cùng đánh dấu "đã ôn lại" thay vì đánh dấu tiến độ bài học.
async function runReviewList(root, skill, session, { childId, onBack }) {
  const box = el("div", { class: "lesson-box" });
  paint(root, el("h2", { style: "text-align:center" }, skill.emoji + " " + skill.name), box);
  await RUN_BY_TYPE[skill.itemType](box, { content: session });
  api.saveReviewBatch(childId, skill.itemType, session.map((i) => i.id));
  onBack();
}

// Từ vựng: từng thẻ 1 (chữ + nghe + đọc thử) → bấm xem nghĩa → tự đánh giá Nhớ/Quên → lưu box Leitner → thẻ kế tiếp.
function runVocabReview(root, session, { childId, onBack }) {
  const lang = nativeLang();
  let i = 0;
  showCard();

  function showCard() {
    if (i >= session.length) return finish();
    const w = session[i];
    const img = imageOf(w);
    const meaning = el("p", { class: "muted", style: "display:none" }, w.meaning?.[lang] ?? "");
    const [mic, feedback] = micButton(w.word_vi);
    const gradeRow = el("div", { class: "row-btns", style: "display:none" },
      el("button", { class: "btn small ghost", type: "button", onclick: () => grade(false) }, T.bbForgot),
      el("button", { class: "btn small", type: "button", onclick: () => grade(true) }, T.bbRemembered));
    const reveal = el("button", {
      class: "btn", type: "button",
      onclick: () => { meaning.style.display = ""; gradeRow.style.display = "flex"; reveal.style.display = "none"; },
    }, T.bbReveal);
    paint(root,
      el("p", { class: "bb-step-dots" }, T.bbCardOf(i + 1, session.length)),
      el("div", { class: "card bb-vocab-card" },
        img ? el("img", { class: "visual", src: img, alt: "" }) : null,
        el("div", { class: "bb-vocab-word" }, w.word_vi, w.pos ? el("span", { class: "pill" }, w.pos) : null),
        el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(w.audio_path, w.word_vi) }, T.bbListen),
        mic, feedback, meaning, reveal, gradeRow));

    function grade(remembered) {
      api.saveVocabResult(childId, w.id, remembered);
      i++;
      showCard();
    }
  }

  function finish() {
    paint(root, el("div", { class: "card", style: "text-align:center" },
      el("h1", null, T.bbSessionDone),
      el("button", { class: "btn big", onclick: onBack }, T.next)));
  }
}
