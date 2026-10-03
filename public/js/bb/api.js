import { sb } from "../supabase.js";
import { nextBox, dueAfter } from "./srs.js";

// Tải dữ liệu "Tiếng Việt Bài Bản". Chỉ tải đúng màn hình đang cần, giống hệt nguyên tắc của khu trẻ em
// (child/api.js): Level → Unit → Lesson → nội dung 1 bài. RLS tự lọc mục đã duyệt + còn hạn.

// Danh sách Level/Unit/Lesson ít đổi → nhớ 1 phút (CÙNG khuôn + TTL với child/api.js) để bé bấm qua lại giữa các
// màn hình (vd Học → Luyện tập → Học lại) không phải chờ mạng mỗi lần. `loadLessonContent`/`loadUnitPool` (nội
// dung 1 bài cụ thể) CỐ Ý không cache, giống child/api.js không cache `loadLessonItems` — chỉ vào 1 lần/lượt học.
const TTL = 60_000;
const memo = new Map();
const visibleStepsCache = new Map(); // "chặng nào có dữ liệu" của loadLessonProgress() — xem chỗ dùng bên dưới
async function cached(key, load) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await load();
  memo.set(key, { t: Date.now(), v });
  return v;
}
export const clearCache = () => { memo.clear(); visibleStepsCache.clear(); };

export const loadLevels = () => cached("levels", async () => {
  const { data, error } = await sb.from("bb_levels").select("*").eq("status", "approved").order("sort_order");
  if (error) throw error;
  return data ?? [];
});

// Nhúng level cha (bb_levels) để màn "Danh sách bài" quay lại đúng level mà không phải tải lại (giống cách
// admin/billing.js nhúng tuition_plans qua payments).
export const loadUnits = (levelId) => cached("units:" + levelId, async () => {
  const { data, error } = await sb.from("bb_units").select("*, bb_levels(id, code, name_vi, can_do)").eq("level_id", levelId).eq("status", "approved").order("sort_order");
  if (error) throw error;
  return data ?? [];
});

export const loadLessons = (unitId) => cached("lessons:" + unitId, async () => {
  const { data, error } = await sb.from("bb_lessons").select("*").eq("unit_id", unitId).eq("status", "approved").order("sort_order");
  if (error) throw error;
  return data ?? [];
});

function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r[key])) m.set(r[key], []);
    m.get(r[key]).push(r);
  }
  return m;
}
const bySortOrder = (rows) => [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

// Chia lô 100 id/lần: .in() dồn cả trăm id vào URL, quá dài sẽ bị cắt/từ chối khi người học đã xong nhiều chặng.
async function fetchByIds(table, ids, col = "step_id") {
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await sb.from(table).select("*").in(col, ids.slice(i, i + 100));
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

// Như fetchByIds() nhưng chỉ lấy ĐÚNG 1 CỘT (`col`) — dùng khi chỉ cần biết "có dòng nào không" (ĐÃ CÓ dữ liệu),
// không cần đọc nội dung — nhẹ hơn nhiều so với select("*") khi bảng có cột to (dialogue/vocab.meaning jsonb…).
async function fetchColOnly(table, ids, col = "step_id") {
  if (!ids.length) return [];
  const { data, error } = await sb.from(table).select(col).in(col, ids);
  if (error) throw error;
  return data ?? [];
}

// Toàn bộ chặng ĐÃ DUYỆT của 1 bài (thứ tự sort_order), mỗi chặng kèm `.content` — hình dạng tuỳ `step_type`:
// dialogue/vocab/grammar/phonics/writing → mảng dòng (sort_order); reading → { passage, questions } hoặc null;
// minigame → null (không có bảng nội dung riêng, xem GĐ 4 trong kế hoạch).
// Đọc + gắn { passage, questions } cho 1 loại chặng dạng "đoạn văn + câu hỏi" (reading/listening dùng CHUNG hình
// dạng, khác bảng CSDL) — tránh lặp lại y hệt logic gộp câu hỏi theo đoạn văn ở 2 nơi.
async function loadPassageContent(passageTable, questionTable, stepIds) {
  const passages = await fetchByIds(passageTable, stepIds);
  const questions = await fetchByIds(questionTable, passages.map((p) => p.id), "passage_id");
  const questionsByPassage = groupBy(questions, "passage_id");
  const byStep = new Map(passages.map((p) => [p.step_id, p]));
  return (stepId) => {
    const passage = byStep.get(stepId) ?? null;
    return passage ? { passage, questions: bySortOrder(questionsByPassage.get(passage.id) ?? []) } : null;
  };
}

export async function loadLessonContent(lessonId) {
  const { data: steps, error } = await sb.from("bb_lesson_steps").select("*").eq("lesson_id", lessonId).eq("status", "approved").order("sort_order");
  if (error) throw error;
  const idsOf = (type) => (steps ?? []).filter((s) => s.step_type === type).map((s) => s.id);

  const [dialogue, vocab, grammar, phonics, readingOf, listeningOf, writing] = await Promise.all([
    fetchByIds("bb_dialogue_lines", idsOf("dialogue")),
    fetchByIds("bb_vocab", idsOf("vocab")),
    fetchByIds("bb_grammar", idsOf("grammar")),
    fetchByIds("bb_phonics_pairs", idsOf("phonics")),
    loadPassageContent("bb_reading_passages", "bb_reading_questions", idsOf("reading")),
    loadPassageContent("bb_listening_passages", "bb_listening_questions", idsOf("listening")),
    fetchByIds("bb_writing_tasks", idsOf("writing")),
  ]);
  const dMap = groupBy(dialogue, "step_id"), vMap = groupBy(vocab, "step_id"), gMap = groupBy(grammar, "step_id");
  const phMap = groupBy(phonics, "step_id"), wMap = groupBy(writing, "step_id");

  return (steps ?? []).map((s) => {
    let content = null;
    if (s.step_type === "dialogue") content = bySortOrder(dMap.get(s.id) ?? []);
    else if (s.step_type === "vocab") content = bySortOrder(vMap.get(s.id) ?? []);
    else if (s.step_type === "grammar") content = bySortOrder(gMap.get(s.id) ?? []);
    else if (s.step_type === "phonics") content = bySortOrder(phMap.get(s.id) ?? []);
    else if (s.step_type === "writing") content = bySortOrder(wMap.get(s.id) ?? []);
    else if (s.step_type === "reading") content = readingOf(s.id);
    else if (s.step_type === "listening") content = listeningOf(s.id);
    return { ...s, content };
  });
}

// Chặng Từ vựng/Ngữ pháp/Ngữ âm/Hội thoại ĐÃ DUYỆT của MỌI bài KHÁC trong CÙNG 1 Chủ đề (loại trừ chính bài đang
// học) — dùng cho bài "Boss cuối Unit" (`lessons.lesson_type === 'review'`): chặng Mini-game của bài Boss tổng hợp
// ôn cả Unit thay vì chỉ riêng bài đó (xem bb/runner.js). Không lấy Đọc hiểu/Luyện viết (Mini-game hiện chưa có
// engine dùng 2 loại đó) và không lấy bài chính nó (đã có trong `steps` riêng của bài rồi, tránh trùng lặp).
export async function loadUnitPool(unitId, excludeLessonId) {
  const { data: lessons, error } = await sb.from("bb_lessons").select("id").eq("unit_id", unitId).eq("status", "approved");
  if (error) throw error;
  const lessonIds = (lessons ?? []).map((l) => l.id).filter((id) => id !== excludeLessonId);
  if (!lessonIds.length) return [];
  const { data: steps, error: e2 } = await sb.from("bb_lesson_steps").select("*").in("lesson_id", lessonIds).eq("status", "approved")
    .in("step_type", ["dialogue", "vocab", "grammar", "phonics"]);
  if (e2) throw e2;
  const idsOf = (type) => (steps ?? []).filter((s) => s.step_type === type).map((s) => s.id);
  const [dialogue, vocab, grammar, phonics] = await Promise.all([
    fetchByIds("bb_dialogue_lines", idsOf("dialogue")),
    fetchByIds("bb_vocab", idsOf("vocab")),
    fetchByIds("bb_grammar", idsOf("grammar")),
    fetchByIds("bb_phonics_pairs", idsOf("phonics")),
  ]);
  const dMap = groupBy(dialogue, "step_id"), vMap = groupBy(vocab, "step_id");
  const gMap = groupBy(grammar, "step_id"), phMap = groupBy(phonics, "step_id");
  const contentOf = { dialogue: dMap, vocab: vMap, grammar: gMap, phonics: phMap };
  return (steps ?? []).map((s) => ({ ...s, content: bySortOrder(contentOf[s.step_type].get(s.id) ?? []) }));
}

// Mục nào chưa từng gặp thì "đến hạn ngay" (mốc thời gian rất xa trong quá khứ) — ôn tập chỉ chặn mục đã gặp qua
// bằng bb_progress, không cần đánh dấu riêng "chưa gặp" ở đây.
const NEVER = "1970-01-01T00:00:00.000Z";

// Đánh dấu 1 chặng đã đi qua (gọi ở bb/runner.js khi chặng đó xong) — chỉ ghi LẦN ĐẦU, các lần học lại sau không
// đổi `completed_at` (mã lỗi 23505 = đã có dòng, coi là bình thường, không phải lỗi thật).
export async function saveStepProgress(childId, stepId) {
  const { error } = await sb.from("bb_progress").insert({ child_id: childId, step_id: stepId });
  if (error && error.code !== "23505") console.warn("saveStepProgress", error.message);
}

// Chặng nào bé ĐÃ HỌC XONG trong 1 bài cụ thể (dùng cho ✓ ở lưới chọn chặng, bb/runner.js) — trả Set các step_id.
export async function loadStepProgress(childId, stepIds) {
  if (!stepIds.length) return new Set();
  const { data, error } = await sb.from("bb_progress").select("step_id").eq("child_id", childId).in("step_id", stepIds);
  if (error) throw error;
  return new Set((data ?? []).map((p) => p.step_id));
}

// "Chặng nào có dữ liệu thật" (khớp bb/runner.js hasContent(), chỉ khác minigame: ở đây không tính feasibility
// theo dữ liệu nguồn, chỉ cần `config.kind` đã chọn — hàm này chạy cho NHIỀU bài 1 lúc nên không tải hết nội dung
// từng bài như lúc vào học 1 bài cụ thể) — CHỈ đổi khi ADMIN sửa nội dung, không đổi theo learner, nên cache 5
// phút (khớp TTL `loadSoundBank` bên child/api.js) để "Quay lại danh sách bài" không phải tính lại từ đầu mỗi lần.
// `fetchColOnly` (chỉ lấy cột step_id, không lấy `select("*")`) vì ở đây chỉ cần biết CÓ dòng nào không.
async function visibleStepsOf(lessonIds) {
  const key = [...lessonIds].sort((a, b) => a - b).join(",");
  const hit = visibleStepsCache.get(key);
  if (hit && Date.now() - hit.t < 300_000) return hit.v;
  const { data: steps, error } = await sb.from("bb_lesson_steps").select("id, lesson_id, step_type, config").eq("status", "approved").in("lesson_id", lessonIds);
  if (error) throw error;
  const idsOf = (type) => (steps ?? []).filter((s) => s.step_type === type).map((s) => s.id);
  const [dialogueRows, vocabRows, grammarRows, phonicsRows, readingRows, listeningRows, writingRows] = await Promise.all([
    fetchColOnly("bb_dialogue_lines", idsOf("dialogue")),
    fetchColOnly("bb_vocab", idsOf("vocab")),
    fetchColOnly("bb_grammar", idsOf("grammar")),
    fetchColOnly("bb_phonics_pairs", idsOf("phonics")),
    fetchColOnly("bb_reading_passages", idsOf("reading")),
    fetchColOnly("bb_listening_passages", idsOf("listening")),
    fetchColOnly("bb_writing_tasks", idsOf("writing")),
  ]);
  const nonEmptyStepIds = new Set([...dialogueRows, ...vocabRows, ...grammarRows, ...phonicsRows, ...readingRows, ...listeningRows, ...writingRows].map((r) => r.step_id));
  const visible = (steps ?? []).filter((s) => (s.step_type === "minigame" ? Boolean(s.config?.kind) : nonEmptyStepIds.has(s.id)));
  visibleStepsCache.set(key, { t: Date.now(), v: visible });
  return visible;
}

// Bài đã hoàn thành = MỌI chặng CÓ DỮ LIỆU THẬT (chặng rỗng bị ẩn khỏi lưới chọn chặng nên KHÔNG THỂ nào có trong
// bb_progress, không được tính vào mẫu số) đều đã có trong bb_progress. Dùng để đánh dấu ✓ ở danh sách bài
// (pages/bai-ban-home.js). Phần "đã xong chưa" (bb_progress) LUÔN tải mới — đây là phần đổi liên tục theo learner,
// khác phần "chặng nào có dữ liệu" ở trên (cache được vì hiếm đổi).
export async function loadLessonProgress(childId, lessonIds) {
  if (!lessonIds.length) return new Set();
  const visible = await visibleStepsOf(lessonIds);
  const totalByLesson = new Map();
  for (const s of visible) totalByLesson.set(s.lesson_id, (totalByLesson.get(s.lesson_id) ?? 0) + 1);
  const stepIds = visible.map((s) => s.id);
  if (!stepIds.length) return new Set();
  const { data: prog, error: e2 } = await sb.from("bb_progress").select("step_id").eq("child_id", childId).in("step_id", stepIds);
  if (e2) throw e2;
  const doneStepIds = new Set((prog ?? []).map((p) => p.step_id));
  const doneByLesson = new Map();
  for (const s of visible) if (doneStepIds.has(s.id)) doneByLesson.set(s.lesson_id, (doneByLesson.get(s.lesson_id) ?? 0) + 1);
  const completed = new Set();
  for (const [lessonId, total] of totalByLesson) if (total > 0 && (doneByLesson.get(lessonId) ?? 0) >= total) completed.add(lessonId);
  return completed;
}

// Mọi mục (4 loại chặng) mà người học ĐÃ GẶP QUA (thuộc 1 chặng có trong bb_progress) kèm trạng thái ôn tập
// (box/due_at/reviewed_count — chưa ôn lần nào thì due_at ở rất xa trong quá khứ = đến hạn ngay). Dùng cho màn
// Luyện tập (bb/practice.js); chọn phiên bằng hàm thuần practice-core.js, không tính ở đây.
// Toàn bộ nội dung các chặng người học ĐÃ HỌC XONG (bb_progress) + trạng thái ôn (bb_srs_state) — nguồn CHUNG cho ôn
// tập kiểu cũ (loadReviewCatalog) lẫn trò Luyện tập mượn từ khu Trẻ em (loadPracticeData). Mỗi dòng nội dung có sẵn step_id.
export async function loadDoneContent(childId) {
  const { data: prog, error } = await sb.from("bb_progress").select("step_id").eq("child_id", childId);
  if (error) throw error;
  const stepIds = (prog ?? []).map((p) => p.step_id);
  const empty = { steps: [], vocab: [], grammar: [], phonics: [], dialogue: [], reading: [], listening: [], srs: [] };
  if (!stepIds.length) return empty;
  const steps = await fetchByIds("bb_lesson_steps", stepIds, "id");
  const idsOf = (type) => steps.filter((s) => s.step_type === type).map((s) => s.id);
  const [vocab, grammar, phonics, dialogue, reading, listening, srs] = await Promise.all([
    fetchByIds("bb_vocab", idsOf("vocab")),
    fetchByIds("bb_grammar", idsOf("grammar")),
    fetchByIds("bb_phonics_pairs", idsOf("phonics")),
    fetchByIds("bb_dialogue_lines", idsOf("dialogue")),
    fetchByIds("bb_reading_passages", idsOf("reading")),
    fetchByIds("bb_listening_passages", idsOf("listening")),
    sb.from("bb_srs_state").select("*").eq("child_id", childId).then(({ data, error: e3 }) => {
      if (e3) throw e3;
      return data ?? [];
    }),
  ]);
  return { steps, vocab, grammar, phonics, dialogue, reading, listening, srs };
}

// box/due_at/reviewed_count/correct_count đủ để bb/practice.js chấm + tự cập nhật catalog trong bộ nhớ SAU KHI
// ôn 1 mục, KHÔNG cần gọi lại loadReviewCatalog()/tự SELECT lại — xem saveVocabResult()/saveReviewBatch() dưới.
export function mergeReview(done) {
  const srsByKey = new Map(done.srs.map((s) => [`${s.item_type}:${s.item_id}`, s]));
  const merge = (rows, type) => rows.map((r) => {
    const s = srsByKey.get(`${type}:${r.id}`);
    return { ...r, box: s?.box ?? 1, due_at: s?.due_at ?? NEVER, reviewed_count: s?.reviewed_count ?? 0, correct_count: s?.correct_count ?? 0 };
  });
  return { vocab: merge(done.vocab, "vocab"), grammar: merge(done.grammar, "grammar"), phonics: merge(done.phonics, "phonics"), dialogue: merge(done.dialogue, "dialogue") };
}
export const loadReviewCatalog = async (childId) => mergeReview(await loadDoneContent(childId));

// Chủ đề/cấp/bài chứa các chặng đã học + câu hỏi của đoạn đọc/nghe — để gắn "đang ở cấp/chủ đề nào" cho từng mục luyện tập.
export async function loadStructure(done) {
  const lessonIds = [...new Set(done.steps.map((s) => s.lesson_id))];
  const lessons = await fetchByIds("bb_lessons", lessonIds, "id");
  const units = await fetchByIds("bb_units", [...new Set(lessons.map((l) => l.unit_id))], "id");
  const levels = await fetchByIds("bb_levels", [...new Set(units.map((u) => u.level_id))], "id");
  const passageIds = [...done.reading, ...done.listening].length;
  const [rq, lq] = passageIds ? await Promise.all([
    fetchByIds("bb_reading_questions", done.reading.map((p) => p.id), "passage_id"),
    fetchByIds("bb_listening_questions", done.listening.map((p) => p.id), "passage_id"),
  ]) : [[], []];
  return { lessons, units, levels, readingQuestions: rq, listeningQuestions: lq };
}

// ---- Nhật ký phiên Luyện tập (bb_practice_log, migration 028) → huy hiệu theo kỹ năng ----
export async function saveGameLogs(rows) {
  const { error } = await sb.from("bb_practice_log").insert(rows);
  if (error) console.warn("saveGameLogs", error.message);
}
// Map kỹ năng → { sessions, good } (phiên "tốt" = dòng tổng kind='practice' từ 85 điểm trở lên).
export async function loadSkillGood(childId, goodScore = 85) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("bb_practice_log").select("skill, score").eq("child_id", childId).eq("kind", "practice").order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const by = new Map();
  for (const r of rows) {
    const e = by.get(r.skill) ?? { skill: r.skill, sessions: 0, good: 0 };
    e.sessions++;
    if ((r.score ?? 0) >= goodScore) e.good++;
    by.set(r.skill, e);
  }
  return by;
}

async function upsertSrs(rows) {
  const { error } = await sb.from("bb_srs_state").upsert(rows, { onConflict: "child_id,item_type,item_id" });
  if (error) console.warn("saveSrs", error.message);
}

// Kết quả 1 thẻ từ vựng (tự đánh giá Nhớ/Quên) — CHỈ 'vocab' dùng box Leitner thật (xem srs.js). Nhận NGUYÊN
// `item` (từ loadReviewCatalog(), đã có box/reviewed_count/correct_count sẵn) thay vì chỉ `itemId` — tránh 1 vòng
// SELECT thừa để tự tra lại đúng những gì caller đã có trong tay (mỗi lần chấm 1 thẻ trước đây tốn 2 round-trip
// mạng liền nhau [SELECT rồi UPSERT], giờ chỉ còn 1). Trả về `{box, due_at}` để caller tự vá lại catalog trong bộ
// nhớ (không cần gọi lại loadReviewCatalog() để thấy đúng số "cần ôn" mới).
export async function saveVocabResult(childId, item, remembered) {
  const box = nextBox(item.box, remembered);
  const due_at = dueAfter(box).toISOString();
  await upsertSrs([{
    child_id: childId, item_type: "vocab", item_id: item.id, box, due_at,
    reviewed_count: (item.reviewed_count ?? 0) + 1,
    correct_count: (item.correct_count ?? 0) + (remembered ? 1 : 0),
    updated_at: new Date().toISOString(),
  }]);
  return { box, due_at };
}

// Đánh dấu "đã ôn lại" cho 1 lượt ôn hội thoại/ngữ pháp/ngữ âm (không chấm, chỉ đẩy hạn ôn tới). Nhận NGUYÊN
// `items` (không phải `itemIds`) cùng lý do với saveVocabResult() — bỏ 1 vòng SELECT thừa. Trả `due_at` mới để
// caller vá catalog trong bộ nhớ.
// Ghi 1 đáp án của trò Luyện tập mượn từ khu Trẻ em lên bb_srs_state (hộp Leitner dùng làm "mức thuộc" của mục) — `row` là
// kết quả adapter.srsAfter(); chỉ 4 loại có bảng ôn (vocab/grammar/phonics/dialogue) mới ghi, đoạn đọc/nghe thì bỏ qua.
export async function saveSrsAnswer(childId, itemType, itemId, row) {
  await upsertSrs([{ child_id: childId, item_type: itemType, item_id: itemId, ...row }]);
}

export const REVIEW_AGAIN_DAYS = 3;
export async function saveReviewBatch(childId, itemType, items) {
  if (!items.length) return null;
  const due_at = new Date(Date.now() + REVIEW_AGAIN_DAYS * 86_400_000).toISOString();
  await upsertSrs(items.map((item) => ({
    child_id: childId, item_type: itemType, item_id: item.id, box: 1, due_at,
    reviewed_count: (item.reviewed_count ?? 0) + 1, correct_count: (item.correct_count ?? 0) + 1,
    updated_at: new Date().toISOString(),
  })));
  return due_at;
}
