import { state } from "../state.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { stopAudio } from "../audio.js";
import { sfx } from "../child/sfx.js";
import { say, voiceToggle, playItem, prefetchItems, nativeLang, crumbBar } from "../child/media.js";
import { emojiNodes, prefetchEmoji, mascotHero } from "../emoji.js";
import { RUNNERS } from "../child/runners.js";
import { GROUPS, SKILLS, BADGES, GOOD_SCORE, groupById, badgeOf, badgeProgress } from "../child/skills.js";
import { skillPlayable, planPractice, storySkillPlayable, planStoryPractice } from "../child/practice-core.js";
import { starsFor } from "../child/lesson.js";
import * as api from "./api.js";
import { groupById as reviewGroupById } from "./skills.js";
import { srsAfter, progressRow, scopeBb } from "./adapter.js";

// "Trò chơi luyện tập" của Tiếng Việt Bài Bản — MƯỢN NGUYÊN các trò Luyện tập của khu Trẻ em (child/runners.js, pools.js,
// practice-core.js, skills.js: toàn hàm thuần/trò chỉ cần "mục" {id, text_vi, translations, content_audio…}) chạy trên nội
// dung Bài Bản người học ĐÃ HỌC XONG, đã đổi hình dạng bằng bb/adapter.js. Khác khu Trẻ em: không lưu child_progress/
// pronunciation_attempts (khoá cứng vào content_items) — kết quả từng mục ghi vào bb_srs_state (hộp Leitner = mức thuộc),
// kết quả phiên vào bb_practice_log (huy hiệu). Trò cần HÌNH (nghe-chọn-hình, ghép cặp, phân loại…) tự mờ/ẩn khi từ vựng
// chưa có ảnh. Luồng: lưới kỹ năng (bb/practice.js) → chọn phạm vi → phiên 6–8 lượt → kết quả. `ctx` = { root, shell,
// data (api + adapter.buildPracticeData), childId, toSkills }.

const groupOf = (skill) => groupById(skill.group) ?? reviewGroupById(skill.group); // nhóm trò mượn (child/skills.js) hoặc nhóm ôn tập riêng (bb/skills.js)
const colorStyle = (skill) => { const g = groupOf(skill); return `--c:${g.color};--soft:${g.soft}`; };
const btnStyle = (skill) => `background:${groupOf(skill).color}`;
const icon = (emoji) => el("span", { class: "sk-emoji" }, ...emojiNodes(emoji));
const crumbOf = (skill) => `${T.bbPracticeTitle} > ${skill.name}`;
const goodOf = (data, id) => data.skillGood?.get(id)?.good ?? 0;
const opts = () => ({ age: null, lang: nativeLang() });
const SRS_TYPES = new Set(["vocab", "grammar", "phonics", "dialogue"]);

// Kỹ năng "bài" (đọc nhớ/nghe nhớ/hội thoại) lấy từ danh sách bài; còn lại lấy từ catalog mục rời.
const storiesOf = (skill, data) => (skill.id === "converse" ? data.dialogueLessons : skill.id === "listenMemory" ? data.listenLessons : data.storyLessons);
const playable = (skill, data) => (skill.story ? storySkillPlayable(skill, storiesOf(skill, data), opts()) : skillPlayable(skill, data.catalog, opts()));

const medals = (data, id) => {
  const good = goodOf(data, id);
  const { next, remaining } = badgeProgress(good);
  return el("div", { class: "medals" },
    el("div", { class: "medal-row" }, BADGES.map((b) => el("span", { class: "medal" + (good >= b.n ? " on" : ""), title: `${b.name}: ${b.n} phiên từ ${GOOD_SCORE} điểm` }, ...emojiNodes(b.emoji)))),
    next ? el("small", { class: "muted" }, T.bbGameBadgeNext(next.name, remaining)) : null);
};

// ---- Lưới trò chơi: các nhóm (Chữ–Viết / Nghe–Nói / Vui–Nhớ) CHỈ gồm trò chơi được với nội dung đã học ----
export function gamesSection(ctx) {
  const { data } = ctx;
  const groups = GROUPS.filter((g) => !g.comingSoon).map((g) => ({ g, list: SKILLS.filter((s) => s.group === g.id && playable(s, data)) })).filter((x) => x.list.length);
  const card = (skill) => el("button", { class: "skill-card", style: colorStyle(skill), onclick: () => start(ctx, skill, { type: "all" }) }, // vào thẳng (bộ lọc nằm ngay màn "Chơi nào!")
    el("span", { class: "sk-badge" }, goodOf(data, skill.id) >= BADGES[0].n ? (badgeOf(goodOf(data, skill.id))?.emoji ?? "") : ""),
    icon(skill.emoji), el("b", null, skill.name), el("small", null, skill.desc));
  return [
    el("h2", { style: "text-align:center" }, T.bbGamesTitle),
    el("p", { class: "muted", style: "text-align:center" }, T.bbGamesHint),
    ...(groups.length ? groups.map(({ g, list }) => el("section", { class: "skill-group", style: `--c:${g.color}` }, el("h3", null, g.name), el("div", { class: "skill-grid" }, list.map(card))))
      : [el("div", { class: "card" }, el("p", { class: "muted" }, T.bbNoGames))]),
  ];
}

// ---- Bộ lọc "Bạn muốn luyện gì?" ----
// "Bạn muốn luyện gì?" (bộ lọc): chip Tất cả/Cấp/Hay sai/Chủ đề (chủ đề xếp theo cấp). Dùng ở màn chọn phạm vi của các trò chơi
// VÀ nằm trên đầu màn ôn thẻ (bb/practice.js) để đổi bộ lọc ngay khi đang học. o = { weak, unitIds, pick(scope), story? }.
export function scopeBar(data, scope, o) {
  const { weak, unitIds } = o;
  const same = (a, b) => a.type === b.type && a.level === b.level && a.unitId === b.unitId;
  const chip = (label, s, disabled = false) => el("button", { class: "chip-btn" + (same(scope, s) ? " on" : ""), type: "button", disabled, onclick: () => o.pick(s) }, label);
  // Chủ đề xếp theo từng Cấp (đúng thứ tự cấp + thứ tự chủ đề như màn Học), mỗi cấp 1 nhóm.
  const have = new Set(unitIds);
  const unitSel = scope.type === "unit"
    ? el("div", { class: "scope-units" }, ...data.levels.map((L) => {
      const list = [...data.units.values()].filter((u) => u.level_id === L.id && have.has(u.id)).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      return list.length ? el("section", { class: "scope-level" },
        el("h3", null, `${L.code}${L.name_vi ? " · " + L.name_vi : ""}`),
        el("div", { class: "scope-row" }, list.map((u) => chip(`${u.emoji ?? ""} ${u.title_vi}`.trim(), { type: "unit", unitId: u.id })))) : null;
    }))
    : null;
  return el("div", { class: "scope-bar" },
    el("h2", null, T.bbScopeTitle),
    el("div", { class: "scope-row" },
      chip("🌍 " + T.bbScopeAll, { type: "all" }),
      data.levels.map((L) => chip(T.bbScopeLevel(L.code), { type: "level", level: L.id })),
      weak == null || o.story ? null : chip("🎯 " + T.bbScopeWeak(weak), { type: "weak" }, weak === 0),
      chip("🗺️ " + T.bbScopeUnit, { type: "unit", unitId: scope.type === "unit" ? scope.unitId : undefined })),
    unitSel);
}

// Bộ lọc của 1 trò chơi (hiện ngay trên màn "Chơi nào!" và màn báo thiếu mục): đổi bộ lọc = lập lại phiên với phạm vi mới.
function filterBar(ctx, skill, scope) {
  const { data } = ctx;
  return scopeBar(data, scope, {
    weak: skill.story ? 0 : scopeBb(data.catalog, { type: "weak" }, data.progress).length,
    unitIds: skill.story ? [...new Set(storiesOf(skill, data).map((g) => g.unitId))] : [...new Set(data.catalog.map((i) => i.unit_id))],
    story: skill.story, pick: (sc) => start(ctx, skill, sc),
  });
}

// ---- Lập phiên + chạy ----
async function start(ctx, skill, scope) {
  const { data } = ctx;
  // planPractice() của khu Trẻ em tự lọc theo item.level (cấp 1–4 của họ) — ở Bài Bản phạm vi tính riêng (scopeBb) rồi đưa cả tập vào.
  const planned = skill.story
    ? planStoryPractice(skill, storiesOf(skill, data), scope, data.progress, opts())
    : planPractice(skill, scopeBb(data.catalog, scope, data.progress), { type: "all" }, data.progress, opts());
  if (!planned.ok) {
    const text = planned.reason === "noWeak" ? T.bbGameNoWeak : T.bbGameNotEnough;
    say(text);
    return ctx.shell(ctx.root,
      crumbBar(crumbOf(skill), ctx.toSkills),
      el("div", { class: "card scope-card" }, filterBar(ctx, skill, scope)),
      el("div", { class: "card", style: "text-align:center" }, mascotHero(), el("p", null, text),
        scope.type !== "all" ? el("button", { class: "btn", onclick: () => start(ctx, skill, { type: "all" }) }, T.bbGameTryAll) : null,
        el("button", { class: "btn ghost", onclick: ctx.toSkills }, T.bbOtherGame)));
  }
  await runSession(ctx, skill, scope, planned);
}

// Ghi 1 đáp án của 1 mục: cập nhật hộp Leitner trong bộ nhớ NGAY (đổi trọng số/“hay sai”/số cần ôn) rồi ghi nền lên bb_srs_state.
function recordAnswer(ctx, itemId, ok) {
  const { data, childId } = ctx;
  const item = data.byId.get(itemId);
  if (!item || !SRS_TYPES.has(item.src.type)) return; // câu hỏi/đoạn đọc-nghe không có bảng ôn
  const key = `${item.src.type}:${item.src.id}`;
  const prev = data.srsPrev.get(key);
  const row = srsAfter(prev, ok);
  data.srsPrev.set(key, { ...prev, item_type: item.src.type, item_id: item.src.id, ...row });
  for (const it of data.catalog) if (it.src.type === item.src.type && it.src.id === item.src.id) data.progress.set(it.id, progressRow({ ...row }));
  const rev = data.review?.[item.src.type]?.find((r) => r.id === item.src.id); // số "cần ôn" ở phần Ôn tập cập nhật theo
  if (rev) Object.assign(rev, { box: row.box, due_at: row.due_at, reviewed_count: row.reviewed_count, correct_count: row.correct_count });
  api.saveSrsAnswer(childId, item.src.type, item.src.id, row);
}

async function runSession(ctx, skill, scope, planned) {
  const { root, data, childId } = ctx;
  const items = planned.itemIds.map((id) => data.byId.get(id)).filter(Boolean);
  const itemById = new Map(items.map((i) => [i.id, i]));
  prefetchItems(items);
  prefetchEmoji(items.map((i) => i.emoji).filter(Boolean));

  // Cú chạm "Chơi nào" mở khoá âm thanh trên iOS trước khi phát tự động.
  const g = groupById(skill.group);
  await new Promise((resolve) =>
    ctx.shell(root,
      crumbBar(crumbOf(skill), ctx.toSkills),
      el("div", { class: "card scope-card" }, filterBar(ctx, skill, scope)),
      el("div", { class: "card", style: `text-align:center;${colorStyle(skill)}` },
        icon(skill.emoji), el("h1", null, skill.name), el("p", { class: "muted" }, skill.desc), medals(data, skill.id),
        el("button", { class: "btn big", style: `background:${g.color}`, onclick: resolve }, "▶ " + T.bbPlay))));
  say(T.practiceStartSay(skill.name));

  let aborted = false;
  let abort;
  const abortP = new Promise((r) => (abort = r));
  const dots = Array.from({ length: planned.turns }, () => el("span", { class: "dot" }));
  const box = el("div", { class: "lesson-box" });
  const paintDots = (n) => dots.forEach((d, i) => d.classList.toggle("on", i < n));
  paint(root, el("div", { style: `--c:${g.color};--soft:${g.soft}` },
    crumbBar(crumbOf(skill), () => { aborted = true; stopAudio(); abort(); ctx.toSkills(); }),
    el("div", { class: "row lesson-head" }, el("div", { class: "ribbon" }, icon(skill.emoji)), voiceToggle()),
    el("div", { class: "dots-row" }, el("b", { class: "sk-name" }, skill.name), el("span", { class: "tag" }, T.practiceLabel), el("span", { class: "dots" }, dots)),
    box));

  const t0 = Date.now();
  const outcome = new Map(); // id mục → true nếu chưa sai lần nào trong phiên
  const logs = [];
  let before = 0, correct = 0, total = 0;
  for (const entry of planned.plan) {
    const t1 = Date.now();
    const c = {
      box, account: state.account, child: state.children.find((x) => x.id === childId),
      items: entry.items.map((i) => itemById.get(i.id)).filter(Boolean), questions: entry.questions?.map((i) => itemById.get(i.id)).filter(Boolean) ?? [],
      lang: nativeLang(), config: entry.config,
      setProgress: (i, n) => paintDots(before + Math.floor((i / Math.max(n, 1)) * entry.turns)),
      record: (id, ok) => { outcome.set(id, (outcome.get(id) ?? true) && ok); recordAnswer(ctx, id, ok); },
      savePron: () => {}, // giọng người học không lưu (bảng pronunciation_attempts khoá vào khu Trẻ em; cũng khớp luật "không lưu" ở bb/pron.js)
    };
    const res = await Promise.race([RUNNERS[entry.kind](c), abortP]);
    if (aborted) return;
    before += entry.turns;
    paintDots(before);
    correct += res.correct;
    total += res.total;
    logs.push({ child_id: childId, skill: skill.id, kind: entry.kind, score: res.total ? Math.round((res.correct / res.total) * 100) : null, duration_seconds: Math.round((Date.now() - t1) / 1000) });
  }
  if (total === 0) { // mọi trò đều tự bỏ qua → không ghi nhật ký, không để người học kẹt
    say(T.bbGameNothing);
    return ctx.shell(root, crumbBar(crumbOf(skill), ctx.toSkills),
      el("div", { class: "card", style: "text-align:center" }, mascotHero(), el("p", null, T.bbGameNothing), el("button", { class: "btn", onclick: ctx.toSkills }, T.bbOtherGame)));
  }
  const score = Math.round((correct / total) * 100);
  logs.push({ child_id: childId, skill: skill.id, kind: "practice", score, duration_seconds: Math.round((Date.now() - t0) / 1000) });
  api.saveGameLogs(logs);
  let gained = null;
  const row = data.skillGood.get(skill.id) ?? { skill: skill.id, sessions: 0, good: 0 };
  const had = badgeOf(row.good);
  row.sessions++;
  if (score >= GOOD_SCORE) row.good++;
  data.skillGood.set(skill.id, row);
  const now = badgeOf(row.good);
  if (now && now.n !== had?.n) gained = now;
  resultScreen(ctx, skill, scope, score, [...outcome].filter(([, ok]) => !ok).map(([id]) => itemById.get(id)).filter((i) => i && SRS_TYPES.has(i.src.type)), gained);
}

// ---- Kết quả: sao + lời khen + các mục nên luyện lại ----
function resultScreen(ctx, skill, scope, score, missed, gained = null) {
  const { root, shell, data } = ctx;
  sfx.star();
  say(gained ? T.bbGameNewBadge(gained.name, skill.name) : T.bbGameDone);
  const n = starsFor(score);
  shell(root,
    crumbBar(crumbOf(skill), ctx.toSkills),
    el("div", { class: "card", style: "text-align:center" },
      mascotHero(),
      el("h1", null, T.bbGameDone),
      el("div", { class: "stars big" }, "⭐".repeat(n) + "☆".repeat(3 - n)),
      gained ? el("div", { class: "badge-new" }, el("span", { class: "badge-big" }, ...emojiNodes(gained.emoji)), el("b", null, T.bbGameNewBadge(gained.name, skill.name))) : medals(data, skill.id),
      missed.length ? el("div", null,
        el("h2", null, T.bbGameWeakTitle),
        el("div", { class: "review" }, missed.slice(0, 6).map((it) => el("button", { class: "chip chip-btn2", onclick: () => playItem(it) }, "🔊 ", it.text_vi)))) : null,
      el("button", { class: "btn big", style: btnStyle(skill), onclick: () => start(ctx, skill, scope) }, "▶ " + T.bbPlayAgain),
      missed.length && !skill.story ? el("div", null, el("button", { class: "btn", onclick: () => start(ctx, skill, { type: "weak" }) }, "🎯 " + T.bbGameWeakAgain)) : null,
      el("div", null, el("button", { class: "btn ghost", onclick: ctx.toSkills }, T.bbOtherGame))));
}

