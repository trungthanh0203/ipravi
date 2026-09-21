import { state } from "../state.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { stopAudio } from "../audio.js";
import { sfx } from "./sfx.js";
import { say, voiceToggle, prefetchItems, playItem, nativeLang } from "./media.js";
import { childAge } from "./util.js";
import { emojiNodes, prefetchEmoji } from "../emoji.js";
import { LEVELS } from "../levels.js";
import * as api from "./api.js";
import { RUNNERS } from "./runners.js";
import { makeCtx } from "./session.js";
import { GROUPS, groupById } from "./skills.js";
import { skillsForAge, skillPlayable, planPractice, weakCount } from "./practice-core.js";
import { starsFor } from "./lesson.js";

// Luyện tập theo kỹ năng: 1 phần RIÊNG với Học — bé tự chọn kỹ năng và phạm vi, chơi trên MỌI nội dung đã duyệt (không cần đã học).
// Luồng: lưới kỹ năng → (bé ≥ 5 tuổi) chọn phạm vi → phiên 6–8 lượt → kết quả. Kế hoạch: KE_HOACH_LUYEN_TAP_THEO_KY_NANG.md.
// Lưu ý dữ liệu: danh mục mục học (catalog) + tiến độ được tải MỘT lần khi vào Luyện tập rồi chọn/tính hết ở trình duyệt (practice-core.js, hàm thuần).

const child = () => state.children.find((c) => c.id === state.activeChildId);
const colorStyle = (skill) => { const g = groupById(skill.group); return `--c:${g.color};--soft:${g.soft}`; };
const btnStyle = (skill) => `background:${groupById(skill.group).color}`;
const icon = (emoji) => el("span", { class: "sk-emoji" }, ...emojiNodes(emoji));
const ageOf = () => childAge(child());

// shell(root, ...body): khung có tiêu đề bé + nút thoát (của child-home). home(): về màn hình chính.
export async function showPractice({ root, shell, home }) {
  shell(root, el("p", { class: "boot" }, T.loading));
  let data;
  try {
    const [catalog, progress] = await Promise.all([api.loadCatalog(), api.loadAllProgress(child().id)]);
    data = { catalog, progress, byId: new Map(catalog.map((i) => [i.id, i])) };
  } catch {
    return shell(root, msg("err", T.loadError), el("button", { class: "btn ghost", onclick: home }, "◀ " + T.back));
  }
  const ctx = { root, shell, home, data };
  skillsScreen(ctx);
}

const opts = () => ({ age: ageOf(), lang: nativeLang() });

// ---- 1) Lưới kỹ năng ----
function skillsScreen(ctx, note = null) {
  const { root, shell, home, data } = ctx;
  const skills = skillsForAge(ageOf());
  const card = (skill) => {
    const ok = skillPlayable(skill, data.catalog, opts());
    return el("button", {
      class: "skill-card" + (ok ? "" : " off"), style: colorStyle(skill), "aria-disabled": ok ? null : "true",
      onclick: () => (ok ? (ageOf() != null && ageOf() < 5 ? start(ctx, skill, { type: "all" }) : scopeScreen(ctx, skill)) : (say(T.practiceNeedMore), skillsScreen(ctx, T.practiceNeedMore))),
    }, icon(skill.emoji), el("b", null, skill.name), ageOf() == null || ageOf() >= 5 ? el("small", null, skill.desc) : null);
  };
  shell(root,
    el("button", { class: "btn ghost small", onclick: home }, "◀ " + T.back),
    el("h1", { style: "text-align:center" }, T.practiceTitle),
    el("p", { class: "muted", style: "text-align:center" }, T.practiceHint),
    note ? el("p", { class: "note" }, note) : null,
    data.catalog.length === 0 ? el("div", { class: "card" }, el("p", null, T.practiceNoItems)) : null,
    GROUPS.map((g) => {
      const list = skills.filter((s) => s.group === g.id);
      return list.length ? el("section", { class: "skill-group", style: `--c:${g.color}` }, el("h2", null, g.name), el("div", { class: "skill-grid" }, list.map(card))) : null;
    }));
}

// ---- 2) Chọn phạm vi (bé ≥ 5 tuổi) ----
function scopeScreen(ctx, skill, scope = { type: "all" }) {
  const { root, shell, data } = ctx;
  const weak = weakCount(data.catalog, data.progress);
  const levels = LEVELS.filter((L) => data.catalog.some((i) => i.level === L.n));
  const units = [];
  const seen = new Set();
  for (const i of data.catalog) if (!seen.has(i.unit_id)) { seen.add(i.unit_id); units.push(i.unit); }
  const same = (a, b) => a.type === b.type && a.level === b.level && a.unitId === b.unitId;
  const chip = (label, s, disabled = false) => el("button", { class: "chip-btn" + (same(scope, s) ? " on" : ""), disabled, onclick: () => scopeScreen(ctx, skill, s) }, label);
  const unitSel = scope.type === "unit"
    ? el("select", { "aria-label": T.scopeUnitPick, onchange: (e) => scopeScreen(ctx, skill, { type: "unit", unitId: Number(e.target.value) }) },
      el("option", { value: "" }, T.scopeUnitPick), units.map((u) => el("option", { value: String(u.id), selected: u.id === scope.unitId }, `${u.emoji ?? ""} ${u.title_vi}`)))
    : null;
  shell(root,
    el("button", { class: "btn ghost small", onclick: () => skillsScreen(ctx) }, "◀ " + T.back),
    el("div", { class: "skill-hero", style: colorStyle(skill) }, icon(skill.emoji), el("h1", null, skill.name), el("p", { class: "muted" }, skill.desc)),
    el("h2", null, T.scopeTitle),
    el("div", { class: "scope-row" },
      chip("🌍 " + T.scopeAll, { type: "all" }),
      chip("🎯 " + T.scopeWeak(weak), { type: "weak" }, weak === 0),
      levels.map((L) => chip(`${L.emoji} ${T.scopeLevel(L.n)}`, { type: "level", level: L.n })),
      chip("🗺️ " + T.scopeUnit, { type: "unit", unitId: scope.type === "unit" ? scope.unitId : undefined })),
    unitSel,
    el("div", { style: "text-align:center" }, el("button", { class: "btn big", style: btnStyle(skill), disabled: scope.type === "unit" && scope.unitId == null, onclick: () => start(ctx, skill, scope) }, "▶ " + T.practicePlay)));
}

// ---- 3) Lập phiên + chạy ----
async function start(ctx, skill, scope) {
  const { data } = ctx;
  const planned = planPractice(skill, data.catalog, scope, data.progress, opts());
  if (!planned.ok) {
    const text = planned.reason === "noWeak" ? T.practiceNoWeak : T.practiceNotEnough;
    say(text);
    return ctx.shell(ctx.root,
      el("button", { class: "btn ghost small", onclick: () => (ageOf() != null && ageOf() < 5 ? skillsScreen(ctx) : scopeScreen(ctx, skill, scope)) }, "◀ " + T.back),
      el("div", { class: "card", style: "text-align:center" }, el("div", { class: "mascot" }, ...emojiNodes("🐓")), el("p", null, text),
        scope.type !== "all" ? el("button", { class: "btn", onclick: () => start(ctx, skill, { type: "all" }) }, T.practiceTryAll) : null,
        el("button", { class: "btn ghost", onclick: () => skillsScreen(ctx) }, T.practiceOther)));
  }
  await runSession(ctx, skill, scope, planned);
}

async function runSession(ctx, skill, scope, planned) {
  const { root, data } = ctx;
  const c = child();
  paint(root, el("p", { class: "boot" }, T.loading));
  let items;
  try {
    const rows = await api.loadItemsByIds(planned.itemIds);
    items = new Map(rows.map((r) => { const cat = data.byId.get(r.id); return [r.id, { ...r, unit_id: cat?.unit_id, level: cat?.level, unit: cat?.unit }]; }));
  } catch {
    return paint(root, el("div", { class: "card" }, msg("err", T.loadError), el("button", { class: "btn", onclick: () => skillsScreen(ctx) }, T.back)));
  }
  prefetchItems([...items.values()]);
  prefetchEmoji([...items.values()].map((i) => i.emoji).filter(Boolean));

  // Cú chạm "Chơi nào" mở khoá âm thanh trên iOS trước khi phát tự động.
  const g = groupById(skill.group);
  await new Promise((resolve) =>
    paint(root, el("div", { class: "card", style: `text-align:center;${colorStyle(skill)}` },
      icon(skill.emoji), el("h1", null, skill.name), el("p", { class: "muted" }, skill.desc),
      el("button", { class: "btn big", style: `background:${g.color}`, onclick: resolve }, "▶ " + T.practicePlay),
      el("button", { class: "btn ghost small", onclick: () => skillsScreen(ctx) }, T.back))));
  say(T.practiceStartSay(skill.name));

  let aborted = false;
  let abort;
  const abortP = new Promise((r) => (abort = r));
  const dots = Array.from({ length: planned.turns }, () => el("span", { class: "dot" }));
  const box = el("div", { class: "lesson-box" });
  const paintDots = (n) => dots.forEach((d, i) => d.classList.toggle("on", i < n));
  paint(root, el("div", { style: `--c:${g.color};--soft:${g.soft}` },
    el("div", { class: "row lesson-head" },
      el("div", { class: "ribbon" }, icon(skill.emoji)),
      voiceToggle(),
      el("button", { class: "btn ghost small", onclick: () => { aborted = true; stopAudio(); abort(); skillsScreen(ctx); } }, "✕ " + T.quit)),
    el("div", { class: "dots-row" }, el("b", { class: "sk-name" }, skill.name), el("span", { class: "tag" }, T.practiceLabel), el("span", { class: "dots" }, dots)),
    box));

  const t0 = Date.now();
  const outcome = new Map(); // item_id → true nếu chưa sai lần nào trong phiên
  const logs = [];
  let before = 0;
  let correct = 0;
  let total = 0;
  for (const entry of planned.plan) {
    const t1 = Date.now();
    const ctxA = makeCtx({
      box, account: state.account, child: c, items: entry.items.map((i) => items.get(i.id)).filter(Boolean), progress: data.progress,
      setProgress: (i, n) => paintDots(before + Math.floor((i / Math.max(n, 1)) * entry.turns)),
      onRecord: (id, ok) => outcome.set(id, (outcome.get(id) ?? true) && ok),
    });
    const res = await Promise.race([RUNNERS[entry.kind]({ ...ctxA, config: entry.config }), abortP]);
    if (aborted) return;
    before += entry.turns;
    paintDots(before);
    correct += res.correct;
    total += res.total;
    logs.push({ child_id: c.id, kind: entry.kind, skill: skill.id, source: "practice", score: res.total ? Math.round((res.correct / res.total) * 100) : null, duration_seconds: Math.round((Date.now() - t1) / 1000) });
  }
  if (total === 0) { // mọi trò đều tự bỏ qua (vd phông chữ mẫu không tải được) → không ghi nhật ký, không để bé kẹt
    say(T.practiceNothing);
    return paint(root, el("div", { class: "card", style: "text-align:center" }, el("div", { class: "mascot" }, ...emojiNodes("🐓")), el("p", null, T.practiceNothing),
      el("button", { class: "btn", onclick: () => skillsScreen(ctx) }, T.practiceOther)));
  }
  const score = Math.round((correct / total) * 100);
  logs.push({ child_id: c.id, kind: "practice", skill: skill.id, source: "practice", score, duration_seconds: Math.round((Date.now() - t0) / 1000) });
  api.saveActivityLogs(logs);
  resultScreen(ctx, skill, scope, score, [...outcome].filter(([, ok]) => !ok).map(([id]) => items.get(id)).filter(Boolean));
}

// ---- 4) Kết quả: sao + lời khen + các từ nên luyện lại (không hiện điểm số cho bé) ----
function resultScreen(ctx, skill, scope, score, missed) {
  const { root } = ctx;
  sfx.star();
  say(T.practiceDone);
  const n = starsFor(score);
  paint(root, el("div", { class: "card", style: "text-align:center" },
    el("div", { class: "mascot" }, ...emojiNodes("🐓")),
    el("h1", null, T.practiceDone),
    el("div", { class: "stars big" }, "⭐".repeat(n) + "☆".repeat(3 - n)),
    missed.length ? el("div", null,
      el("h2", null, T.practiceWeakTitle),
      el("div", { class: "review" }, missed.slice(0, 6).map((it) => el("button", { class: "chip chip-btn2", onclick: () => playItem(it) }, "🔊 ", it.emoji ? it.emoji + " " : "", it.text_vi)))) : null,
    el("button", { class: "btn big", style: btnStyle(skill), onclick: () => start(ctx, skill, scope) }, "▶ " + T.practiceAgain),
    missed.length ? el("div", null, el("button", { class: "btn", onclick: () => start(ctx, skill, { type: "weak" }) }, "🎯 " + T.practiceWeakAgain)) : null,
    el("div", null, el("button", { class: "btn ghost", onclick: () => skillsScreen(ctx) }, T.practiceOther))));
}
