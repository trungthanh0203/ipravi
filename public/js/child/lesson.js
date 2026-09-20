import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { stopAudio } from "../audio.js";
import { sfx } from "./sfx.js";
import { say } from "./media.js";
import { childAge } from "./util.js";
import * as api from "./api.js";
import * as intro from "./activities/intro.js";
import * as listenPick from "./activities/listen-pick.js";
import * as match from "./activities/match.js";
import * as listenRepeat from "./activities/listen-repeat.js";

// Thêm dạng hoạt động mới: viết file trong ./activities/ (export run(ctx) → {correct,total}) rồi thêm 1 dòng ở đây.
const RUNNERS = {
  listen_pick: listenPick.run,
  listen_pick_text: listenPick.runText,
  match: match.run,
  listen_repeat: listenRepeat.run,
};
const MIN_AGE_FOR_TEXT = 5; // trẻ nhỏ hơn thì bỏ dạng "nghe – chạm chữ"

export const starsFor = (score) => (score == null ? 0 : score >= 85 ? 3 : score >= 60 ? 2 : 1);

// Chạy 1 bài: học từ mới → các hoạt động → kết quả. Trả về khi trẻ xong hoặc thoát.
export async function playLesson({ root, lesson, child, account, onExit }) {
  paint(root, el("p", { class: "boot" }, T.loading));
  let items, activities, progress;
  try {
    [items, activities] = await Promise.all([api.loadLessonItems(lesson.id), api.loadActivities(lesson.id)]);
    progress = await api.loadProgress(child.id, items.map((i) => i.id));
  } catch {
    paint(root, el("div", { class: "card" }, msg("err", T.loadError), el("button", { class: "btn", onclick: onExit }, T.back)));
    return;
  }
  if (items.length < 2) {
    paint(root, el("div", { class: "card" }, el("p", null, T.lessonNotEnough), el("button", { class: "btn", onclick: onExit }, T.back)));
    return;
  }

  // Cú chạm "Bắt đầu" mở khoá âm thanh trên iOS trước khi phát tự động.
  await new Promise((resolve) =>
    paint(root, el("div", { class: "card", style: "text-align:center" },
      el("div", { class: "mascot" }, "🐓"), el("h1", null, lesson.title_vi),
      el("button", { class: "btn big", onclick: resolve }, "▶ " + T.start),
      el("button", { class: "btn ghost small", onclick: onExit }, T.back))));

  const age = childAge(child);
  const plan = activities.filter((a) => RUNNERS[a.kind] && !(a.kind === "listen_pick_text" && age != null && age < MIN_AGE_FOR_TEXT));

  let aborted = false;
  let abort;
  const abortP = new Promise((r) => (abort = r));
  const bar = el("div", { class: "bar-fill" });
  const box = el("div", { class: "lesson-box" });
  paint(root, el("div", null,
    el("div", { class: "row lesson-head" },
      el("div", { class: "bar" }, bar),
      el("button", { class: "btn ghost small", onclick: () => { aborted = true; stopAudio(); abort(); onExit(); } }, "✕ " + T.quit)),
    box));

  let step = 0;
  const totalSteps = plan.length + 1; // +1 cho phần học từ mới
  const ctx = {
    box, account, child, items,
    config: {},
    setProgress: (i, n) => { bar.style.width = `${((step + i / Math.max(n, 1)) / totalSteps) * 100}%`; },
    record: (itemId, correct) => {
      api.saveAnswer(child.id, itemId, correct, progress.get(itemId)).then((row) => progress.set(itemId, row));
    },
    savePron: (itemId, score, text) => api.savePronunciation(child.id, itemId, score, text),
  };

  const started = Date.now();
  const logs = [];
  let correct = 0;
  let total = 0;

  await Promise.race([intro.run({ ...ctx }), abortP]);
  if (aborted) return;
  step = 1;

  for (const act of plan) {
    const t0 = Date.now();
    const res = await Promise.race([RUNNERS[act.kind]({ ...ctx, config: act.config ?? {} }), abortP]);
    if (aborted) return;
    correct += res.correct;
    total += res.total;
    logs.push({
      child_id: child.id, activity_id: act.id, lesson_id: lesson.id, kind: act.kind,
      score: res.total ? Math.round((res.correct / res.total) * 100) : null,
      duration_seconds: Math.round((Date.now() - t0) / 1000),
    });
    step++;
  }

  const score = total ? Math.round((correct / total) * 100) : 100;
  logs.push({ child_id: child.id, lesson_id: lesson.id, kind: "lesson", score, duration_seconds: Math.round((Date.now() - started) / 1000) });
  api.saveActivityLogs(logs);

  bar.style.width = "100%";
  sfx.star();
  const n = starsFor(score);
  say(T.lessonDone);
  paint(root, el("div", { class: "card", style: "text-align:center" },
    el("div", { class: "mascot" }, "🐓"),
    el("h1", null, T.lessonDone),
    el("div", { class: "stars big" }, "⭐".repeat(n) + "☆".repeat(3 - n)),
    el("button", { class: "btn big", onclick: onExit }, T.next)));
}
