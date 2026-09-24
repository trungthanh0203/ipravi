import { state } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { avatarEmoji } from "../data.js";
import * as api from "../bb/api.js";
import { runLesson } from "../bb/runner.js";
import { showSkills } from "../bb/practice.js";

// Khu học "Tiếng Việt Bài Bản" (hồ sơ profile_type='learner'): 📖 Học (Level → Unit → Lesson → 7 chặng) | 🎯 Luyện
// tập (ôn nội dung đã học, GĐ 4) — 2 phần độc lập, cùng cách tổ chức màn hình chính với khu trẻ em
// (pages/child-home.js). KHÔNG khoá bài — chỉ hiện thứ tự, không cấm chọn bài bất kỳ.
// Xem KE_HOACH_TIENG_VIET_BAI_BAN.md mục 7 Giai đoạn 3–4.
export function mount(root) {
  showHome(root);
}

const learner = () => state.children.find((c) => c.id === state.activeChildId);

function shell(root, ...body) {
  const c = learner();
  paint(root, el("div", null,
    el("div", { class: "row child-header" },
      el("span", { class: "who" }, avatarEmoji(c?.avatar_id), " ", c?.nickname ?? ""),
      el("button", { class: "btn ghost small", onclick: () => { state.activeChildId = null; state.parentOpen = true; render(); } }, T.bbHomeBack)),
    ...body));
}

function showHome(root) {
  shell(root,
    el("h1", { style: "text-align:center" }, T.bbHomeTitle),
    el("div", { class: "home-cards" },
      el("button", { class: "home-card learn", onclick: () => showLevels(root) },
        el("span", { class: "hc-emoji" }, "📖"), el("b", null, T.bbHomeLearn), el("small", null, T.bbHomeLearnSub)),
      el("button", { class: "home-card practice", onclick: () => showSkills(root, { childId: state.activeChildId, onBack: () => showHome(root) }) },
        el("span", { class: "hc-emoji" }, "🎯"), el("b", null, T.bbHomePractice), el("small", null, T.bbHomePracticeSub))));
}

async function showLevels(root) {
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    const levels = await api.loadLevels();
    shell(root,
      el("button", { class: "btn ghost small", onclick: () => showHome(root) }, "◀ " + T.back),
      el("h1", { style: "text-align:center" }, T.bbLevelsTitle),
      levels.length === 0 ? el("div", { class: "card" }, el("p", { class: "muted" }, T.bbNoLevels)) :
        el("div", { class: "unit-grid" }, levels.map((lv) =>
          el("button", { class: "unit-card", onclick: () => showUnits(root, lv) },
            el("span", { class: "visual emoji" }, lv.code),
            el("span", null, lv.name_vi)))));
  } catch {
    shell(root, msg("err", T.bbLoadError));
  }
}

async function showUnits(root, level) {
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    const units = await api.loadUnits(level.id);
    shell(root,
      el("button", { class: "btn ghost small", onclick: () => showLevels(root) }, "◀ " + T.back),
      el("h1", { style: "text-align:center" }, level.name_vi),
      level.can_do ? el("p", { class: "muted", style: "text-align:center" }, level.can_do) : null,
      units.length === 0 ? el("div", { class: "card" }, el("p", { class: "muted" }, T.bbNoUnits)) :
        el("div", { class: "unit-grid" }, units.map((u) =>
          el("button", { class: "unit-card", onclick: () => showLessons(root, u) },
            u.emoji ? el("span", { class: "visual emoji" }, u.emoji) : null,
            el("span", null, u.title_vi)))));
  } catch {
    shell(root, msg("err", T.bbLoadError));
  }
}

async function showLessons(root, unit) {
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    const lessons = await api.loadLessons(unit.id);
    const childId = state.activeChildId;
    const completed = await api.loadLessonProgress(childId, lessons.map((l) => l.id)).catch(() => new Set()); // hỏng không chặn xem danh sách bài
    shell(root,
      el("button", { class: "btn ghost small", onclick: () => showUnits(root, unit.bb_levels ?? { id: unit.level_id }) }, "◀ " + T.back),
      el("h1", null, unit.emoji ? unit.emoji + " " : "", unit.title_vi),
      unit.description ? el("p", { class: "muted" }, unit.description) : null,
      lessons.length === 0 ? el("div", { class: "card" }, el("p", { class: "muted" }, T.bbNoLessons)) :
        el("div", { class: "lesson-list" }, lessons.map((l, i) =>
          el("div", { class: "lesson-item" },
            el("button", {
              class: "lesson-btn",
              onclick: () => runLesson({ root, lesson: l, childId, onExit: () => showLessons(root, unit) }),
            },
            el("span", { class: "num" }, completed.has(l.id) ? "✓" : String(i + 1)),
            el("span", { class: "title" }, l.title_vi, l.lesson_type === "review" ? el("span", { class: "lv-tag" }, T.bbLessonReview) : null))))));
  } catch {
    shell(root, msg("err", T.bbLoadError));
  }
}
