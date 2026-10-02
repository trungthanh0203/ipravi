import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { stopAudio } from "../audio.js";
import { state } from "../state.js";
import { render } from "../flow.js";
import { nativeLang, profileHeader, sessionFooter, crumbBar } from "./media.js";
import { clearNav } from "./nav.js";
import * as api from "./api.js";
import * as dialogue from "./steps/dialogue.js";
import * as vocab from "./steps/vocab.js";
import * as grammar from "./steps/grammar.js";
import * as phonics from "./steps/phonics.js";
import * as minigame from "./steps/minigame.js";
import * as reading from "./steps/reading.js";
import * as listening from "./steps/listening.js";
import * as writing from "./steps/writing.js";

// 1 renderer riêng cho mỗi loại chặng — mỗi renderer nhận (box, step[, pool]), vẽ vào box, trả Promise resolve khi
// xong chặng đó. KHÁC bản trước (chạy tuần tự cả 7 chặng theo 1 thứ tự cố định, không được bỏ qua): giờ hiện LƯỚI
// mọi chặng CÓ DỮ LIỆU để người học tự chọn học chặng nào trước, học xong chặng nào chặng đó được đánh dấu ✓ (yêu
// cầu chủ dự án 2026-09-28, xem KE_HOACH_TIENG_VIET_BAI_BAN.md mục 23).
const STEP_RUNNERS = {
  dialogue: dialogue.run, vocab: vocab.run, grammar: grammar.run, phonics: phonics.run,
  minigame: minigame.run, reading: reading.run, listening: listening.run, writing: writing.run,
};
// Chữ hiện trên thẻ chặng — MỖI CHUỖI ĐÃ CÓ SẴN EMOJI ĐẦU (xem strings.js), không cần ghép thêm emoji riêng.
const STEP_TITLE = {
  dialogue: T.bbStepDialogue, vocab: T.bbStepVocab, grammar: T.bbStepGrammar,
  phonics: T.bbStepPhonics, minigame: T.bbStepMinigame, reading: T.bbStepReading,
  listening: T.bbStepListening, writing: T.bbStepWriting,
};

// Chặng có dữ liệu THẬT để ẩn/hiện đúng theo yêu cầu chủ dự án: dialogue/vocab/grammar/phonics/writing cần ≥1 dòng
// nội dung; reading cần có đoạn văn (câu hỏi thì tuỳ chọn); minigame cần đã chọn engine VÀ đủ dữ liệu nguồn cho
// engine đó — DÙNG CHUNG ngưỡng với lúc chơi thật qua `minigame.feasible()` (bb/steps/minigame.js), không tự đặt
// ngưỡng riêng ở đây kẻo lệch nhau.
function hasContent(step, pool) {
  if (step.step_type === "reading" || step.step_type === "listening") return Boolean(step.content?.passage);
  if (step.step_type === "minigame") return minigame.feasible(step, pool, nativeLang());
  return (step.content?.length ?? 0) > 0;
}

// Chạy 1 bài: lưới chọn chặng (chỉ hiện chặng có dữ liệu, ✓ chặng đã xong) → chạm 1 chặng để chạy → xong tự quay
// lại lưới. `onExit` gọi khi bấm "◀ Quay lại" ở lưới (thoát cả bài, về danh sách bài — giống playLesson() bên khu
// trẻ em). Mỗi chặng xong được đánh dấu vào bb_progress (childId) — dùng cho ✓ ở lưới này LẪN ✓ tổng ở danh sách
// bài (pages/bai-ban-home.js, `api.loadLessonProgress`) LẪN diện ôn tập (GĐ 4, xem bb/practice.js).
export async function runLesson({ root, lesson, childId, crumb = lesson.title_vi, onExit }) {
  paint(root, el("p", { class: "boot" }, T.loading));
  // Thoát cả phiên (nút Thoát trong header) — khác "◀ Quay lại" (chỉ lùi về danh sách bài) và "✕ Thoát bài" (chỉ
  // lùi về lưới chặng) — giống hệt cách bai-ban-home.js xử lý, dọn cache + xoá vị trí đã nhớ trước khi rời (không
  // xoá thì mở lại hồ sơ này sau sẽ nhảy lại đúng bài đang dở, dù đã chủ động thoát).
  const exitSession = () => { api.clearCache(); clearNav(); state.activeChildId = null; render(); };
  let steps, pool, doneIds;
  try {
    // loadLessonContent (nội dung riêng của bài) và loadUnitPool (Boss cuối Unit, chỉ khi review) KHÔNG phụ thuộc
    // nhau — chạy song song thay vì tuần tự để đỡ 1 vòng round-trip mạng (bossPool tải lỗi thì KHÔNG chặn cả bài).
    const [all, bossPool] = await Promise.all([
      api.loadLessonContent(lesson.id),
      lesson.lesson_type === "review" ? api.loadUnitPool(lesson.unit_id, lesson.id).catch(() => []) : Promise.resolve([]),
    ]);
    pool = [...all, ...bossPool];
    steps = all.filter((s) => STEP_RUNNERS[s.step_type] && hasContent(s, pool));
    doneIds = await api.loadStepProgress(childId, steps.map((s) => s.id)).catch(() => new Set());
  } catch {
    paint(root, el("div", null, profileHeader(exitSession),
      el("div", { class: "card" }, msg("err", T.bbLoadError), el("button", { class: "btn", onclick: onExit }, T.back)), sessionFooter()));
    return;
  }
  if (steps.length === 0) {
    paint(root, el("div", null, profileHeader(exitSession),
      el("div", { class: "card" }, el("p", null, T.bbLessonEmpty), el("button", { class: "btn", onclick: onExit }, T.back)), sessionFooter()));
    return;
  }

  // Mỗi lần vào 1 chặng hoặc quay lại lưới đều đổi `token` — chặng CŨ lỡ resolve() muộn (vd bấm "✕ Thoát bài" giữa
  // chừng rồi mở lại đúng chặng đó) sẽ tự nhận ra mình không còn là chặng đang chạy nữa và bỏ qua, không đánh dấu
  // hoàn thành/điều hướng nhầm đè lên chặng MỚI đang chạy.
  let token = 0;
  showPicker();

  // ---- Lưới chọn chặng (giữ header/footer như mọi màn điều hướng chính — yêu cầu chủ dự án 2026-09-30: bài
  // học/chặng vẫn cần thấy avatar+giọng+Thoát+liên hệ, không chỉ riêng màn Trang chủ/Học/Luyện tập) ----
  function showPicker() {
    token++;
    const allDone = steps.every((s) => doneIds.has(s.id));
    paint(root, el("div", null,
      profileHeader(exitSession),
      crumbBar(crumb, onExit),
      el("h1", { style: "text-align:center" }, lesson.title_vi),
      lesson.description ? el("p", { class: "muted", style: "text-align:center" }, lesson.description) : null,
      el("p", { class: "muted", style: "text-align:center" }, allDone ? T.bbLessonDone : T.bbPickStep),
      el("div", { class: "unit-grid" }, steps.map((s) => stepCard(s))),
      sessionFooter()));
  }

  function stepCard(step) {
    const done = doneIds.has(step.id);
    return el("button", { class: "unit-card bb-step-card" + (done ? " done" : ""), onclick: () => runStep(step) },
      done ? el("span", { class: "bb-step-check" }, "✓") : null,
      el("span", null, STEP_TITLE[step.step_type]));
  }

  // ---- Chạy 1 chặng (cũng giữ header/footer, cùng lý do trên) ----
  function runStep(step) {
    const myToken = ++token;
    const box = el("div", { class: "lesson-box" });
    paint(root, el("div", null,
      profileHeader(exitSession),
      el("div", { class: "lesson-head" },
        crumbBar(`${crumb} > ${STEP_TITLE[step.step_type].replace(/^[^\p{L}\p{N}]+/u, "")}`, () => { stopAudio(); showPicker(); })),
      box,
      sessionFooter()));
    STEP_RUNNERS[step.step_type](box, step, pool).then(() => {
      if (myToken !== token) return; // đã rời chặng này rồi (thoát hoặc chuyển chặng khác) — bỏ qua lượt resolve muộn
      doneIds.add(step.id);
      api.saveStepProgress(childId, step.id); // không await — không chặn quay lại lưới nếu mạng chậm, lỗi thì console.warn thôi
      showPicker();
    });
  }
}
