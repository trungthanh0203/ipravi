// Đọc + kiểm tra CSV nhập hàng loạt cho "Tiếng Việt Bài Bản" — hàm thuần (không đụng DOM/mạng), test ở
// tests/bb.test.mjs. Khác CSV khu trẻ em (1 dòng = 1 mục): ở đây 1 dòng = 1 dòng NỘI DUNG của 1 CHẶNG cụ thể
// trong 1 bài — hình dạng cột cần đọc tuỳ theo step_type của dòng đó.
//
// Cột LUÔN cần: level (mã CEFR), unit, lesson, step_type (dialogue|vocab|grammar|phonics|reading|writing).
// Cột tuỳ chọn theo step_type:
//   - dialogue: speaker (mặc định A), vi (câu)
//   - vocab: vi (từ), pos (loại từ)
//   - grammar: vi (công thức), examples (câu ví dụ, cách nhau bằng ;)
//   - phonics: vi (âm A), vi2 (âm B), examples (ví dụ, cách nhau bằng ;)
//   - reading: dòng ĐOẠN VĂN (chỉ 1 dòng đầu tiên/chặng, cột `question` để TRỐNG) dùng vi (đoạn văn);
//              dòng CÂU HỎI (cột `question` có giá trị) dùng question, choices (cách nhau bằng |), answer (số)
//   - writing: task_type (fill|order|write), vi (đề bài); fill dùng sentence+answer_text; order dùng words
//              (cách nhau bằng dấu phẩy); write dùng min_words+sample
// Cột khác: level_name, can_do (chỉ dùng khi TẠO MỚI cấp), unit_emoji, lesson_type (core|review|reading|writing,
// mặc định core), rồi 1 cột/ngôn ngữ (de, en…) = bản dịch của "vi" (line_tr/meaning/formula_tr/passage_tr/prompt_tr
// tuỳ step_type). Không có cột step_order — mỗi bài chỉ 1 chặng/loại qua CSV (đủ dùng thực tế; muốn nhiều chặng
// cùng loại thì thêm bằng tay ở giao diện). Nhập lại file cũ KHÔNG tạo trùng nội dung (so theo chữ chính của dòng
// trong cùng 1 chặng, không phân biệt hoa/thường) — chỉ cập nhật bản dịch/trường đã đổi.

export { parseCsv, keyOf } from "./csv.js";
import { keyOf } from "./csv.js";

export const STEP_TYPES = ["dialogue", "vocab", "grammar", "phonics", "reading", "writing"]; // minigame không có nội dung CSV được (xem GĐ 4)
const clean = (s) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
const lines = (s, sep) => String(s ?? "").split(sep).map((x) => x.trim()).filter(Boolean);

export function validateRows({ headers, rows }, { langs = [] } = {}) {
  const errors = [];
  const warnings = [];
  const items = [];
  const H = headers.map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const col = (name) => H.indexOf(name);

  for (const req of ["level", "unit", "lesson", "step_type"]) {
    if (col(req) < 0) errors.push({ row: 1, msg: `Thiếu cột bắt buộc "${req}"` });
  }
  if (errors.length) return { items, errors, warnings };

  const known = new Set([
    "level", "level_name", "can_do", "unit", "unit_emoji", "lesson", "lesson_type", "step_type",
    "speaker", "vi", "vi2", "pos", "task_type", "sentence", "answer_text", "words", "min_words", "sample",
    "question", "choices", "answer", "examples", ...langs,
  ]);
  H.forEach((h, i) => { if (h && !known.has(h)) warnings.push({ row: 1, msg: `Cột "${headers[i]}" không được dùng (bỏ qua)` }); });

  rows.forEach((r, idx) => {
    const n = idx + 2;
    if (r.every((c) => !String(c ?? "").trim())) return;
    const get = (name) => (col(name) < 0 ? "" : clean(r[col(name)]));
    const problems = [];

    const level = get("level").toUpperCase();
    const unit = get("unit"), lesson = get("lesson");
    const stepType = get("step_type").toLowerCase();
    if (!/^[ABC][12]$/.test(level)) problems.push('level phải dạng CEFR (A1, A2, B1, B2, C1, C2)');
    if (!unit) problems.push("thiếu chủ đề (unit)");
    if (unit.length > 60) problems.push("tên chủ đề dài quá 60 ký tự");
    if (!lesson) problems.push("thiếu bài (lesson)");
    if (lesson.length > 60) problems.push("tên bài dài quá 60 ký tự");
    if (!STEP_TYPES.includes(stepType)) problems.push(`step_type "${stepType}" không hợp lệ (dùng: ${STEP_TYPES.join(", ")})`);
    const lessonType = get("lesson_type").toLowerCase() || "core";
    if (!["core", "review", "reading", "writing"].includes(lessonType)) problems.push(`lesson_type "${lessonType}" không hợp lệ`);

    const tr = {};
    for (const l of langs) { const v = get(l); if (v) tr[l] = v; }

    let content = null; // hình dạng tuỳ step_type, gắn thêm vào item bên dưới
    if (stepType === "dialogue") {
      const vi = get("vi");
      if (!vi) problems.push("dialogue cần cột vi (câu tiếng Việt)");
      content = { kind: "dialogue", speaker: get("speaker") || "A", vi, tr };
    } else if (stepType === "vocab") {
      const vi = get("vi");
      if (!vi) problems.push("vocab cần cột vi (từ tiếng Việt)");
      content = { kind: "vocab", vi, pos: get("pos") || null, tr };
    } else if (stepType === "grammar") {
      const vi = get("vi");
      if (!vi) problems.push("grammar cần cột vi (công thức)");
      content = { kind: "grammar", vi, tr, examples: lines(get("examples"), ";") };
    } else if (stepType === "phonics") {
      const a = get("vi"), b = get("vi2");
      if (!a || !b) problems.push("phonics cần cả vi (âm A) và vi2 (âm B)");
      content = { kind: "phonics", a, b, examples: lines(get("examples"), ";") };
    } else if (stepType === "reading") {
      const question = get("question");
      if (question) {
        const choices = lines(get("choices"), "|");
        const answerRaw = get("answer");
        const answer = answerRaw === "" ? null : Number(answerRaw);
        if (choices.length < 2 || choices.length > 6) problems.push("reading (câu hỏi) cần 2–6 đáp án ở cột choices, cách nhau bằng |");
        if (!Number.isInteger(answer) || answer < 1 || answer > Math.max(choices.length, 1)) problems.push("answer phải là số thứ tự đáp án đúng");
        content = { kind: "question", question, choices, answer };
      } else {
        const vi = get("vi");
        if (!vi) problems.push("reading (đoạn văn, cột question để trống) cần cột vi (đoạn văn)");
        content = { kind: "passage", vi, tr };
      }
    } else if (stepType === "writing") {
      const taskType = get("task_type").toLowerCase();
      const vi = get("vi");
      if (!["fill", "order", "write"].includes(taskType)) problems.push('writing cần task_type là "fill", "order" hoặc "write"');
      if (!vi) problems.push("writing cần cột vi (đề bài)");
      if (taskType === "fill") {
        const sentence = get("sentence"), answer = get("answer_text");
        if (!sentence || !answer) problems.push('writing (fill) cần cột sentence và answer_text');
        content = { kind: "writing", taskType, vi, tr, taskContent: { sentence, answer } };
      } else if (taskType === "order") {
        const words = lines(get("words"), ",");
        if (words.length < 2) problems.push("writing (order) cần cột words với ít nhất 2 từ, cách nhau bằng dấu phẩy");
        content = { kind: "writing", taskType, vi, tr, taskContent: { words } };
      } else if (taskType === "write") {
        const minWords = get("min_words") ? Number(get("min_words")) : 5;
        if (!Number.isInteger(minWords) || minWords < 1) problems.push("min_words phải là số nguyên ≥ 1");
        content = { kind: "writing", taskType, vi, tr, taskContent: { min_words: minWords, sample: get("sample") || undefined } };
      }
    }

    if (problems.length) {
      for (const p of problems) errors.push({ row: n, msg: p });
      return;
    }
    items.push({
      row: n, level, levelName: get("level_name"), canDo: get("can_do"),
      unit, unitEmoji: get("unit_emoji"), lesson, lessonType, stepType, content,
    });
  });

  if (items.length === 0 && errors.length === 0) errors.push({ row: 1, msg: "File không có dòng dữ liệu nào" });
  return { items, errors, warnings };
}

// So khớp CSV với dữ liệu đã có để KHÔNG tạo trùng — trả kế hoạch để admin.js/bb.js thực thi.
// existing: { levels, units, lessons, steps } (đã tải sẵn từ CSDL, xem admin/bb.js mount()).
export function buildPlan(items, existing) {
  const levelByCode = new Map(existing.levels.map((l) => [l.code, l]));
  const unitByKey = new Map(existing.units.map((u) => [`${u.level_id}|${keyOf(u.title_vi)}`, u]));
  const lessonByKey = new Map(existing.lessons.map((l) => [`${l.unit_id}|${keyOf(l.title_vi)}`, l]));
  const stepByKey = new Map(existing.steps.map((s) => [`${s.lesson_id}|${s.step_type}`, s]));

  const newLevels = [], newUnits = [], newLessons = [], newSteps = [];
  const seenLevel = new Set(), seenUnit = new Set(), seenLesson = new Set(), seenStep = new Set();
  // Nhóm nội dung theo (level, unit, lesson, step_type) — mỗi nhóm = 1 chặng.
  const groups = new Map(); // groupKey -> { level, unit, lesson, lessonType, unitEmoji, stepType, rows:[content...] }

  for (const it of items) {
    if (!levelByCode.has(it.level) && !seenLevel.has(it.level)) {
      seenLevel.add(it.level);
      newLevels.push({ code: it.level, name_vi: it.levelName || it.level, can_do: it.canDo || null });
    }
    const unitKey = `${it.level}|${keyOf(it.unit)}`; // dùng mã cấp tạm làm khoá gộp (level_id thật chỉ có sau khi tạo)
    if (!unitByKey.has(`${levelByCode.get(it.level)?.id}|${keyOf(it.unit)}`) && !seenUnit.has(unitKey)) {
      seenUnit.add(unitKey);
      newUnits.push({ level: it.level, title_vi: it.unit, emoji: it.unitEmoji || null });
    }
    const lessonKey = `${unitKey}|${keyOf(it.lesson)}`;
    const existingUnit = unitByKey.get(`${levelByCode.get(it.level)?.id}|${keyOf(it.unit)}`);
    if (!(existingUnit && lessonByKey.has(`${existingUnit.id}|${keyOf(it.lesson)}`)) && !seenLesson.has(lessonKey)) {
      seenLesson.add(lessonKey);
      newLessons.push({ level: it.level, unit: it.unit, title_vi: it.lesson, lesson_type: it.lessonType });
    }
    const stepKey = `${lessonKey}|${it.stepType}`;
    const existingLesson = existingUnit && lessonByKey.get(`${existingUnit.id}|${keyOf(it.lesson)}`);
    if (!(existingLesson && stepByKey.has(`${existingLesson.id}|${it.stepType}`)) && !seenStep.has(stepKey)) {
      seenStep.add(stepKey);
      newSteps.push({ level: it.level, unit: it.unit, lesson: it.lesson, step_type: it.stepType });
    }
    if (!groups.has(stepKey)) groups.set(stepKey, { level: it.level, unit: it.unit, lesson: it.lesson, stepType: it.stepType, rows: [] });
    groups.get(stepKey).rows.push(it.content);
  }

  return {
    newLevels, newUnits, newLessons, newSteps, groups: [...groups.values()],
    counts: { levels: newLevels.length, units: newUnits.length, lessons: newLessons.length, steps: newSteps.length, rows: items.length },
  };
}
