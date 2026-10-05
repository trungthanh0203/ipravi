import { state } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import * as api from "../bb/api.js";
import { runLesson } from "../bb/runner.js";
import { showSkills } from "../bb/practice.js";
import { titleSpeakers, titleIn, nativeLang, profileHeader, sessionFooter, crumbBar } from "../bb/media.js";
import { saveNav, clearNav, readNav } from "../bb/nav.js";

// Khu học "Tiếng Việt Bài Bản" (hồ sơ profile_type='learner'): 📖 Học (Level → Unit → Lesson → 7 chặng) | 🎯 Luyện
// tập (ôn nội dung đã học) — 2 phần độc lập, cùng cách tổ chức màn hình chính với khu trẻ em (pages/child-home.js).
// KHÔNG khoá bài — chỉ hiện thứ tự, không cấm chọn bài bất kỳ. Vị trí đang xem được nhớ qua bb/nav.js (F5/refresh
// khôi phục đúng chỗ — xem chi tiết ở đó); chỉ nhớ ID, tự tải lại dữ liệu thật lúc khôi phục — id đã bị xoá/hết hạn
// thì tự lùi về tầng gần nhất còn tải được, không lỗi.

export function mount(root) {
  restore(root);
}

// "A0 > Tên chủ đề" (không emoji) — đường dẫn chữ ở thanh điều hướng đầu màn (crumbBar).
const crumbOf = (unit) => (unit.bb_levels?.code ? `${unit.bb_levels.code} > ` : "") + unit.title_vi;

async function restore(root) {
  const nav = readNav();
  if (!nav) return showHome(root);
  try {
    if (nav.mode === "practice") return showSkills(root, { childId: state.activeChildId, onBack: () => showHome(root), shell });
    if (!nav.levelId) return showHome(root);
    const level = (await api.loadLevels()).find((l) => l.id === nav.levelId);
    if (!level) return showHome(root);
    if (!nav.unitId) return showUnits(root, level);
    const unit = (await api.loadUnits(level.id)).find((u) => u.id === nav.unitId);
    if (!unit) return showUnits(root, level);
    if (!nav.lessonId) return showLessons(root, unit);
    const lesson = (await api.loadLessons(unit.id)).find((l) => l.id === nav.lessonId);
    if (!lesson) return showLessons(root, unit);
    runLesson({ root, lesson, childId: state.activeChildId, crumb: crumbOf(unit), onExit: () => showLessons(root, unit) });
  } catch {
    showHome(root);
  }
}

function shell(root, ...body) {
  // Nút Thoát về màn chọn avatar (KHÔNG phải khu phụ huynh) — khớp hành vi khu Trẻ em (pages/child-home.js), kể cả
  // dọn cache Level/Unit/Lesson (api.clearCache()) khi rời phiên. Thoát chủ động thì XOÁ vị trí đã nhớ (khác refresh
  // ngoài ý muốn) — lần sau chọn lại hồ sơ này vào thẳng Home, không nhảy lại đúng chỗ cũ.
  paint(root, el("div", null,
    profileHeader(() => { api.clearCache(); clearNav(); state.activeChildId = null; render(); }),
    ...body,
    sessionFooter()));
}

function showHome(root) {
  clearNav();
  shell(root,
    el("h1", { style: "text-align:center" }, T.bbHomeTitle),
    el("div", { class: "home-cards" },
      el("button", { class: "home-card learn", onclick: () => showLevels(root) },
        el("span", { class: "hc-emoji" }, "📖"), el("b", null, T.bbHomeLearn), el("small", null, T.bbHomeLearnSub)),
      el("button", {
        class: "home-card practice",
        onclick: () => { saveNav({ mode: "practice" }); showSkills(root, { childId: state.activeChildId, onBack: () => showHome(root), shell }); },
      }, el("span", { class: "hc-emoji" }, "🎯"), el("b", null, T.bbHomePractice), el("small", null, T.bbHomePracticeSub))));
}

async function showLevels(root) {
  saveNav({ mode: "learn" });
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    // Danh sách cấp hiện NGAY (1 truy vấn, có cache); số liệu tiến độ (1 RPC) đến sau thì điền vào tại chỗ — không bắt người học chờ.
    const levels = await api.loadLevels();
    const statsP = api.loadLevelStats(state.activeChildId).catch(() => null); // số liệu hỏng không chặn việc học
    const cards = levels.map((lv) => {
      const tag = el("span", { class: "lv-tag", hidden: true });
      const bar = el("div", { class: "meter-fill", style: "width:0%" });
      const meta = el("span", { class: "muted" }, "…");
      const btn = el("button", { class: "level-card", type: "button", onclick: () => showUnits(root, lv) },
        el("span", { class: "lv-emoji" }, el("span", { class: `bb-code-badge lv-${lv.code}` }, lv.code)),
        el("span", { class: "lv-body" },
          el("div", { class: "lv-name" }, `${lv.code} · ${lv.name_vi}`, tag),
          lv.can_do ? el("div", { class: "muted" }, lv.can_do) : null,
          el("div", { class: "meter" }, bar), meta));
      return { lv, btn, tag, bar, meta };
    });
    shell(root,
      crumbBar(T.bbHomeLearn, () => showHome(root)),
      el("h1", { style: "text-align:center" }, T.bbLevelsTitle),
      levels.length === 0 ? el("div", { class: "card" }, el("p", { class: "muted" }, T.bbNoLevels)) :
        el("div", { class: "level-grid" }, cards.map((c) => c.btn)));
    statsP.then((stats) => {
      if (!stats || !cards.length || !cards[0].btn.isConnected) return cards.forEach((c) => c.meta.replaceChildren());
      // Gợi ý "bạn đang ở đây": cấp đầu tiên còn chặng chưa học (không khoá cấp — chỉ gợi ý, khớp khu Trẻ em).
      const rec = levels.find((lv) => stats[lv.id]?.steps > 0 && stats[lv.id].done < stats[lv.id].steps)?.id;
      for (const { lv, btn, tag, bar, meta } of cards) {
        const st = stats[lv.id] ?? { units: 0, lessons: 0, steps: 0, done: 0 };
        bar.style.width = (st.steps ? Math.round((100 * st.done) / st.steps) : 0) + "%";
        meta.textContent = T.bbLevelMeta(st.units, st.lessons, st.done, st.steps);
        // Cấp chưa có chủ đề: vẫn hiện đủ thông tin như các cấp khác, chỉ mờ đi + nhãn "Sắp có".
        if (st.units === 0) { btn.disabled = true; tag.textContent = T.levelSoon; tag.hidden = false; }
        else if (lv.id === rec) { btn.classList.add("rec"); tag.textContent = T.bbLevelHere; tag.hidden = false; }
      }
    });
  } catch {
    shell(root, msg("err", T.bbLoadError));
  }
}

async function showUnits(root, level) {
  saveNav({ mode: "learn", levelId: level.id });
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    const units = await api.loadUnits(level.id);
    shell(root,
      crumbBar(`${level.code} > ${level.name_vi}`, () => showLevels(root)),
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
  saveNav({ mode: "learn", levelId: unit.level_id, unitId: unit.id });
  shell(root, el("p", { class: "boot" }, T.loading));
  try {
    const lessons = await api.loadLessons(unit.id);
    const childId = state.activeChildId;
    const completed = await api.loadLessonProgress(childId, lessons.map((l) => l.id)).catch(() => new Set()); // hỏng không chặn xem danh sách bài
    shell(root,
      crumbBar(crumbOf(unit), () => showUnits(root, unit.bb_levels ?? { id: unit.level_id })),
      el("h1", null, unit.emoji ? unit.emoji + " " : "", unit.title_vi),
      el("div", { class: "title-line" }, titleSpeakers(unit), titleIn(unit, nativeLang()) ? el("span", { class: "title-native" }, titleIn(unit, nativeLang())) : null),
      unit.description ? el("p", { class: "muted" }, unit.description) : null,
      lessons.length === 0 ? el("div", { class: "card" }, el("p", { class: "muted" }, T.bbNoLessons)) :
        el("div", { class: "lesson-list" }, lessons.map((l, i) => {
          const native = titleIn(l, nativeLang());
          return el("div", { class: "lesson-item" },
            el("button", {
              class: "lesson-btn",
              onclick: () => {
                saveNav({ mode: "learn", levelId: unit.level_id, unitId: unit.id, lessonId: l.id });
                runLesson({ root, lesson: l, childId, crumb: crumbOf(unit), onExit: () => showLessons(root, unit) });
              },
            },
            el("span", { class: "num" }, completed.has(l.id) ? "✓" : String(i + 1)),
            el("span", { class: "title" }, l.title_vi, l.lesson_type === "review" ? el("span", { class: "lv-tag" }, T.bbLessonReview) : null, native ? el("small", { class: "title-native" }, native) : null)),
            titleSpeakers(l));
        })));
  } catch {
    shell(root, msg("err", T.bbLoadError));
  }
}
