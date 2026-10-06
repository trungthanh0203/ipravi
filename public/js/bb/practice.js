import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { mascotHero } from "../emoji.js";
import * as api from "./api.js";
import { dueCount, sampleReview, pickLessonGroup } from "./practice-core.js";
import { nextBox, dueAfter } from "./srs.js";
import { SKILLS, GROUPS, groupById } from "./skills.js";
import { playPath, imageOf, nativeLang, crumbBar } from "./media.js";
import { micButton } from "./pron.js";
import { lineCard } from "./steps/dialogue.js";
import { grammarCard } from "./steps/grammar.js";
import { pairCard } from "./steps/phonics.js";
import { gamesSection, scopeBar } from "./practice-games.js";
import { scopeReview, isWeakReview } from "./adapter.js";
import { buildPracticeData } from "./adapter.js";

// Màn "Luyện tập" của người học: SRS từ vựng kiểu Leitner (tự đánh giá Nhớ/Quên) + ôn hội thoại/ngữ pháp/ngữ âm
// (chỉ xem lại, không chấm) — xem KE_HOACH_TIENG_VIET_BAI_BAN.md GĐ 4. Chỉ ôn mục ĐÃ GẶP QUA (bb_progress); chưa
// học bài nào thì màn này trống, không lỗi. Sau mỗi lượt CÓ màn kết quả + "Ôn lại"/"Kỹ năng khác" (khớp
// child/practice.js resultScreen — trước đó chỉ chạy 1 lượt rồi lặng lẽ quay về, không có việc tiếp theo).
// Thẻ của 3 loại không chấm (mỗi mục 1 thẻ, dùng lại renderer của chặng bài học); từ vựng có thẻ riêng (xem vocabCard).
const CARD_OF = { dialogue: lineCard, grammar: grammarCard, phonics: (row) => pairCard(row) };
const colorStyle = (skill) => { const g = groupById(skill.group); return `--c:${g.color};--soft:${g.soft}`; };

// `shell`: hàm bọc header/footer dùng chung của khu Bài Bản (pages/bai-ban-home.js) — CHỈ dùng ở màn lưới kỹ năng
// này (màn điều hướng chính); 1 lượt ôn cụ thể (runReviewList/runVocabReview bên dưới) giữ header riêng (khớp
// child/practice.js: shell() ở skillsScreen, KHÔNG dùng trong runSession()).
// `ctx.data`: TẢI 1 LẦN cho cả phiên Luyện tập rồi giữ trong bộ nhớ suốt các lượt (không tải lại mỗi khi quay về lưới)
// — bỏ trống ở lần gọi ĐẦU (từ bai-ban-home.js) để tự tải; các lượt sau tự truyền lại data CŨ (đã được vá tại chỗ sau mỗi
// lượt ôn/chơi — khớp cách child/practice.js giữ `ctx.data`). data = { review (ôn tập kiểu cũ), + bb/adapter.js
// buildPracticeData (catalog/byId/progress… cho trò chơi mượn từ khu Trẻ em), skillGood (huy hiệu) }.
// Bố cục: 🎮 Trò chơi luyện tập (mượn khu Trẻ em, bb/practice-games.js) TRƯỚC, rồi 🔁 Ôn tập từ đã học (4 kỹ năng riêng của Bài Bản).
let loaded = null; // { childId, at, promise } — giữ 5 phút để vào/ra Luyện tập không tải lại (data được vá tại chỗ sau mỗi lượt chơi); lưu PROMISE nên 2 nơi gọi cùng lúc (warmPractice + mở màn) chỉ tải 1 lần
function loadAll(childId) {
  if (loaded && loaded.childId === childId && Date.now() - loaded.at < 300000) return loaded.promise;
  const promise = loadFresh(childId);
  const mine = { childId, at: Date.now(), promise };
  loaded = mine;
  promise.catch(() => { if (loaded === mine) loaded = null; }); // lỗi thì lần sau tải lại
  return promise;
}
// Nạp sẵn dữ liệu Luyện tập lúc rảnh (gọi ở màn Home) → bấm "Luyện tập" là hiện ngay.
export const warmPractice = (childId) => { loadAll(childId).catch(() => {}); };
async function loadFresh(childId) {
  const [done, skillGood] = await Promise.all([api.loadDoneContent(childId), api.loadSkillGood(childId).catch(() => new Map())]); // chưa có migration 028 → không huy hiệu, vẫn chơi
  const structure = done.steps.length ? await api.loadStructure(done) : { lessons: [], units: [], levels: [], readingQuestions: [], listeningQuestions: [] };
  const built = buildPracticeData(done, structure);
  const review = api.mergeReview(done);
  for (const rows of Object.values(review)) for (const r of rows) Object.assign(r, built.stepWhere.get(r.step_id) ?? { unit_id: null, bbLevel: null }); // để lọc theo cấp/chủ đề
  return { ...built, review, skillGood };
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
      onclick: () => runCards(root, s, items, { childId, onBack: toSkills, shell, data }) },
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

// Màn kết quả CHUNG cho mọi kỹ năng ôn: tóm tắt lượt vừa ôn + "🔁 Ôn lại" (`again()` = mở lại ĐÚNG bộ lọc vừa dùng) + "◀ Kỹ năng khác".
function resultScreen(root, skill, ctx, summary, again) {
  ctx.shell(root, crumbBar(`${T.bbPracticeTitle} > ${skill.name}`, ctx.onBack), el("div", { class: "card", style: `text-align:center;${colorStyle(skill)}` },
    mascotHero(),
    el("h1", null, T.bbSessionDone),
    el("p", null, summary),
    el("button", { class: "btn big", style: `background:${groupById(skill.group).color}`, onclick: again }, T.bbReviewAgain),
    el("div", null, el("button", { class: "btn ghost", onclick: ctx.onBack }, T.bbOtherSkill))));
}

// Từ vựng: thẻ chữ + [🔊 Nghe][🎤 Đọc thử] liền kề + "Xem nghĩa". Đã bấm xem nghĩa mà KHÔNG bấm "Nhớ rồi" = quên (tự ghi khi rời thẻ);
// chưa xem nghĩa mà sang thẻ khác = bỏ qua (không ghi). `state` = { revealed:Set, graded:Map(idx → true|false), grade(idx, ok) }.
function vocabCard(w, i, state) {
  const lang = nativeLang();
  const img = imageOf(w);
  const spoken = w.say_vi || w.word_vi;
  const [mic, feedback] = micButton(spoken);
  const done = state.graded.get(i);
  const meaning = el("p", { class: "muted bb-meaning", style: state.revealed.has(i) ? "" : "display:none" }, w.meaning?.[lang] || "—");
  const known = el("button", { class: "btn", type: "button", style: "display:none", onclick: () => state.grade(i, true) }, T.bbRemembered);
  const reveal = el("button", {
    class: "btn", type: "button",
    onclick: () => { state.revealed.add(i); meaning.style.display = ""; reveal.style.display = "none"; known.style.display = ""; },
  }, T.bbReveal);
  if (state.revealed.has(i) || done !== undefined) { reveal.style.display = "none"; if (done === undefined) known.style.display = ""; }
  return el("div", { class: "card bb-vocab-card" },
    img ? el("img", { class: "visual", src: img, alt: "" }) : null,
    el("div", { class: "bb-vocab-word" }, w.word_vi, w.pos ? el("span", { class: "pill" }, w.pos) : null),
    w.say_vi ? el("p", { class: "muted" }, `Đọc là: “${w.say_vi}”`) : null,
    el("div", { class: "row-btns" }, el("button", { class: "btn small ghost", type: "button", onclick: () => playPath(w.audio_path, spoken) }, T.bbListen), mic),
    feedback, meaning, reveal, known,
    done === true ? el("p", null, el("span", { class: "pill good" }, T.bbRemembered)) : done === false ? el("p", null, el("span", { class: "pill bad" }, T.bbForgotMark)) : null);
}

// Ôn 1 kỹ năng theo từng THẺ: bộ lọc "Bạn muốn luyện gì?" luôn ở trên đầu (đổi là lập lại phiên theo bộ lọc mới), thẻ ở giữa có
// nút ◀ Trước / Tiếp ▶ hai bên để chuyển tự do. Bộ lọc nhiều mục (> 30) thì lấy NGẪU NHIÊN 50% (sampleReview) thay vì 8 mục như trước.
// Từ vựng: Nhớ/Quên như trên (box Leitner); hội thoại/ngữ pháp/ngữ âm: mục nào đã được xem tới thì tính "đã ôn lại" (lưu khi xong/đổi bộ lọc/thoát).
function runCards(root, skill, items, ctx, scope = { type: "all" }) {
  const { childId } = ctx;
  const isVocab = skill.itemType === "vocab";
  const pool = scopeReview(items, scope);
  // Ngữ pháp: chỉ các điểm của MỘT bài ngẫu nhiên mỗi lượt (không trộn nhiều bài); loại khác: lấy mẫu như trước.
  const isGrammar = skill.itemType === "grammar";
  const lessonPick = isGrammar ? pickLessonGroup(pool) : null;
  const session = isGrammar ? lessonPick.items : sampleReview(pool, { shuffle: isVocab });
  let i = 0;
  let remembered = 0, forgot = 0;
  const visited = new Set(); // 3 loại không chấm: chỉ số thẻ đã xem tới
  const state = { revealed: new Set(), graded: new Map(), grade };

  function grade(idx, ok) {
    if (state.graded.has(idx)) return;
    const w = session[idx];
    state.graded.set(idx, ok);
    if (ok) remembered++; else forgot++;
    api.saveVocabResult(childId, w, ok); // không await — ghi nền, không chặn chuyển thẻ
    // Vá tại chỗ (w CÙNG object với items[i]/catalog.vocab[i]) để lưới thấy đúng số "cần ôn"/"hay sai" mới ngay, không chờ mạng.
    w.box = nextBox(w.box, ok);
    w.due_at = dueAfter(w.box).toISOString();
    w.reviewed_count = (w.reviewed_count ?? 0) + 1;
    w.correct_count = (w.correct_count ?? 0) + (ok ? 1 : 0); // khớp api.saveVocabResult
    if (ok) go(i + 1); // "Nhớ rồi" → tự sang thẻ kế
  }
  // Rời thẻ idx: từ vựng đã xem nghĩa mà chưa "Nhớ rồi" = quên; loại khác = đã xem.
  function settle(idx) {
    if (!session[idx]) return;
    if (isVocab) { if (state.revealed.has(idx) && !state.graded.has(idx)) grade(idx, false); } else visited.add(idx);
  }
  function commit() {
    if (isVocab || !visited.size) return;
    const list = [...visited].map((k) => session[k]);
    visited.clear();
    api.saveReviewBatch(childId, skill.itemType, list); // không await — ghi nền
    // Vá tại chỗ (list[k] CÙNG object với catalog) — due_at mới tính ngay ở trình duyệt, khớp giá trị api.saveReviewBatch ghi.
    const due_at = new Date(Date.now() + api.REVIEW_AGAIN_DAYS * 86_400_000).toISOString();
    list.forEach((it) => { it.due_at = due_at; it.reviewed_count = (it.reviewed_count ?? 0) + 1; it.correct_count = (it.correct_count ?? 0) + 1; });
    reviewedTotal += list.length;
  }
  let reviewedTotal = 0;
  function go(next) {
    settle(i);
    if (next >= session.length) return finish();
    i = Math.max(0, next);
    render();
  }
  function finish() {
    settle(i);
    commit();
    resultScreen(root, skill, ctx, isVocab ? T.bbVocabResult(remembered, forgot) : T.bbReviewedCount(reviewedTotal, skill.name), () => runCards(root, skill, items, ctx, scope));
  }
  const leave = (fn) => () => { settle(i); commit(); fn(); }; // thoát/đổi bộ lọc giữa chừng vẫn lưu phần đã ôn

  function render() {
    const w = session[i];
    const filter = scopeBar(ctx.data, scope, {
      weak: items.filter(isWeakReview).length,
      unitIds: [...new Set(items.map((x) => x.unit_id))],
      pick: (sc) => leave(() => runCards(root, skill, items, ctx, sc))(),
    });
    const last = i === session.length - 1;
    const nav = (label, arrow, onclick, disabled) => el("button", { class: "nav-btn", type: "button", disabled, onclick, "aria-label": label }, el("span", null, arrow), el("small", null, label));
    ctx.shell(root,
      crumbBar(`${T.bbPracticeTitle} > ${skill.name}`, leave(ctx.onBack)),
      el("div", { class: "card scope-card" }, filter,
        el("p", { class: "muted", style: "text-align:center;margin:6px 0 0" }, isGrammar ? T.bbScopeLesson(pool.length, lessonPick.lessonTitle) : T.bbScopeSession(pool.length, session.length))),
      session.length === 0
        ? el("div", { class: "card", style: "text-align:center" }, mascotHero(), el("p", null, T.bbScopeCount(0)))
        : [el("p", { class: "bb-step-dots" }, T.bbCardOf(i + 1, session.length)),
          el("div", { class: "card-nav" },
            nav(T.bbNavPrev, "◀", () => go(i - 1), i === 0),
            el("div", { class: "card-nav-body" }, isVocab ? vocabCard(w, i, state) : CARD_OF[skill.itemType](w, nativeLang())),
            nav(last ? T.bbNavDone : T.bbNavNext, last ? "✓" : "▶", () => go(i + 1), false))]);
  }
  render();
}
