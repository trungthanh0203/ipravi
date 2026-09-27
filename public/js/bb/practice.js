import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { mascotHero } from "../emoji.js";
import * as api from "./api.js";
import { pickSession, dueCount } from "./practice-core.js";
import { SKILLS, GROUPS, groupById } from "./skills.js";
import { playPath, imageOf, nativeLang } from "./media.js";
import { micButton } from "./pron.js";
import * as dialogueStep from "./steps/dialogue.js";
import * as grammarStep from "./steps/grammar.js";
import * as phonicsStep from "./steps/phonics.js";

// Màn "Luyện tập" của người học: SRS từ vựng kiểu Leitner (tự đánh giá Nhớ/Quên) + ôn hội thoại/ngữ pháp/ngữ âm
// (chỉ xem lại, không chấm) — xem KE_HOACH_TIENG_VIET_BAI_BAN.md GĐ 4. Chỉ ôn mục ĐÃ GẶP QUA (bb_progress); chưa
// học bài nào thì màn này trống, không lỗi. Sau mỗi lượt CÓ màn kết quả + "Ôn lại"/"Kỹ năng khác" (khớp
// child/practice.js resultScreen — trước đó chỉ chạy 1 lượt rồi lặng lẽ quay về, không có việc tiếp theo).
const RUN_BY_TYPE = { dialogue: dialogueStep.run, grammar: grammarStep.run, phonics: phonicsStep.run };
const colorStyle = (skill) => { const g = groupById(skill.group); return `--c:${g.color};--soft:${g.soft}`; };

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
  const card = (s) => {
    const items = catalog[s.itemType];
    const n = dueCount(items);
    return el("button", { class: "skill-card" + (items.length === 0 ? " off" : ""), style: colorStyle(s), disabled: items.length === 0,
      onclick: () => runSkill(root, s, items, { childId, onBack: () => showSkills(root, { childId, onBack }) }) },
      el("span", { class: "sk-emoji" }, s.emoji),
      el("b", null, s.name),
      el("small", null, n > 0 ? T.bbDueCount(n) : T.bbNoDue));
  };
  // Bọc trong 1 el("div") trước khi gắn vào paint() (=mount()=replaceChildren gốc): replaceChildren gốc KHÔNG tự
  // dàn phẳng mảng như el() — truyền GROUPS.map(...) trực tiếp làm 1 tham số rời sẽ ép thành chuỗi
  // "[object HTMLElement],…" hiện thẳng lên màn hình (đúng lỗi đã gặp + sửa ở admin/bb.js, xem CLAUDE.md).
  paint(root, el("div", null,
    el("button", { class: "btn ghost small", onclick: onBack }, "◀ " + T.back),
    el("h1", { style: "text-align:center" }, T.bbPracticeTitle),
    total === 0 ? el("div", { class: "card" }, el("p", { class: "muted" }, T.bbNoReview)) :
      GROUPS.map((g) => {
        const list = SKILLS.filter((s) => s.group === g.id);
        return list.length ? el("section", { class: "skill-group", style: `--c:${g.color}` }, el("h2", null, g.name),
          el("div", { class: "skill-grid" }, list.map(card))) : null;
      })));
}

function runSkill(root, skill, items, ctx) {
  const session = pickSession(items, { limit: 8 });
  if (skill.itemType === "vocab") return runVocabReview(root, skill, items, session, ctx);
  return runReviewList(root, skill, items, session, ctx);
}

// Màn kết quả CHUNG cho mọi kỹ năng (thay cho onBack() lặng lẽ trước đây): tóm tắt lượt vừa ôn + "🔁 Ôn lại" (lập
// phiên MỚI trên CÙNG kỹ năng, gọi lại runSkill với `items` — pool đầy đủ, không phải `session` vừa chơi) + "◀ Kỹ
// năng khác" (về lưới kỹ năng).
function resultScreen(root, skill, items, ctx, summary) {
  paint(root, el("div", { class: "card", style: `text-align:center;${colorStyle(skill)}` },
    mascotHero(),
    el("h1", null, T.bbSessionDone),
    el("p", null, summary),
    el("button", { class: "btn big", style: `background:${groupById(skill.group).color}`, onclick: () => runSkill(root, skill, items, ctx) }, T.bbReviewAgain),
    el("div", null, el("button", { class: "btn ghost", onclick: ctx.onBack }, T.bbOtherSkill))));
}

// Hội thoại/Ngữ pháp/Ngữ âm: tái dùng NGUYÊN renderer của chặng bài học (xem bb/steps/*.js) — chỉ khác là mục lấy
// từ nhiều bài đã học thay vì 1 chặng, và cuối cùng đánh dấu "đã ôn lại" thay vì đánh dấu tiến độ bài học.
async function runReviewList(root, skill, items, session, ctx) {
  const { childId } = ctx;
  const box = el("div", { class: "lesson-box" });
  paint(root, el("h2", { style: "text-align:center" }, skill.emoji + " " + skill.name), box);
  await RUN_BY_TYPE[skill.itemType](box, { content: session });
  api.saveReviewBatch(childId, skill.itemType, session.map((i) => i.id));
  resultScreen(root, skill, items, ctx, T.bbReviewedCount(session.length, skill.name));
}

// Từ vựng: từng thẻ 1 (chữ + nghe + đọc thử) → bấm xem nghĩa → tự đánh giá Nhớ/Quên → lưu box Leitner → thẻ kế tiếp.
function runVocabReview(root, skill, items, session, ctx) {
  const { childId } = ctx;
  const lang = nativeLang();
  let i = 0;
  let remembered = 0, forgot = 0;
  showCard();

  function showCard() {
    if (i >= session.length) return finish();
    const w = session[i];
    const img = imageOf(w);
    const meaning = el("p", { class: "muted", style: "display:none" }, w.meaning?.[lang] ?? "");
    const spoken = w.say_vi || w.word_vi;
    const [mic, feedback] = micButton(spoken);
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
        w.say_vi ? el("p", { class: "muted" }, `Đọc là: “${w.say_vi}”`) : null,
        el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(w.audio_path, spoken) }, T.bbListen),
        mic, feedback, meaning, reveal, gradeRow));

    function grade(ok) {
      if (ok) remembered++; else forgot++;
      api.saveVocabResult(childId, w.id, ok);
      i++;
      showCard();
    }
  }

  function finish() {
    resultScreen(root, skill, items, ctx, T.bbVocabResult(remembered, forgot));
  }
}
