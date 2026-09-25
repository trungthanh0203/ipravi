import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { stopAudio } from "../audio.js";
import * as api from "./api.js";
import * as dialogue from "./steps/dialogue.js";
import * as vocab from "./steps/vocab.js";
import * as grammar from "./steps/grammar.js";
import * as phonics from "./steps/phonics.js";
import * as minigame from "./steps/minigame.js";
import * as reading from "./steps/reading.js";
import * as writing from "./steps/writing.js";

// 1 renderer riêng cho mỗi loại chặng — mỗi renderer nhận (box, step), vẽ vào box, trả Promise resolve khi xong
// chặng đó (xem KE_HOACH_TIENG_VIET_BAI_BAN.md mục 7 GĐ 3: "1 runner chạy tuần tự 7 chặng, mỗi chặng 1 renderer riêng").
const STEP_RUNNERS = {
  dialogue: dialogue.run, vocab: vocab.run, grammar: grammar.run, phonics: phonics.run,
  minigame: minigame.run, reading: reading.run, writing: writing.run,
};
const STEP_TITLE = {
  dialogue: T.bbStepDialogue, vocab: T.bbStepVocab, grammar: T.bbStepGrammar,
  phonics: T.bbStepPhonics, minigame: T.bbStepMinigame, reading: T.bbStepReading, writing: T.bbStepWriting,
};

// Chạy 1 bài: màn "Bắt đầu" → từng chặng đã duyệt theo đúng thứ tự → màn hoàn thành. `onExit` được gọi khi thoát
// giữa chừng HOẶC học xong (gọi lại để quay về danh sách bài, giống playLesson() bên khu trẻ em). Mỗi chặng xong
// được đánh dấu vào bb_progress (childId) — dùng cho ✓ ở danh sách bài + diện ôn tập (GĐ 4, xem bb/practice.js).
export async function runLesson({ root, lesson, childId, onExit }) {
  paint(root, el("p", { class: "boot" }, T.loading));
  let steps;
  let bossPool = null; // "Boss cuối Unit": bài lesson_type='review' → Mini-game ôn CẢ Chủ đề, không chỉ riêng bài này
  try {
    steps = (await api.loadLessonContent(lesson.id)).filter((s) => STEP_RUNNERS[s.step_type]);
    if (lesson.lesson_type === "review") {
      // Tải phần ôn cả Unit lỗi thì KHÔNG chặn cả bài — Mini-game chỉ ôn hẹp lại như bài thường (bossPool ở null).
      bossPool = await api.loadUnitPool(lesson.unit_id, lesson.id).catch(() => []);
    }
  } catch {
    paint(root, el("div", { class: "card" }, msg("err", T.bbLoadError), el("button", { class: "btn", onclick: onExit }, T.back)));
    return;
  }
  if (steps.length === 0) {
    paint(root, el("div", { class: "card" }, el("p", null, T.bbLessonEmpty), el("button", { class: "btn", onclick: onExit }, T.back)));
    return;
  }

  // Cú chạm "Bắt đầu" mở khoá âm thanh trên iOS trước khi phát tự động (cùng lý do với khu trẻ em, xem child/lesson.js).
  await new Promise((resolve) =>
    paint(root, el("div", { class: "card", style: "text-align:center" },
      el("h1", null, lesson.title_vi),
      lesson.description ? el("p", { class: "muted" }, lesson.description) : null,
      el("button", { class: "btn big", onclick: resolve }, T.bbStart),
      el("button", { class: "btn ghost small", onclick: onExit }, T.back))));

  let aborted = false;
  let abort;
  const abortP = new Promise((r) => (abort = r));
  const bar = el("div", { class: "bar-fill" });
  const box = el("div", { class: "lesson-box" });
  paint(root, el("div", null,
    el("div", { class: "lesson-title" }, lesson.title_vi),
    el("div", { class: "row lesson-head" },
      el("div", { class: "bar" }, bar),
      el("button", { class: "btn ghost small", onclick: () => { aborted = true; stopAudio(); abort(); onExit(); } }, "✕ " + T.quit)),
    box));

  for (let i = 0; i < steps.length; i++) {
    bar.style.width = `${(i / steps.length) * 100}%`;
    const step = steps[i];
    const body = el("div", { class: "bb-step-body" });
    paint(box, el("p", { class: "bb-step-dots" }, T.bbStepOf(i + 1, steps.length)), el("h2", null, STEP_TITLE[step.step_type]), body);
    // `steps` (toàn bộ chặng của bài, mỗi chặng kèm `.content`) truyền thêm cho MỌI renderer — chỉ minigame.js dùng
    // (lấy Từ vựng/Ngữ pháp/Ngữ âm/Hội thoại để chơi), các renderer khác nhận (box, step) như cũ, bỏ qua tham số
    // thừa. Bài Boss (bossPool khác null) → Mini-game nhận CẢ steps riêng của bài LẪN bossPool (cả Unit), gộp lại
    // thành 1 mảng — engine không cần biết gì về "Boss", chỉ thấy nguồn dữ liệu rộng hơn bình thường.
    const pool = step.step_type === "minigame" && bossPool ? [...steps, ...bossPool] : steps;
    await Promise.race([STEP_RUNNERS[step.step_type](body, step, pool), abortP]);
    if (aborted) return;
    api.saveStepProgress(childId, step.id); // không await — không chặn chuyển chặng nếu mạng chậm, lỗi thì console.warn thôi
  }

  bar.style.width = "100%";
  paint(root, el("div", { class: "card", style: "text-align:center" },
    el("h1", null, T.bbLessonDone),
    el("button", { class: "btn big", onclick: onExit }, T.next)));
}
