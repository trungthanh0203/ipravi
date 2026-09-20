import { state } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { avatarEmoji } from "../data.js";
import { stopAudio } from "../audio.js";
import { visual, voiceToggle } from "../child/media.js";
import { playLesson, starsFor } from "../child/lesson.js";
import * as api from "../child/api.js";

// Khu học của trẻ: chủ đề → bài học (mở khoá dần) → chơi. Chỉ tải dữ liệu của màn hình đang xem.
export function mount(root) {
  showUnits(root);
}

const child = () => state.children.find((c) => c.id === state.activeChildId);

function shell(root, ...body) {
  const c = child();
  paint(root, el("div", null,
    el("div", { class: "row child-header" },
      el("span", { class: "who" }, avatarEmoji(c?.avatar_id), " ", c?.nickname ?? ""),
      voiceToggle(),
      el("button", { class: "btn ghost small", onclick: () => { stopAudio(); state.activeChildId = null; render(); } }, T.childExit)),
    ...body));
}

async function showUnits(root) {
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    const units = await api.loadUnits();
    if (units.length === 0) return shell(root, el("div", { class: "card" }, el("p", null, T.noContent)));
    shell(root,
      el("h1", { style: "text-align:center" }, T.unitsTitle),
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
    shell(root,
      el("button", { class: "btn ghost small", onclick: () => showUnits(root) }, "◀ " + T.back),
      el("h1", null, visual(unit), " ", unit.title_vi),
      el("div", { class: "lesson-list" }, lessons.map((l, i) => {
        const locked = i > 0 && !scores.has(lessons[i - 1].id); // xong bài trước mới mở bài sau
        const n = starsFor(scores.get(l.id));
        return el("button", {
          class: "lesson-btn", disabled: locked, title: locked ? T.lessonLocked : "",
          onclick: () => playLesson({ root, lesson: l, child: child(), account: state.account, onExit: () => showLessons(root, unit) }),
        },
          el("span", { class: "num" }, locked ? "🔒" : String(i + 1)),
          el("span", { class: "title" }, l.title_vi),
          el("span", { class: "stars" }, scores.has(l.id) ? "⭐".repeat(n) + "☆".repeat(3 - n) : ""));
      })));
  } catch {
    shell(root, msg("err", T.loadError));
  }
}
