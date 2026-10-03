import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { mascotHero } from "../emoji.js";
import * as api from "./api.js";
import { pickSession, dueCount } from "./practice-core.js";
import { nextBox, dueAfter } from "./srs.js";
import { SKILLS, GROUPS, groupById } from "./skills.js";
import { playPath, imageOf, nativeLang, crumbBar } from "./media.js";
import { micButton } from "./pron.js";
import * as dialogueStep from "./steps/dialogue.js";
import * as grammarStep from "./steps/grammar.js";
import * as phonicsStep from "./steps/phonics.js";
import { gamesSection } from "./practice-games.js";
import { buildPracticeData } from "./adapter.js";

// Màn "Luyện tập" của người học: SRS từ vựng kiểu Leitner (tự đánh giá Nhớ/Quên) + ôn hội thoại/ngữ pháp/ngữ âm
// (chỉ xem lại, không chấm) — xem KE_HOACH_TIENG_VIET_BAI_BAN.md GĐ 4. Chỉ ôn mục ĐÃ GẶP QUA (bb_progress); chưa
// học bài nào thì màn này trống, không lỗi. Sau mỗi lượt CÓ màn kết quả + "Ôn lại"/"Kỹ năng khác" (khớp
// child/practice.js resultScreen — trước đó chỉ chạy 1 lượt rồi lặng lẽ quay về, không có việc tiếp theo).
const RUN_BY_TYPE = { dialogue: dialogueStep.run, grammar: grammarStep.run, phonics: phonicsStep.run };
const colorStyle = (skill) => { const g = groupById(skill.group); return `--c:${g.color};--soft:${g.soft}`; };

// `shell`: hàm bọc header/footer dùng chung của khu Bài Bản (pages/bai-ban-home.js) — CHỈ dùng ở màn lưới kỹ năng
// này (màn điều hướng chính); 1 lượt ôn cụ thể (runReviewList/runVocabReview bên dưới) giữ header riêng (khớp
// child/practice.js: shell() ở skillsScreen, KHÔNG dùng trong runSession()).
// `ctx.data`: TẢI 1 LẦN cho cả phiên Luyện tập rồi giữ trong bộ nhớ suốt các lượt (không tải lại mỗi khi quay về lưới)
// — bỏ trống ở lần gọi ĐẦU (từ bai-ban-home.js) để tự tải; các lượt sau tự truyền lại data CŨ (đã được vá tại chỗ sau mỗi
// lượt ôn/chơi — khớp cách child/practice.js giữ `ctx.data`). data = { review (ôn tập kiểu cũ), + bb/adapter.js
// buildPracticeData (catalog/byId/progress… cho trò chơi mượn từ khu Trẻ em), skillGood (huy hiệu) }.
// Bố cục: 🎮 Trò chơi luyện tập (mượn khu Trẻ em, bb/practice-games.js) TRƯỚC, rồi 🔁 Ôn tập từ đã học (4 kỹ năng riêng của Bài Bản).
let loaded = null; // { childId, at, data } — giữ 5 phút để vào/ra Luyện tập không tải lại (data được vá tại chỗ sau mỗi lượt chơi)
async function loadAll(childId) {
  if (loaded && loaded.childId === childId && Date.now() - loaded.at < 300000) return loaded.data;
  const data = await loadFresh(childId);
  loaded = { childId, at: Date.now(), data };
  return data;
}
async function loadFresh(childId) {
  const [done, skillGood] = await Promise.all([api.loadDoneContent(childId), api.loadSkillGood(childId).catch(() => new Map())]); // chưa có migration 028 → không huy hiệu, vẫn chơi
  const structure = done.steps.length ? await api.loadStructure(done) : { lessons: [], units: [], levels: [], readingQuestions: [], listeningQuestions: [] };
  return { ...buildPracticeData(done, structure), review: api.mergeReview(done), skillGood };
}

export async function showSkills(root, ctx) {
  const { childId, onBack, shell } = ctx;
  let { data } = ctx;
  if (!data) {
    paint(root, el("p", { class: "boot" }, T.loading));
    try {
      data = await loadAll(childId);
    } catch {
      shell(root, msg("err", T.bbLoadError), el("button", { class: "btn", onclick: onBack }, T.back));
      return;
    }
  }
  const catalog = data.review;
  const toSkills = () => showSkills(root, { childId, onBack, shell, data });
  const total = SKILLS.reduce((n, s) => n + catalog[s.itemType].length, 0);
  const card = (s) => {
    const items = catalog[s.itemType];
    const n = dueCount(items);
    return el("button", { class: "skill-card" + (items.length === 0 ? " off" : ""), style: colorStyle(s), disabled: items.length === 0,
      onclick: () => runSkill(root, s, items, { childId, onBack: toSkills, shell, data }) },
      el("span", { class: "sk-emoji" }, s.emoji),
      el("b", null, s.name),
      el("small", null, n > 0 ? T.bbDueCount(n) : T.bbNoDue));
  };
  shell(root,
    crumbBar(T.bbPracticeTitle, onBack),
    el("h1", { style: "text-align:center" }, T.bbPracticeTitle),
    total === 0 && !data.listenLessons.length ? el("div", { class: "card" }, el("p", { class: "muted" }, T.bbNoReview)) : [
      ...gamesSection({ root, shell, data, childId, toSkills }),
      el("h2", { style: "text-align:center;margin-top:24px" }, T.bbReviewTitle),
      ...GROUPS.map((g) => {
        const list = SKILLS.filter((s) => s.group === g.id);
        return list.length ? el("section", { class: "skill-group", style: `--c:${g.color}` }, el("h3", null, g.name),
          el("div", { class: "skill-grid" }, list.map(card))) : null;
      })]);
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
  ctx.shell(root, crumbBar(`${T.bbPracticeTitle} > ${skill.name}`, ctx.onBack), el("div", { class: "card", style: `text-align:center;${colorStyle(skill)}` },
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
  ctx.shell(root, crumbBar(`${T.bbPracticeTitle} > ${skill.name}`, ctx.onBack), el("h2", { style: "text-align:center" }, skill.emoji + " " + skill.name), box);
  await RUN_BY_TYPE[skill.itemType](box, { content: session });
  api.saveReviewBatch(childId, skill.itemType, session); // không await — ghi nền, không chặn hiện kết quả
  // Vá tại chỗ (session[i] CÙNG object với items[i]/catalog[type][i], không phải bản sao) — quay lại lưới thấy
  // đúng số "cần ôn" mới NGAY, không cần đợi mạng hay gọi lại api.loadReviewCatalog() — due_at mới tính được
  // ngay ở trình duyệt vì hoàn toàn xác định (now + REVIEW_AGAIN_DAYS), khớp đúng giá trị api.js sẽ ghi.
  const due_at = new Date(Date.now() + api.REVIEW_AGAIN_DAYS * 86_400_000).toISOString();
  session.forEach((i) => { i.due_at = due_at; i.reviewed_count = (i.reviewed_count ?? 0) + 1; });
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
    ctx.shell(root,
      crumbBar(`${T.bbPracticeTitle} > ${skill.name}`, ctx.onBack),
      el("p", { class: "bb-step-dots" }, T.bbCardOf(i + 1, session.length)),
      el("div", { class: "card bb-vocab-card" },
        img ? el("img", { class: "visual", src: img, alt: "" }) : null,
        el("div", { class: "bb-vocab-word" }, w.word_vi, w.pos ? el("span", { class: "pill" }, w.pos) : null),
        w.say_vi ? el("p", { class: "muted" }, `Đọc là: “${w.say_vi}”`) : null,
        el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(w.audio_path, spoken) }, T.bbListen),
        mic, feedback, meaning, reveal, gradeRow));

    function grade(ok) {
      if (ok) remembered++; else forgot++;
      api.saveVocabResult(childId, w, ok); // không await — ghi nền, không chặn chuyển sang thẻ kế tiếp
      // Vá tại chỗ để quay lại lưới thấy đúng số "cần ôn" mới ngay (w CÙNG object với items[i]/catalog.vocab[i]) —
      // nextBox()/dueAfter() thuần nên tính trước ở đây luôn khớp với giá trị api.js sẽ ghi, không cần đợi mạng.
      w.box = nextBox(w.box, ok);
      w.due_at = dueAfter(w.box).toISOString();
      w.reviewed_count = (w.reviewed_count ?? 0) + 1;
      i++;
      showCard();
    }
  }

  function finish() {
    resultScreen(root, skill, items, ctx, T.bbVocabResult(remembered, forgot));
  }
}
