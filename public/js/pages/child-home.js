import { state } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { avatarEmoji } from "../data.js";
import { stopAudio } from "../audio.js";
import { visual, voiceToggle } from "../child/media.js";
import { playLesson, starsFor } from "../child/lesson.js";
import * as api from "../child/api.js";
import { LEVELS, levelOf, levelProgress, recommendedLevel } from "../levels.js";
import { emojiNodes } from "../emoji.js";
import { loadStats, childStatsView } from "../stats.js";

// Khu học của trẻ: chủ đề → bài học (mở TẤT CẢ, bé chọn bài nào cũng được) → chơi. Chỉ tải dữ liệu của màn hình đang xem.
export function mount(root) {
  showLevels(root);
}

const child = () => state.children.find((c) => c.id === state.activeChildId);

function shell(root, ...body) {
  const c = child();
  paint(root, el("div", null,
    el("div", { class: "row child-header" },
      el("span", { class: "who" }, avatarEmoji(c?.avatar_id), " ", c?.nickname ?? ""),
      voiceToggle(),
      el("button", { class: "btn ghost small", onclick: () => { stopAudio(); api.clearCache(); state.activeChildId = null; render(); } }, T.childExit)),
    ...body));
}

// Màn hình chính của bé: 4 chặng (cấp) + vài số liệu vui. Không khoá cấp — chỉ gợi ý "Con đang ở đây".
async function showLevels(root) {
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    const [units, stats] = await Promise.all([api.loadUnits(), loadStats(child().id).catch(() => null)]); // thống kê hỏng không chặn việc học
    if (units.length === 0) return shell(root, el("div", { class: "card" }, el("p", null, T.noContent)));
    const progress = levelProgress(stats);
    const rec = recommendedLevel(progress);
    const unitsOf = (n) => units.filter((u) => levelOf(u) === n);
    // Chưa có số liệu (stats lỗi) vẫn dựng được thẻ cấp từ danh sách chủ đề
    const totalWords = progress.reduce((a, p) => a + p.items_mastered, 0);
    shell(root,
      el("h1", { style: "text-align:center" }, T.levelsTitle),
      stats ? el("div", { class: "mini-stats" }, el("span", null, "⭐ ", stats.stars), el("span", null, "🔥 ", stats.streak), el("span", null, "📚 ", totalWords)) : null,
      el("div", { class: "level-grid" }, LEVELS.map((L) => {
        const us = unitsOf(L.n), p = progress[L.n - 1];
        const usable = us.length > 0;
        return el("button", { class: "level-card" + (L.n === rec ? " rec" : ""), disabled: !usable, onclick: () => showUnits(root, L.n, units) },
          el("span", { class: "lv-emoji" }, ...emojiNodes(L.emoji)),
          el("span", { class: "lv-body" },
            el("div", { class: "lv-name" }, `Cấp ${L.n} · ${L.name}`, L.n === rec ? el("span", { class: "lv-tag" }, T.levelHere) : null),
            el("div", { class: "muted" }, usable ? `${L.focus}` : T.levelSoon + " · " + L.focus),
            usable && stats && p.hasContent ? [
              el("div", { class: "meter" }, el("div", { class: "meter-fill", style: `width:${p.percent}%` })),
              el("span", { class: "muted" }, `${T.levelWords(p.items_mastered, p.items_total)}${p.passed ? " · " + T.levelPassed : ""}`)] : usable ? el("span", { class: "muted" }, T.levelUnits(us.length)) : null));
      })),
      stats ? el("div", { style: "text-align:center; margin-top:16px" }, el("button", { class: "btn ghost", onclick: () => showStats(root, stats) }, T.statsBtn)) : null);
  } catch {
    shell(root, msg("err", T.loadError));
  }
}

function showStats(root, stats) {
  shell(root,
    el("button", { class: "btn ghost small", onclick: () => showLevels(root) }, "◀ " + T.back),
    el("h1", null, T.statsTitle),
    childStatsView(stats));
}

async function showUnits(root, level, all) {
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    const units = (all ?? (await api.loadUnits())).filter((u) => levelOf(u) === level);
    const L = LEVELS[level - 1];
    shell(root,
      el("button", { class: "btn ghost small", onclick: () => showLevels(root) }, "◀ " + T.back),
      el("h1", { style: "text-align:center" }, `${L.emoji} Cấp ${L.n} · ${L.name}`),
      el("div", { class: "unit-grid" }, units.map((u) =>
        el("button", { class: "unit-card", onclick: () => showLessons(root, u) }, visual(u, "big"), el("span", null, u.title_vi)))));
  } catch {
    shell(root, msg("err", T.loadError));
  }
}

async function showLessons(root, unit) {
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    const lessons = await api.loadLessons(unit.id);
    const scores = await api.loadLessonScores(child().id, lessons.map((l) => l.id));
    const nextId = lessons.find((l) => !scores.has(l.id))?.id;
    shell(root,
      el("button", { class: "btn ghost small", onclick: () => showUnits(root, levelOf(unit)) }, "◀ " + T.back),
      el("h1", null, visual(unit), " ", unit.title_vi),
      el("div", { class: "lesson-list" }, lessons.map((l, i) => {
        // Không khoá bài: trẻ đã biết trước có thể vào thẳng bài khó. Chỉ GỢI Ý bài nên học tiếp (bài đầu tiên chưa làm).
        const n = starsFor(scores.get(l.id));
        const next = l.id === nextId;
        return el("button", {
          class: "lesson-btn" + (next ? " next" : ""),
          onclick: () => playLesson({ root, lesson: l, child: child(), account: state.account, onExit: () => showLessons(root, unit) }),
        },
          el("span", { class: "num" }, scores.has(l.id) ? "✓" : String(i + 1)),
          el("span", { class: "title" }, l.title_vi, next ? el("span", { class: "lv-tag" }, T.lessonNext) : null),
          el("span", { class: "stars" }, scores.has(l.id) ? "⭐".repeat(n) + "☆".repeat(3 - n) : ""));
      })));
  } catch {
    shell(root, msg("err", T.loadError));
  }
}
