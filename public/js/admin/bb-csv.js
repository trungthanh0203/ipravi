// Đọc + kiểm tra CSV nhập hàng loạt cho "Tiếng Việt Bài Bản" — hàm thuần (không đụng DOM/mạng), test ở
// tests/bb.test.mjs. Khác CSV khu trẻ em (1 dòng = 1 mục): ở đây 1 dòng = 1 dòng NỘI DUNG của 1 CHẶNG cụ thể
// trong 1 bài — hình dạng cột cần đọc tuỳ theo step_type của dòng đó.
//
// Cột LUÔN cần: level (mã CEFR, hoặc "A0" tiền-A1), unit, lesson, step_type (dialogue|vocab|grammar|phonics|
// minigame|reading|listening|writing). Cột tuỳ chọn theo step_type:
//   - dialogue: speaker (mặc định A), vi (câu)
//   - vocab: vi (từ), pos (loại từ), say (tuỳ chọn — chữ ĐỌC khi khác chữ hiển thị, vd "b" đọc "bờ"; dùng cho
//            chuyên đề bảng chữ cái/ngữ âm, migration 024)
//   - grammar: vi (công thức), examples (câu ví dụ, cách nhau bằng ;) — CẢ 2 cột đều GIỮ NGUYÊN xuống dòng gõ
//              sẵn trong ô CSV (cell phải đặt trong ngoặc kép mới hợp lệ CSV); markdown-lite: **đậm**, *nghiêng*,
//              !!đỏ!! để nhấn phần khớp công thức lúc hiển thị (xem bb/format.js)
//   - phonics: vi (âm A), vi2 (âm B), examples (ví dụ, cách nhau bằng ;)
//   - reading/listening (CÙNG hình dạng cột, khác bảng CSDL — migration 026): dòng ĐOẠN VĂN (chỉ 1 dòng đầu
//              tiên/chặng, cột `question` để TRỐNG) dùng vi (đoạn văn); dòng CÂU HỎI (cột `question` có giá trị)
//              dùng question, choices (cách nhau bằng |), answer (số). listening KHÔNG hiện chữ cho người học —
//              đoạn văn chỉ để admin soạn/tra + sinh audio, người học chỉ nghe.
//   - minigame: cột game (meaning_pick|phonics_discrim|sentence_builder); không có nội dung riêng (chạy từ Từ vựng/Ngữ âm/
//              Hội thoại/Ngữ pháp cùng bài) — 1 dòng/bài, dòng này chỉ ghi `config.kind` của chặng
//   - writing: task_type (fill|order|write), vi (đề bài); fill dùng sentence+answer_text; order dùng words
//              (cách nhau bằng dấu phẩy); write dùng min_words+sample
// Cột khác: level_name, can_do (chỉ dùng khi TẠO MỚI cấp), unit_emoji, lesson_type (core|review|reading|writing,
// mặc định core), rồi 1 cột/ngôn ngữ (de, en…) = bản dịch của "vi" (line_tr/meaning/formula_tr/passage_tr/prompt_tr
// tuỳ step_type). Không có cột step_order — mỗi bài chỉ 1 chặng/loại qua CSV (đủ dùng thực tế; muốn nhiều chặng
// cùng loại thì thêm bằng tay ở giao diện). Nhập lại file cũ KHÔNG tạo trùng nội dung (so theo chữ chính của dòng
// trong cùng 1 chặng, không phân biệt hoa/thường) — chỉ cập nhật bản dịch/trường đã đổi.

export { parseCsv, keyOf } from "./csv.js";
import { keyOf } from "./csv.js";

export const STEP_TYPES = ["dialogue", "vocab", "grammar", "phonics", "minigame", "reading", "listening", "writing"];
// Kiểu trò chơi của chặng minigame (cột `game`) — PHẢI khớp ENGINES ở bb/steps/minigame.js + MINIGAME_KINDS ở admin/bb.js.
export const GAME_KINDS = ["meaning_pick", "phonics_discrim", "sentence_builder"];
const clean = (s) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
// Như clean() nhưng GIỮ xuống dòng (chỉ gom khoảng trắng ngang trong từng dòng) — dùng cho cột cho phép nhiều dòng
// thật (công thức/câu ví dụ ngữ pháp, khớp cleanLines() ở admin/bb-ops.js) — clean() thường sẽ gộp \n thành 1 dấu
// cách, xoá mất xuống dòng người soạn CSV đã gõ sẵn trong ô (lỗi chủ dự án báo 2026-10-03: mở file text thấy đúng
// nhiều dòng nhưng nhập vào CSDL lại dính thành 1 dòng).
const cleanLines = (s) => String(s ?? "").normalize("NFC").split("\n").map((l) => l.replace(/[^\S\n]+/g, " ").trim()).join("\n").trim();
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
    "speaker", "vi", "vi2", "pos", "say", "task_type", "sentence", "answer_text", "words", "min_words", "sample",
    "question", "choices", "answer", "examples", "game", ...langs, ...langs.flatMap((l) => [`unit_${l}`, `lesson_${l}`]),
  ]);
  H.forEach((h, i) => { if (h && !known.has(h)) warnings.push({ row: 1, msg: `Cột "${headers[i]}" không được dùng (bỏ qua)` }); });

  rows.forEach((r, idx) => {
    const n = idx + 2;
    if (r.every((c) => !String(c ?? "").trim())) return;
    const get = (name) => (col(name) < 0 ? "" : clean(r[col(name)]));
    const getLines = (name) => (col(name) < 0 ? "" : cleanLines(r[col(name)]));
    const problems = [];

    const level = get("level").toUpperCase();
    const unit = get("unit"), lesson = get("lesson");
    const stepType = get("step_type").toLowerCase();
    if (!/^(A0|[ABC][12])$/.test(level)) problems.push('level phải dạng CEFR (A1, A2, B1, B2, C1, C2) hoặc "A0" (tiền-A1)');
    if (!unit) problems.push("thiếu chủ đề (unit)");
    if (unit.length > 120) problems.push("tên chủ đề dài quá 120 ký tự");
    if (!lesson) problems.push("thiếu bài (lesson)");
    if (lesson.length > 120) problems.push("tên bài dài quá 120 ký tự");
    if (!STEP_TYPES.includes(stepType)) problems.push(`step_type "${stepType}" không hợp lệ (dùng: ${STEP_TYPES.join(", ")})`);
    const lessonType = get("lesson_type").toLowerCase() || "core";
    if (!["core", "review", "reading", "writing"].includes(lessonType)) problems.push(`lesson_type "${lessonType}" không hợp lệ`);

    const tr = {};
    for (const l of langs) { const v = get(l); if (v) tr[l] = v; }
    // Tên chủ đề/bài bằng ngôn ngữ ở nhà (cột unit_de, lesson_de…) — tuỳ chọn, CHỈ áp dụng lúc TẠO MỚI chủ đề/bài
    // (khớp cách khu trẻ em đọc unit_<lang>/lesson_<lang>, xem csv.js) — bài/chủ đề đã có thì sửa tên dịch qua ✎ Sửa.
    const unitTr = {}, lessonTr = {};
    for (const l of langs) {
      for (const [name, into] of [[`unit_${l}`, unitTr], [`lesson_${l}`, lessonTr]]) {
        if (col(name) < 0) continue;
        const v = get(name);
        if (v) into[l] = v;
      }
    }

    let content = null; // hình dạng tuỳ step_type, gắn thêm vào item bên dưới
    if (stepType === "dialogue") {
      const vi = get("vi");
      if (!vi) problems.push("dialogue cần cột vi (câu tiếng Việt)");
      content = { kind: "dialogue", speaker: get("speaker") || "A", vi, tr };
    } else if (stepType === "vocab") {
      const vi = get("vi");
      if (!vi) problems.push("vocab cần cột vi (từ tiếng Việt)");
      // say (tuỳ chọn, migration 024): chữ ĐỌC khi khác chữ hiển thị (vd "b" đọc "bờ") — dùng cho bảng chữ cái/ngữ âm.
      content = { kind: "vocab", vi, pos: get("pos") || null, say: get("say") || null, tr };
    } else if (stepType === "grammar") {
      const vi = getLines("vi");
      if (!vi) problems.push("grammar cần cột vi (công thức)");
      content = { kind: "grammar", vi, tr, examples: lines(getLines("examples"), ";") };
    } else if (stepType === "phonics") {
      const a = get("vi"), b = get("vi2");
      if (!a || !b) problems.push("phonics cần cả vi (âm A) và vi2 (âm B)");
      content = { kind: "phonics", a, b, examples: lines(get("examples"), ";") };
    } else if (stepType === "reading" || stepType === "listening") {
      const question = get("question");
      if (question) {
        const choices = lines(get("choices"), "|");
        const answerRaw = get("answer");
        const answer = answerRaw === "" ? null : Number(answerRaw);
        if (choices.length < 2 || choices.length > 6) problems.push(`${stepType} (câu hỏi) cần 2–6 đáp án ở cột choices, cách nhau bằng |`);
        if (!Number.isInteger(answer) || answer < 1 || answer > Math.max(choices.length, 1)) problems.push("answer phải là số thứ tự đáp án đúng");
        content = { kind: "question", question, choices, answer };
      } else {
        const vi = get("vi");
        if (!vi) problems.push(`${stepType} (đoạn văn, cột question để trống) cần cột vi (đoạn văn)`);
        content = { kind: "passage", vi, tr };
      }
    } else if (stepType === "minigame") {
      const game = get("game").toLowerCase();
      if (!GAME_KINDS.includes(game)) problems.push(`minigame cần cột game là một trong: ${GAME_KINDS.join(", ")}`);
      content = { kind: "minigame", game };
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
      unit, unitEmoji: get("unit_emoji"), unitTr, lesson, lessonType, lessonTr, stepType, content,
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
    const isNewUnit = !unitByKey.has(`${levelByCode.get(it.level)?.id}|${keyOf(it.unit)}`);
    if (isNewUnit && !seenUnit.has(unitKey)) {
      seenUnit.add(unitKey);
      newUnits.push({ level: it.level, title_vi: it.unit, emoji: it.unitEmoji || null, title_tr: { ...it.unitTr } });
    } else if (isNewUnit) {
      // Nhiều dòng CSV cùng chủ đề mới — gộp tên dịch từ MỌI dòng (dòng nào có unit_<lang> thì dùng, không chỉ dòng đầu).
      Object.assign(newUnits.find((u) => u.level === it.level && keyOf(u.title_vi) === keyOf(it.unit)).title_tr, it.unitTr);
    }
    const lessonKey = `${unitKey}|${keyOf(it.lesson)}`;
    const existingUnit = unitByKey.get(`${levelByCode.get(it.level)?.id}|${keyOf(it.unit)}`);
    const isNewLesson = !(existingUnit && lessonByKey.has(`${existingUnit.id}|${keyOf(it.lesson)}`));
    if (isNewLesson && !seenLesson.has(lessonKey)) {
      seenLesson.add(lessonKey);
      newLessons.push({ level: it.level, unit: it.unit, title_vi: it.lesson, lesson_type: it.lessonType, title_tr: { ...it.lessonTr } });
    } else if (isNewLesson) {
      Object.assign(newLessons.find((l) => l.unit === it.unit && keyOf(l.title_vi) === keyOf(it.lesson)).title_tr, it.lessonTr);
    }
    const stepKey = `${lessonKey}|${it.stepType}`;
    const existingLesson = existingUnit && lessonByKey.get(`${existingUnit.id}|${keyOf(it.lesson)}`);
    if (!(existingLesson && stepByKey.has(`${existingLesson.id}|${it.stepType}`)) && !seenStep.has(stepKey)) {
      seenStep.add(stepKey);
      newSteps.push({ level: it.level, unit: it.unit, lesson: it.lesson, step_type: it.stepType, config: it.stepType === "minigame" ? { kind: it.content.game } : {} });
    }
    if (!groups.has(stepKey)) groups.set(stepKey, { level: it.level, unit: it.unit, lesson: it.lesson, stepType: it.stepType, rows: [] });
    groups.get(stepKey).rows.push(it.content);
  }

  return {
    newLevels, newUnits, newLessons, newSteps, groups: [...groups.values()],
    counts: { levels: newLevels.length, units: newUnits.length, lessons: newLessons.length, steps: newSteps.length, rows: items.length },
  };
}

// ============================================================================
// Mẫu file CSV (⬇ Tải file mẫu) + câu lệnh nhờ AI soạn nội dung (📋 Sao chép câu lệnh cho AI) — cùng vai trò với
// csv.js buildTemplate()/text.js aiPrompt() bên khu trẻ em, để 2 khu có UI CSV giống nhau (đã thiếu ở khu Bài Bản
// tới giờ, phát hiện lúc chủ dự án dùng thử — xem KE_HOACH_TIENG_VIET_BAI_BAN.md).
// ============================================================================
const bbQ = (v) => (/[",;\n]/.test(v) ? `"${String(v ?? "").replace(/"/g, '""')}"` : (v ?? ""));
// Đầy đủ MỌI cột hiện có (khớp `known` ở validateRows). 1 bài "Bài 1: Ở chợ" demo đủ 8 step_type để admin thấy đúng
// hình dạng cột từng loại; task_type chỉ demo "fill" (order/write đã có ví dụ đầy đủ trong help text phía trên +
// câu lệnh AI). listening dùng đúng 2 dòng của reading (đoạn văn + câu hỏi) — chỉ đổi step_type, không hiện chữ cho
// người học (xem bb/steps/listening.js).
export function buildTemplate(langs) {
  const HEAD = ["level", "level_name", "can_do", "unit", "unit_emoji", "lesson", "lesson_type", "step_type", "speaker",
    "vi", "vi2", "pos", "say", "task_type", "sentence", "answer_text", "words", "min_words", "sample",
    "question", "choices", "answer", "examples", "game", ...langs, ...langs.flatMap((l) => [`unit_${l}`, `lesson_${l}`])];
  const row = (o) => HEAD.map((h) => o[h] ?? "");
  const UNIT = "Đi chợ", LESSON = "Bài 1: Ở chợ";
  const UNIT_TR = { de: "Auf dem Markt", en: "Going to the Market" };
  const LESSON_TR = { de: "Lektion 1: Am Markt", en: "Lesson 1: At the Market" };
  // langCols: gộp nghĩa "vi" hiện tại (map) + (withTitles) tên dịch chủ đề/bài — ngôn ngữ đã cấu hình mà không có
  // trong map (vd fr/ko/ja nếu bản triển khai dùng) để trống, admin tự điền, KHÔNG bịa.
  const langCols = (map, withTitles = false) => {
    const out = {};
    for (const l of langs) out[l] = map[l] ?? "";
    if (withTitles) for (const l of langs) { out[`unit_${l}`] = UNIT_TR[l] ?? ""; out[`lesson_${l}`] = LESSON_TR[l] ?? ""; }
    return out;
  };
  const rows = [
    row({ level: "A2", level_name: "Sơ cấp 2", can_do: "Mua bán đơn giản ở chợ: hỏi giá, hỏi số lượng.",
      unit: UNIT, unit_emoji: "🛒", lesson: LESSON, lesson_type: "core", step_type: "dialogue", speaker: "A",
      vi: "Chào cô, táo giá bao nhiêu?", ...langCols({ de: "Hallo, wie viel kosten die Äpfel?", en: "Hello, how much are the apples?" }, true) }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "dialogue", speaker: "B",
      vi: "Táo giá năm mươi nghìn một cân.", ...langCols({ de: "Äpfel kosten fünfzigtausend Dong pro Kilo.", en: "Apples are fifty thousand dong per kilo." }) }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "vocab", vi: "táo", pos: "n", ...langCols({ de: "der Apfel", en: "apple" }) }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "vocab", vi: "cân", pos: "n", ...langCols({ de: "das Kilo", en: "kilogram" }) }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "grammar", vi: "... giá bao nhiêu?", examples: "Táo **giá** bao nhiêu?;Táo **giá** năm mươi nghìn một cân.",
      ...langCols({ de: "Wie viel kostet ...?", en: "How much is ...?" }) }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "phonics", vi: "ch", vi2: "tr", examples: "cha - tra" }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "reading",
      vi: "Ở chợ có nhiều loại trái cây: táo, cam, chuối. Táo giá năm mươi nghìn một cân.",
      ...langCols({ de: "Auf dem Markt gibt es viel Obst: Äpfel, Orangen, Bananen. Äpfel kosten fünfzigtausend Dong pro Kilo.",
        en: "At the market there is a lot of fruit: apples, oranges, bananas. Apples are fifty thousand dong per kilo." }) }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "reading",
      question: "Táo giá bao nhiêu?", choices: "Ba mươi nghìn|Bốn mươi nghìn|Năm mươi nghìn|Sáu mươi nghìn", answer: 3 }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "listening",
      vi: "Ở chợ có nhiều loại trái cây: táo, cam, chuối. Táo giá năm mươi nghìn một cân." }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "listening",
      question: "Táo giá bao nhiêu?", choices: "Ba mươi nghìn|Bốn mươi nghìn|Năm mươi nghìn|Sáu mươi nghìn", answer: 3 }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "writing", task_type: "fill", vi: "Điền từ còn thiếu",
      sentence: "Táo ___ năm mươi nghìn một cân.", answer_text: "giá" }),
    row({ level: "A2", unit: UNIT, lesson: LESSON, step_type: "minigame", game: "meaning_pick" }),
  ];
  return "﻿" + [HEAD, ...rows].map((r) => r.map(bbQ).join(",")).join("\r\n") + "\r\n";
}

export function aiPrompt(langs) {
  const cols = ["level", "level_name", "can_do", "unit", "unit_emoji", "lesson", "lesson_type", "step_type", "speaker",
    "vi", "vi2", "pos", "say", "task_type", "sentence", "answer_text", "words", "min_words", "sample",
    "question", "choices", "answer", "examples", "game", ...langs, ...langs.flatMap((l) => [`unit_${l}`, `lesson_${l}`])].join(",");
  return `Bạn là giáo viên tiếng Việt cho người lớn/người nước ngoài học tiếng Việt (giáo trình "Tiếng Việt Bài Bản"). Hãy soạn nội dung học về chủ đề: [ĐIỀN CHỦ ĐỀ, ví dụ: "Đi chợ"].

Trả về DUY NHẤT một file CSV (UTF-8, phân cách bằng dấu phẩy, dòng đầu là tiêu đề) với đúng các cột:
${cols}

Quy tắc:
- Mỗi dòng là 1 dòng NỘI DUNG của 1 CHẶNG trong 1 bài (KHÁC khu trẻ em — không phải 1 dòng = 1 từ). level: mã CEFR (A1, A2, B1, B2, C1, C2) hoặc "A0" (tiền-A1, bảng chữ cái/ngữ âm). Mọi dòng cùng chủ đề/bài ghi cùng level/unit/lesson.
- level_name, can_do: CHỈ cần điền ở 1 dòng bất kỳ khi TẠO CẤP MỚI (tên cấp + có thể làm được gì); cấp đã có thì để trống, không đổi lại. unit_emoji: 1 emoji cho chủ đề, chỉ cần ở 1 dòng của chủ đề đó. lesson_type: core (mặc định, để trống cũng được) | review (bài ôn tập cuối chủ đề, tự gộp ôn từ vựng/ngữ pháp/ngữ âm/hội thoại của MỌI bài khác cùng chủ đề — luôn đặt bài review làm bài CUỐI của chủ đề) | reading | writing.
- unit: tên chủ đề (ngắn, tiếng Việt). lesson: tên bài — chia chủ đề thành 2–4 bài từ dễ đến khó, ĐẶT TÊN RÕ (vd "Bài 1: Xin chào"), bài cuối nên là bài ôn tập (lesson_type=review).
- step_type — mỗi bài chỉ được 1 chặng/loại qua CSV, nên gộp đủ nội dung của loại đó vào các dòng cùng step_type:
  - dialogue: hội thoại 3-6 câu, speaker A/B xen kẽ, vi = câu.
  - vocab: từ vựng 5-8 từ, vi = từ, pos = loại từ (n/v/adj/adv/pron/num/conj/interj…); say CHỈ cần khi chữ ĐỌC khác chữ hiển thị (vd chữ cái "b" đọc "bờ" — dùng cho chuyên đề bảng chữ cái/ngữ âm cấp A0, từ vựng thường để trống).
  - grammar: 1 công thức + 2-3 ví dụ, vi = công thức (vd "Chào + đại từ"), examples = câu ví dụ cách nhau bằng ";" — gõ **đậm**/*nghiêng*/!!đỏ!!/\`khối nổi\` quanh phần từ trong câu ví dụ khớp đúng công thức để nhấn mạnh lúc hiển thị (vd "Chào **bạn**, táo giá bao nhiêu?" nếu công thức đang dạy là "Chào + đại từ").
  - phonics: 1 CẶP ÂM DỄ NHẦM THẬT theo vùng miền (ch/tr, s/x, d/gi, d/r, l/n) — vi = âm A, vi2 = âm B, examples = ví dụ cách nhau ";"; KHÔNG dùng cho c/k, g/gh, ng/ngh (chỉ khác cách viết, đọc giống nhau — nếu cần giải thích quy tắc viết thì dùng 1 dòng grammar riêng).
  - reading: 1 đoạn văn ngắn (dòng có cột question để TRỐNG, vi = đoạn văn) + 2-3 câu hỏi trắc nghiệm (mỗi câu 1 dòng, question = câu hỏi, choices = 2-6 đáp án cách nhau "|", answer = số thứ tự đáp án đúng đếm từ 1).
  - listening: CÙNG cột như reading (đoạn văn + câu hỏi) nhưng người học sẽ KHÔNG thấy chữ đoạn văn — chỉ nghe; nên chọn đoạn văn ĐƠN GIẢN, câu ngắn, dễ nghe hiểu hơn đoạn dùng cho reading.
  - writing: 1 bài luyện viết, task_type là "fill" (điền từ: vi = đề bài, sentence = câu có chỗ trống "___", answer_text = từ đúng), "order" (xếp câu: vi = đề bài, words = các từ đúng thứ tự cách nhau bằng dấu phẩy) hoặc "write" (viết tự do: vi = đề bài, min_words = số từ tối thiểu, sample = câu mẫu tham khảo, không tự chấm).
  - minigame: game = meaning_pick (nghe từ đoán nghĩa) | phonics_discrim (nghe âm đoán đúng âm trong cặp phonics) | sentence_builder (xếp lại câu từ hội thoại/ngữ pháp cùng bài) — không cần cột nội dung nào khác, chặng này tự lấy dữ liệu từ vựng/ngữ âm/hội thoại/ngữ pháp CÙNG BÀI để chơi.
- Mỗi bài (trừ bài ôn tập) nên có ít nhất: 1 chặng dialogue, 1 chặng vocab, 1 chặng grammar, 1 chặng minigame; thêm phonics/reading/writing nếu phù hợp nội dung, không ép đủ mọi loại ở mọi bài.
- ${langs.map((l) => `Cột "${l}": nghĩa/bản dịch bằng ngôn ngữ mã "${l}", ngắn gọn, đúng nghĩa`).join("\n- ")}
- ${langs.map((l) => `Cột "unit_${l}"/"lesson_${l}"`).join(", ")}: tên chủ đề/tên bài dịch sang ngôn ngữ đó (chỉ cần điền ở 1 dòng của chủ đề/bài đó, để trống ở các dòng còn lại) — CHỈ áp dụng khi TẠO MỚI chủ đề/bài, chủ đề/bài đã có sẵn thì sửa tên dịch trực tiếp trong khu quản trị.
- KHÔNG bịa cách đọc/ngữ âm/nghĩa nếu không chắc — để trống cột đó, người soạn tự điền sau.
- Ô có dấu phẩy phải đặt trong dấu ngoặc kép. Không thêm lời giải thích ngoài file CSV.`;
}
