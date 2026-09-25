import { sb } from "../supabase.js";
import { synth, getVoices } from "./audio.js";
export { setImage, clearImage } from "./images.js"; // dùng lại NGUYÊN cho bb_vocab.image_path (id + image_path — cùng hình dạng content_items/units)

// CRUD + duyệt/ẩn/xoá cho "Tiếng Việt Bài Bản" (xem KE_HOACH_TIENG_VIET_BAI_BAN.md GĐ 5).
// Đổi thứ tự (▲▼) dùng lại NGUYÊN ops.moveIn(table, group, item, dir) — mọi bảng bb_* đều có id + sort_order,
// đúng hình dạng hàm đó cần, không phải viết lại.

const chunk = (arr, n = 100) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const check = ({ error }) => { if (error) throw error; };
const checkData = ({ data, error }) => { if (error) throw error; return data; };
const clean = (s) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
const only = (obj) => Object.fromEntries(Object.entries(obj ?? {}).map(([k, v]) => [k, clean(v)]).filter(([, v]) => v));
const need = (msg) => { if (msg) throw new Error(msg); };
const nextOrder = (rows) => Math.max(0, ...rows.map((r) => r.sort_order ?? 0)) + 1;
const lines = (s) => String(s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

// ============================================================================
// Cấp (bb_levels)
// ============================================================================
export async function createLevel({ code, name_vi, can_do }, levels) {
  const c = clean(code).toUpperCase();
  need(/^[ABC][12]$/.test(c) ? null : "Mã cấp phải dạng A1, A2, B1, B2, C1 hoặc C2");
  if (levels.some((l) => l.code === c)) throw new Error(`Đã có cấp ${c}.`);
  const title = clean(name_vi);
  need(title ? null : "Cần nhập tên cấp");
  return checkData(await sb.from("bb_levels").insert({ code: c, name_vi: title, can_do: clean(can_do) || null, sort_order: nextOrder(levels), status: "draft" }).select().single());
}
export async function updateLevel(level, { name_vi, can_do }) {
  const patch = {};
  if (name_vi != null && clean(name_vi) !== level.name_vi) { need(clean(name_vi) ? null : "Cần nhập tên cấp"); patch.name_vi = clean(name_vi); }
  if (can_do != null && clean(can_do) !== (level.can_do ?? "")) patch.can_do = clean(can_do) || null;
  if (Object.keys(patch).length) check(await sb.from("bb_levels").update(patch).eq("id", level.id));
  return patch;
}

// ============================================================================
// Chủ đề (bb_units)
// ============================================================================
export async function createUnit(levelId, { title_vi, emoji, description }, siblings) {
  const title = clean(title_vi);
  need(title ? null : "Cần nhập tên chủ đề");
  if (siblings.some((u) => u.title_vi.toLowerCase() === title.toLowerCase())) throw new Error(`Cấp này đã có chủ đề "${title}".`);
  return checkData(await sb.from("bb_units").insert({ level_id: levelId, title_vi: title, emoji: clean(emoji) || null, description: clean(description) || null, sort_order: nextOrder(siblings), status: "draft" }).select().single());
}
export async function updateUnit(unit, { title_vi, emoji, description }) {
  const patch = {};
  if (title_vi != null && clean(title_vi) !== unit.title_vi) { need(clean(title_vi) ? null : "Cần nhập tên chủ đề"); patch.title_vi = clean(title_vi); }
  if (emoji != null && clean(emoji) !== (unit.emoji ?? "")) patch.emoji = clean(emoji) || null;
  if (description != null && clean(description) !== (unit.description ?? "")) patch.description = clean(description) || null;
  if (Object.keys(patch).length) check(await sb.from("bb_units").update(patch).eq("id", unit.id));
  return patch;
}

// ============================================================================
// Bài (bb_lessons)
// ============================================================================
export async function createLesson(unitId, { title_vi, lesson_type, title_tr, description }, siblings) {
  const title = clean(title_vi);
  need(title ? null : "Cần nhập tên bài");
  if (siblings.some((l) => l.title_vi.toLowerCase() === title.toLowerCase())) throw new Error(`Chủ đề này đã có bài "${title}".`);
  const tr = only(title_tr);
  return checkData(await sb.from("bb_lessons").insert({
    unit_id: unitId, title_vi: title, lesson_type: ["core", "review", "reading", "writing"].includes(lesson_type) ? lesson_type : "core",
    title_tr: tr, description: clean(description) || null, sort_order: nextOrder(siblings), status: "draft",
  }).select().single());
}
export async function updateLesson(lesson, { title_vi, lesson_type, title_tr, description }) {
  const patch = {};
  if (title_vi != null && clean(title_vi) !== lesson.title_vi) { need(clean(title_vi) ? null : "Cần nhập tên bài"); patch.title_vi = clean(title_vi); }
  if (lesson_type != null && ["core", "review", "reading", "writing"].includes(lesson_type) && lesson_type !== lesson.lesson_type) patch.lesson_type = lesson_type;
  if (title_tr != null) { const tr = only(title_tr); if (JSON.stringify(tr) !== JSON.stringify(lesson.title_tr ?? {})) patch.title_tr = tr; }
  if (description != null && clean(description) !== (lesson.description ?? "")) patch.description = clean(description) || null;
  if (Object.keys(patch).length) check(await sb.from("bb_lessons").update(patch).eq("id", lesson.id));
  return patch;
}

// ============================================================================
// Chặng (bb_lesson_steps) — 7 loại, cố định lúc tạo (không đổi loại sau khi tạo: đổi loại nghĩa là đổi cả bảng nội
// dung bên dưới, admin nên xoá chặng rồi tạo lại đúng loại thay vì "đổi loại" nửa vời).
// ============================================================================
export const STEP_TYPES = ["dialogue", "vocab", "grammar", "phonics", "minigame", "reading", "writing"];
export async function createStep(lessonId, stepType, siblings) {
  need(STEP_TYPES.includes(stepType) ? null : "Loại chặng không hợp lệ");
  return checkData(await sb.from("bb_lesson_steps").insert({ lesson_id: lessonId, step_type: stepType, sort_order: nextOrder(siblings), status: "draft" }).select().single());
}
// Chặng Mini-game không có bảng nội dung riêng (chạy runtime từ Từ vựng/Ngữ pháp/Ngữ âm/Hội thoại CÙNG BÀI) — chỉ
// cần lưu "chơi kiểu gì" vào `config.kind` (xem bb/steps/minigame.js cho danh sách kind đã cài).
export async function updateStepConfig(step, config) {
  check(await sb.from("bb_lesson_steps").update({ config }).eq("id", step.id));
}

// ============================================================================
// Duyệt / ẩn theo tầng — chặng không có status riêng để hiện, chỉ có 4 tầng: level/unit/lesson/step.
// Ẩn (draft) LAN XUỐNG (giống ops.setLessonsStatus bên khu trẻ em); duyệt (approved) LAN LÊN (tổ tiên phải hiện
// thì nội dung mới hiện được — giống ops.setLessonStatus cascade lên unit).
// ============================================================================
async function approveAncestorsOfLesson(lessonId) {
  const lesson = checkData(await sb.from("bb_lessons").select("unit_id, status").eq("id", lessonId).single());
  if (lesson.status !== "approved") check(await sb.from("bb_lessons").update({ status: "approved" }).eq("id", lessonId));
  await approveAncestorsOfUnit(lesson.unit_id);
}
async function approveAncestorsOfUnit(unitId) {
  const unit = checkData(await sb.from("bb_units").select("level_id, status").eq("id", unitId).single());
  if (unit.status !== "approved") check(await sb.from("bb_units").update({ status: "approved" }).eq("id", unitId));
  check(await sb.from("bb_levels").update({ status: "approved" }).eq("id", unit.level_id));
}

export async function setStepStatus(step, status) {
  check(await sb.from("bb_lesson_steps").update({ status }).eq("id", step.id));
  if (status === "approved") await approveAncestorsOfLesson(step.lesson_id);
}
export async function setLessonStatus(lesson, status) {
  check(await sb.from("bb_lessons").update({ status }).eq("id", lesson.id));
  check(await sb.from("bb_lesson_steps").update({ status }).eq("lesson_id", lesson.id));
  if (status === "approved") await approveAncestorsOfUnit(lesson.unit_id);
}
export async function setUnitStatus(unit, status) {
  check(await sb.from("bb_units").update({ status }).eq("id", unit.id));
  const lessons = checkData(await sb.from("bb_lessons").select("id").eq("unit_id", unit.id));
  if (lessons.length) {
    check(await sb.from("bb_lessons").update({ status }).eq("unit_id", unit.id));
    for (const ids of chunk(lessons.map((l) => l.id))) check(await sb.from("bb_lesson_steps").update({ status }).in("lesson_id", ids));
  }
  if (status === "approved") check(await sb.from("bb_levels").update({ status: "approved" }).eq("id", unit.level_id));
}
export async function setLevelStatus(level, status) {
  check(await sb.from("bb_levels").update({ status }).eq("id", level.id));
  const units = checkData(await sb.from("bb_units").select("id").eq("level_id", level.id));
  for (const ids of chunk(units.map((u) => u.id))) {
    check(await sb.from("bb_units").update({ status }).in("id", ids));
    const lessons = checkData(await sb.from("bb_lessons").select("id").in("unit_id", ids));
    if (lessons.length) {
      check(await sb.from("bb_lessons").update({ status }).in("unit_id", ids));
      for (const lids of chunk(lessons.map((l) => l.id))) check(await sb.from("bb_lesson_steps").update({ status }).in("lesson_id", lids));
    }
  }
}

// ============================================================================
// Xoá theo tầng — Postgres tự xoá dây chuyền (ON DELETE CASCADE, migration 022), CHỈ cần tự dọn file Storage
// (ảnh/âm thanh) trước vì Storage không nằm trong CSDL nên không tự xoá theo.
// ============================================================================
async function stepIdsOfLessons(lessonIds) {
  if (!lessonIds.length) return [];
  return checkData(await sb.from("bb_lesson_steps").select("id").in("lesson_id", lessonIds)).map((r) => r.id);
}
async function lessonIdsOfUnits(unitIds) {
  if (!unitIds.length) return [];
  return checkData(await sb.from("bb_lessons").select("id").in("unit_id", unitIds)).map((r) => r.id);
}
async function unitIdsOfLevel(levelId) {
  return checkData(await sb.from("bb_units").select("id").eq("level_id", levelId)).map((r) => r.id);
}
async function removeStepFiles(stepIds) {
  if (!stepIds.length) return;
  const paths = [];
  for (const ids of chunk(stepIds)) {
    const [dl, vo, ph, pa] = await Promise.all([
      sb.from("bb_dialogue_lines").select("audio_path").in("step_id", ids),
      sb.from("bb_vocab").select("audio_path, image_path").in("step_id", ids),
      sb.from("bb_phonics_pairs").select("audio_a_path, audio_b_path").in("step_id", ids),
      sb.from("bb_reading_passages").select("audio_path").in("step_id", ids),
    ].map((p) => p.then(checkData)));
    for (const r of dl) if (r.audio_path) paths.push(r.audio_path);
    for (const r of vo) { if (r.audio_path) paths.push(r.audio_path); if (r.image_path) paths.push(r.image_path); }
    for (const r of ph) { if (r.audio_a_path) paths.push(r.audio_a_path); if (r.audio_b_path) paths.push(r.audio_b_path); }
    for (const r of pa) if (r.audio_path) paths.push(r.audio_path);
  }
  for (const p of chunk(paths)) if (p.length) await sb.storage.from("content").remove(p);
}

export async function deleteStep(stepId) {
  await removeStepFiles([stepId]);
  check(await sb.from("bb_lesson_steps").delete().eq("id", stepId));
}
export async function deleteLesson(lessonId) {
  await removeStepFiles(await stepIdsOfLessons([lessonId]));
  check(await sb.from("bb_lessons").delete().eq("id", lessonId));
}
export async function deleteUnit(unitId) {
  await removeStepFiles(await stepIdsOfLessons(await lessonIdsOfUnits([unitId])));
  check(await sb.from("bb_units").delete().eq("id", unitId));
}
export async function deleteLevel(levelId) {
  const unitIds = await unitIdsOfLevel(levelId);
  await removeStepFiles(await stepIdsOfLessons(await lessonIdsOfUnits(unitIds)));
  check(await sb.from("bb_levels").delete().eq("id", levelId));
}

// ============================================================================
// Âm thanh (đường dẫn phẳng — audio_path/audio_a_path/audio_b_path — KHÁC hẳn content_audio nhiều-dòng bên khu trẻ
// em; Bài Bản chưa có pipeline TTS riêng, GĐ 5 chỉ cho tải file âm thanh admin đã có sẵn lên).
// ============================================================================
export async function setAudioPath(table, row, col, file) {
  need(/^audio\//.test(file.type) || /\.(mp3|wav|m4a|ogg|webm)$/i.test(file.name) ? null : "File phải là âm thanh (mp3/wav/m4a/ogg).");
  need(file.size <= 5 * 1024 * 1024 ? null : "File âm thanh quá 5 MB.");
  const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
  const path = `bb/audio/${table}-${row.id}-${col}-${Date.now()}.${ext}`;
  const up = await sb.storage.from("content").upload(path, file, { upsert: false });
  if (up.error) throw new Error("Tải âm thanh lên thất bại: " + up.error.message);
  const { error } = await sb.from(table).update({ [col]: path }).eq("id", row.id);
  if (error) { await sb.storage.from("content").remove([path]); throw error; }
  if (row[col]) await sb.storage.from("content").remove([row[col]]);
  row[col] = path;
  return path;
}
export async function clearAudioPath(table, row, col) {
  if (!row[col]) return;
  check(await sb.from(table).update({ [col]: null }).eq("id", row.id));
  await sb.storage.from("content").remove([row[col]]);
  row[col] = null;
}

// Sinh âm thanh bằng TTS (dùng lại NGUYÊN /api/tts qua admin/audio.js synth() — cùng Worker, cùng giọng đã cấu hình
// ở tab Cài đặt) rồi lưu như audio_path thường (KHÔNG phải content_audio nhiều-dòng của khu trẻ em — chỉ 1 file
// mới nhất/cột, sinh lại thì GHI ĐÈ). lang mặc định 'vi' (giọng người học đang nghe là tiếng Việt); gender mặc định
// nữ (chưa có UI chọn giới cho Bài Bản — đơn giản hoá GĐ 5, xem KE_HOACH_TIENG_VIET_BAI_BAN.md).
export async function generateAudio(table, row, col, text, lang = "vi", gender = "female") {
  need(text && text.trim() ? null : "Chưa có chữ để đọc");
  const chosen = (await getVoices())[lang]?.[gender];
  const { blob } = await synth(text.trim(), lang, "normal", chosen, gender);
  const path = `bb/audio/${table}-${row.id}-${col}-${Date.now()}.mp3`;
  const up = await sb.storage.from("content").upload(path, blob, { contentType: "audio/mpeg", upsert: false });
  if (up.error) throw new Error("Tải âm thanh TTS lên thất bại: " + up.error.message);
  const { error } = await sb.from(table).update({ [col]: path }).eq("id", row.id);
  if (error) { await sb.storage.from("content").remove([path]); throw error; }
  if (row[col]) await sb.storage.from("content").remove([row[col]]);
  row[col] = path;
  return path;
}

// ============================================================================
// Nội dung từng loại chặng — KHÔNG có status riêng, hiện/ẩn theo status của CHẶNG cha.
// ============================================================================

// ---- Hội thoại ----
export async function createDialogueLine(stepId, { speaker, line_vi, line_tr }, siblings) {
  const vi = clean(line_vi);
  need(vi ? null : "Cần nhập câu tiếng Việt");
  return checkData(await sb.from("bb_dialogue_lines").insert({ step_id: stepId, speaker: clean(speaker) || "A", line_vi: vi, line_tr: only(line_tr), sort_order: nextOrder(siblings) }).select().single());
}
export async function updateDialogueLine(row, { speaker, line_vi, line_tr }) {
  const patch = {};
  if (speaker != null) patch.speaker = clean(speaker) || "A";
  if (line_vi != null) { need(clean(line_vi) ? null : "Cần nhập câu tiếng Việt"); patch.line_vi = clean(line_vi); }
  if (line_tr != null) patch.line_tr = only(line_tr);
  if (Object.keys(patch).length) check(await sb.from("bb_dialogue_lines").update(patch).eq("id", row.id));
}
export async function deleteDialogueLine(row) {
  if (row.audio_path) await sb.storage.from("content").remove([row.audio_path]);
  check(await sb.from("bb_dialogue_lines").delete().eq("id", row.id));
}

// ---- Từ vựng ----
export async function createVocab(stepId, { word_vi, pos, meaning }, siblings) {
  const w = clean(word_vi);
  need(w ? null : "Cần nhập từ tiếng Việt");
  return checkData(await sb.from("bb_vocab").insert({ step_id: stepId, word_vi: w, pos: clean(pos) || null, meaning: only(meaning), sort_order: nextOrder(siblings) }).select().single());
}
export async function updateVocab(row, { word_vi, pos, meaning }) {
  const patch = {};
  if (word_vi != null) { need(clean(word_vi) ? null : "Cần nhập từ tiếng Việt"); patch.word_vi = clean(word_vi); }
  if (pos != null) patch.pos = clean(pos) || null;
  if (meaning != null) patch.meaning = only(meaning);
  if (Object.keys(patch).length) check(await sb.from("bb_vocab").update(patch).eq("id", row.id));
}
export async function deleteVocab(row) {
  if (row.image_path) await sb.storage.from("content").remove([row.image_path]);
  if (row.audio_path) await sb.storage.from("content").remove([row.audio_path]);
  check(await sb.from("bb_vocab").delete().eq("id", row.id));
}

// ---- Ngữ pháp (examples: MVP chỉ câu vi, chưa hỗ trợ dịch từng ví dụ trong biểu mẫu nhanh — sửa bằng SQL nếu cần) ----
export async function createGrammar(stepId, { formula, formula_tr, examples }, siblings) {
  const f = clean(formula);
  need(f ? null : "Cần nhập công thức");
  return checkData(await sb.from("bb_grammar").insert({ step_id: stepId, formula: f, formula_tr: only(formula_tr), examples: lines(examples).map((vi) => ({ vi })), sort_order: nextOrder(siblings) }).select().single());
}
export async function updateGrammar(row, { formula, formula_tr, examples }) {
  const patch = {};
  if (formula != null) { need(clean(formula) ? null : "Cần nhập công thức"); patch.formula = clean(formula); }
  if (formula_tr != null) patch.formula_tr = only(formula_tr);
  if (examples != null) patch.examples = lines(examples).map((vi) => ({ vi }));
  if (Object.keys(patch).length) check(await sb.from("bb_grammar").update(patch).eq("id", row.id));
}
export const deleteGrammar = (id) => sb.from("bb_grammar").delete().eq("id", id).then(check);

// ---- Ngữ âm ----
export async function createPhonicsPair(stepId, { sound_a, sound_b, examples }, siblings) {
  const a = clean(sound_a), b = clean(sound_b);
  need(a && b ? null : "Cần nhập cả 2 âm");
  return checkData(await sb.from("bb_phonics_pairs").insert({ step_id: stepId, sound_a: a, sound_b: b, examples: lines(examples), sort_order: nextOrder(siblings) }).select().single());
}
export async function updatePhonicsPair(row, { sound_a, sound_b, examples }) {
  const patch = {};
  if (sound_a != null) { need(clean(sound_a) ? null : "Cần nhập âm A"); patch.sound_a = clean(sound_a); }
  if (sound_b != null) { need(clean(sound_b) ? null : "Cần nhập âm B"); patch.sound_b = clean(sound_b); }
  if (examples != null) patch.examples = lines(examples);
  if (Object.keys(patch).length) check(await sb.from("bb_phonics_pairs").update(patch).eq("id", row.id));
}
export async function deletePhonicsPair(row) {
  const paths = [row.audio_a_path, row.audio_b_path].filter(Boolean);
  if (paths.length) await sb.storage.from("content").remove(paths);
  check(await sb.from("bb_phonics_pairs").delete().eq("id", row.id));
}

// ---- Đọc hiểu: đoạn văn + câu hỏi ----
export async function createPassage(stepId, { passage_vi, passage_tr }) {
  const vi = clean(passage_vi);
  need(vi ? null : "Cần nhập đoạn văn");
  return checkData(await sb.from("bb_reading_passages").insert({ step_id: stepId, passage_vi: vi, passage_tr: only(passage_tr) }).select().single());
}
export async function updatePassage(row, { passage_vi, passage_tr }) {
  const patch = {};
  if (passage_vi != null) { need(clean(passage_vi) ? null : "Cần nhập đoạn văn"); patch.passage_vi = clean(passage_vi); }
  if (passage_tr != null) patch.passage_tr = only(passage_tr);
  if (Object.keys(patch).length) check(await sb.from("bb_reading_passages").update(patch).eq("id", row.id));
}
export async function deletePassage(row) {
  if (row.audio_path) await sb.storage.from("content").remove([row.audio_path]);
  check(await sb.from("bb_reading_passages").delete().eq("id", row.id)); // xoá dây chuyền câu hỏi (ON DELETE CASCADE)
}
export async function createQuestion(passageId, { question_vi, choices, answer }, siblings) {
  const q = clean(question_vi);
  need(q ? null : "Cần nhập câu hỏi");
  const opts = String(choices ?? "").split("|").map((c) => c.trim()).filter(Boolean);
  need(opts.length >= 2 ? null : "Cần ít nhất 2 đáp án, cách nhau bằng dấu |");
  const ans = Number(answer);
  need(ans >= 1 && ans <= opts.length ? null : `Đáp án đúng phải từ 1 đến ${opts.length}`);
  return checkData(await sb.from("bb_reading_questions").insert({ passage_id: passageId, question_vi: q, choices: opts, answer: ans, sort_order: nextOrder(siblings) }).select().single());
}
export async function updateQuestion(row, { question_vi, choices, answer }) {
  const patch = {};
  if (question_vi != null) { need(clean(question_vi) ? null : "Cần nhập câu hỏi"); patch.question_vi = clean(question_vi); }
  if (choices != null) {
    const opts = String(choices).split("|").map((c) => c.trim()).filter(Boolean);
    need(opts.length >= 2 ? null : "Cần ít nhất 2 đáp án, cách nhau bằng dấu |");
    patch.choices = opts;
  }
  if (answer != null) {
    const opts = patch.choices ?? row.choices;
    const ans = Number(answer);
    need(ans >= 1 && ans <= opts.length ? null : `Đáp án đúng phải từ 1 đến ${opts.length}`);
    patch.answer = ans;
  }
  if (Object.keys(patch).length) check(await sb.from("bb_reading_questions").update(patch).eq("id", row.id));
}
export const deleteQuestion = (id) => sb.from("bb_reading_questions").delete().eq("id", id).then(check);

// ---- Luyện viết ----
export async function createWritingTask(stepId, { task_type, prompt_vi, prompt_tr, content }, siblings) {
  need(["fill", "order", "write"].includes(task_type) ? null : "Loại bài luyện viết không hợp lệ");
  const p = clean(prompt_vi);
  need(p ? null : "Cần nhập đề bài");
  return checkData(await sb.from("bb_writing_tasks").insert({ step_id: stepId, task_type, prompt_vi: p, prompt_tr: only(prompt_tr), content, sort_order: nextOrder(siblings) }).select().single());
}
export async function updateWritingTask(row, { prompt_vi, prompt_tr, content }) {
  const patch = {};
  if (prompt_vi != null) { need(clean(prompt_vi) ? null : "Cần nhập đề bài"); patch.prompt_vi = clean(prompt_vi); }
  if (prompt_tr != null) patch.prompt_tr = only(prompt_tr);
  if (content != null) patch.content = content;
  if (Object.keys(patch).length) check(await sb.from("bb_writing_tasks").update(patch).eq("id", row.id));
}
export const deleteWritingTask = (id) => sb.from("bb_writing_tasks").delete().eq("id", id).then(check);

// ============================================================================
// Nhập CSV hàng loạt (admin/bb-csv.js `buildPlan()` tính TRƯỚC kế hoạch thuần, hàm này mới THỰC THI lên CSDL).
// Nội dung trong 1 chặng ĐÃ CÓ được so trùng theo chữ chính (không phân biệt hoa/thường) để KHÔNG tạo trùng khi
// nhập lại — giống nguyên tắc "Nhập CSV luôn tạo NHÁP, chạy lại không tạo trùng" của khu trẻ em.
// ============================================================================
const ciKey = (s) => clean(s).toLowerCase();

// rows: mảng đối tượng từ plan.groups[].rows; buildRow(row) -> payload cột CSDL (không có step_id/sort_order).
// mainCol: cột dùng để so trùng với nội dung ĐÃ CÓ trong chặng.
async function upsertContentRows(table, stepId, mainCol, rows, buildRow) {
  if (!rows.length) return;
  const existing = checkData(await sb.from(table).select("*").eq("step_id", stepId));
  const byKey = new Map(existing.map((r) => [ciKey(r[mainCol]), r]));
  let order = nextOrder(existing);
  const toInsert = [];
  for (const row of rows) {
    const payload = buildRow(row);
    const match = byKey.get(ciKey(payload[mainCol]));
    if (match) check(await sb.from(table).update(payload).eq("id", match.id));
    else toInsert.push({ step_id: stepId, sort_order: ++order, ...payload });
  }
  if (toInsert.length) check(await sb.from(table).insert(toInsert));
}

// Đoạn văn đọc hiểu: TỐI ĐA 1/chặng — ghi đè nếu đã có, tạo mới nếu chưa. Trả về id để gắn câu hỏi.
async function upsertPassage(stepId, row) {
  const existing = checkData(await sb.from("bb_reading_passages").select("id").eq("step_id", stepId));
  const payload = { passage_vi: row.vi, passage_tr: only(row.tr) };
  if (existing[0]) { check(await sb.from("bb_reading_passages").update(payload).eq("id", existing[0].id)); return existing[0].id; }
  return checkData(await sb.from("bb_reading_passages").insert({ step_id: stepId, ...payload }).select("id").single()).id;
}
async function upsertQuestions(passageId, rows) {
  if (!rows.length) return;
  const existing = checkData(await sb.from("bb_reading_questions").select("*").eq("passage_id", passageId));
  const byKey = new Map(existing.map((r) => [ciKey(r.question_vi), r]));
  let order = nextOrder(existing);
  const toInsert = [];
  for (const row of rows) {
    const payload = { question_vi: row.question, choices: row.choices, answer: row.answer };
    const match = byKey.get(ciKey(row.question));
    if (match) check(await sb.from("bb_reading_questions").update(payload).eq("id", match.id));
    else toInsert.push({ passage_id: passageId, sort_order: ++order, ...payload });
  }
  if (toInsert.length) check(await sb.from("bb_reading_questions").insert(toInsert));
}

// Thực thi kế hoạch từ bb-csv.buildPlan(). Trả { levels, units, lessons, steps } (số dòng mới tạo ở mỗi tầng) để
// admin/bb.js báo tóm tắt. `existing` PHẢI là dữ liệu vừa tải (levels/units/lessons/steps) — dùng để tra id thật.
export async function importPlan(plan, existing) {
  const levelByCode = new Map(existing.levels.map((l) => [l.code, l]));
  for (const nl of plan.newLevels) {
    const row = checkData(await sb.from("bb_levels").insert({ code: nl.code, name_vi: nl.name_vi, can_do: nl.can_do, sort_order: nextOrder([...existing.levels, ...levelByCode.values()]), status: "draft" }).select().single());
    levelByCode.set(row.code, row);
  }
  const unitByKey = new Map(existing.units.map((u) => [`${u.level_id}|${ciKey(u.title_vi)}`, u]));
  for (const nu of plan.newUnits) {
    const levelId = levelByCode.get(nu.level).id;
    const siblings = existing.units.filter((u) => u.level_id === levelId);
    const row = checkData(await sb.from("bb_units").insert({ level_id: levelId, title_vi: nu.title_vi, emoji: nu.emoji, sort_order: nextOrder(siblings), status: "draft" }).select().single());
    unitByKey.set(`${levelId}|${ciKey(nu.title_vi)}`, row);
  }
  const lessonByKey = new Map(existing.lessons.map((l) => [`${l.unit_id}|${ciKey(l.title_vi)}`, l]));
  for (const nl of plan.newLessons) {
    const unitId = unitByKey.get(`${levelByCode.get(nl.level).id}|${ciKey(nl.unit)}`).id;
    const siblings = existing.lessons.filter((l) => l.unit_id === unitId);
    const row = checkData(await sb.from("bb_lessons").insert({ unit_id: unitId, title_vi: nl.title_vi, lesson_type: nl.lesson_type, title_tr: {}, sort_order: nextOrder(siblings), status: "draft" }).select().single());
    lessonByKey.set(`${unitId}|${ciKey(nl.title_vi)}`, row);
  }
  const stepByKey = new Map(existing.steps.map((s) => [`${s.lesson_id}|${s.step_type}`, s]));
  for (const ns of plan.newSteps) {
    const unitId = unitByKey.get(`${levelByCode.get(ns.level).id}|${ciKey(ns.unit)}`).id;
    const lessonId = lessonByKey.get(`${unitId}|${ciKey(ns.lesson)}`).id;
    const siblings = existing.steps.filter((s) => s.lesson_id === lessonId);
    const row = checkData(await sb.from("bb_lesson_steps").insert({ lesson_id: lessonId, step_type: ns.step_type, sort_order: nextOrder(siblings), status: "draft" }).select().single());
    stepByKey.set(`${lessonId}|${ns.step_type}`, row);
  }

  for (const g of plan.groups) {
    const unitId = unitByKey.get(`${levelByCode.get(g.level).id}|${ciKey(g.unit)}`).id;
    const lessonId = lessonByKey.get(`${unitId}|${ciKey(g.lesson)}`).id;
    const stepId = stepByKey.get(`${lessonId}|${g.stepType}`).id;
    if (g.stepType === "dialogue") {
      await upsertContentRows("bb_dialogue_lines", stepId, "line_vi", g.rows, (r) => ({ speaker: r.speaker, line_vi: r.vi, line_tr: only(r.tr) }));
    } else if (g.stepType === "vocab") {
      await upsertContentRows("bb_vocab", stepId, "word_vi", g.rows, (r) => ({ word_vi: r.vi, pos: r.pos, meaning: only(r.tr) }));
    } else if (g.stepType === "grammar") {
      await upsertContentRows("bb_grammar", stepId, "formula", g.rows, (r) => ({ formula: r.vi, formula_tr: only(r.tr), examples: r.examples.map((vi) => ({ vi })) }));
    } else if (g.stepType === "phonics") {
      await upsertContentRows("bb_phonics_pairs", stepId, "sound_a", g.rows, (r) => ({ sound_a: r.a, sound_b: r.b, examples: r.examples }));
    } else if (g.stepType === "writing") {
      await upsertContentRows("bb_writing_tasks", stepId, "prompt_vi", g.rows, (r) => ({ task_type: r.taskType, prompt_vi: r.vi, prompt_tr: only(r.tr), content: r.taskContent }));
    } else if (g.stepType === "reading") {
      const passageRow = g.rows.find((r) => r.kind === "passage");
      const questionRows = g.rows.filter((r) => r.kind === "question");
      if (passageRow) {
        const passageId = await upsertPassage(stepId, passageRow);
        await upsertQuestions(passageId, questionRows);
      }
    }
  }
  return { levels: plan.newLevels.length, units: plan.newUnits.length, lessons: plan.newLessons.length, steps: plan.newSteps.length, rows: plan.counts.rows };
}
