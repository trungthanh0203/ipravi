import { sb } from "../supabase.js";
import { nextBox, dueAfter } from "./srs.js";

// Tải dữ liệu "Tiếng Việt Bài Bản" (xem KE_HOACH_TIENG_VIET_BAI_BAN.md). Chỉ tải đúng màn hình đang cần, giống hệt
// nguyên tắc của khu trẻ em (child/api.js): Level → Unit → Lesson → nội dung 1 bài. RLS tự lọc mục đã duyệt + còn hạn.

export async function loadLevels() {
  const { data, error } = await sb.from("bb_levels").select("*").eq("status", "approved").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

// Nhúng level cha (bb_levels) để màn "Danh sách bài" quay lại đúng level mà không phải tải lại (giống cách
// admin/billing.js nhúng tuition_plans qua payments).
export async function loadUnits(levelId) {
  const { data, error } = await sb.from("bb_units").select("*, bb_levels(id, code, name_vi, can_do)").eq("level_id", levelId).eq("status", "approved").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function loadLessons(unitId) {
  const { data, error } = await sb.from("bb_lessons").select("*").eq("unit_id", unitId).eq("status", "approved").order("sort_order");
  if (error) throw error;
  return data ?? [];
}

function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r[key])) m.set(r[key], []);
    m.get(r[key]).push(r);
  }
  return m;
}
const bySortOrder = (rows) => [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

async function fetchByIds(table, ids, col = "step_id") {
  if (!ids.length) return [];
  const { data, error } = await sb.from(table).select("*").in(col, ids);
  if (error) throw error;
  return data ?? [];
}

// Toàn bộ chặng ĐÃ DUYỆT của 1 bài (thứ tự sort_order), mỗi chặng kèm `.content` — hình dạng tuỳ `step_type`:
// dialogue/vocab/grammar/phonics/writing → mảng dòng (sort_order); reading → { passage, questions } hoặc null;
// minigame → null (không có bảng nội dung riêng, xem GĐ 4 trong kế hoạch).
export async function loadLessonContent(lessonId) {
  const { data: steps, error } = await sb.from("bb_lesson_steps").select("*").eq("lesson_id", lessonId).eq("status", "approved").order("sort_order");
  if (error) throw error;
  const idsOf = (type) => (steps ?? []).filter((s) => s.step_type === type).map((s) => s.id);

  const [dialogue, vocab, grammar, phonics, passages, writing] = await Promise.all([
    fetchByIds("bb_dialogue_lines", idsOf("dialogue")),
    fetchByIds("bb_vocab", idsOf("vocab")),
    fetchByIds("bb_grammar", idsOf("grammar")),
    fetchByIds("bb_phonics_pairs", idsOf("phonics")),
    fetchByIds("bb_reading_passages", idsOf("reading")),
    fetchByIds("bb_writing_tasks", idsOf("writing")),
  ]);
  const questions = await fetchByIds("bb_reading_questions", passages.map((p) => p.id), "passage_id");
  const questionsByPassage = groupBy(questions, "passage_id");
  const passageByStep = new Map(passages.map((p) => [p.step_id, p]));
  const dMap = groupBy(dialogue, "step_id"), vMap = groupBy(vocab, "step_id"), gMap = groupBy(grammar, "step_id");
  const phMap = groupBy(phonics, "step_id"), wMap = groupBy(writing, "step_id");

  return (steps ?? []).map((s) => {
    let content = null;
    if (s.step_type === "dialogue") content = bySortOrder(dMap.get(s.id) ?? []);
    else if (s.step_type === "vocab") content = bySortOrder(vMap.get(s.id) ?? []);
    else if (s.step_type === "grammar") content = bySortOrder(gMap.get(s.id) ?? []);
    else if (s.step_type === "phonics") content = bySortOrder(phMap.get(s.id) ?? []);
    else if (s.step_type === "writing") content = bySortOrder(wMap.get(s.id) ?? []);
    else if (s.step_type === "reading") {
      const passage = passageByStep.get(s.id) ?? null;
      content = passage ? { passage, questions: bySortOrder(questionsByPassage.get(passage.id) ?? []) } : null;
    }
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

// Bài đã hoàn thành = MỌI chặng đã duyệt của bài đó đều có trong bb_progress. Dùng để đánh dấu ✓ ở danh sách bài.
export async function loadLessonProgress(childId, lessonIds) {
  if (!lessonIds.length) return new Set();
  const { data: steps, error } = await sb.from("bb_lesson_steps").select("id, lesson_id").eq("status", "approved").in("lesson_id", lessonIds);
  if (error) throw error;
  const totalByLesson = new Map();
  for (const s of steps ?? []) totalByLesson.set(s.lesson_id, (totalByLesson.get(s.lesson_id) ?? 0) + 1);
  const stepIds = (steps ?? []).map((s) => s.id);
  if (!stepIds.length) return new Set();
  const { data: prog, error: e2 } = await sb.from("bb_progress").select("step_id").eq("child_id", childId).in("step_id", stepIds);
  if (e2) throw e2;
  const doneStepIds = new Set((prog ?? []).map((p) => p.step_id));
  const doneByLesson = new Map();
  for (const s of steps ?? []) if (doneStepIds.has(s.id)) doneByLesson.set(s.lesson_id, (doneByLesson.get(s.lesson_id) ?? 0) + 1);
  const completed = new Set();
  for (const [lessonId, total] of totalByLesson) if (total > 0 && (doneByLesson.get(lessonId) ?? 0) >= total) completed.add(lessonId);
  return completed;
}

// Mọi mục (4 loại chặng) mà người học ĐÃ GẶP QUA (thuộc 1 chặng có trong bb_progress) kèm trạng thái ôn tập
// (box/due_at/reviewed_count — chưa ôn lần nào thì due_at ở rất xa trong quá khứ = đến hạn ngay). Dùng cho màn
// Luyện tập (bb/practice.js); chọn phiên bằng hàm thuần practice-core.js, không tính ở đây.
export async function loadReviewCatalog(childId) {
  const { data: prog, error } = await sb.from("bb_progress").select("step_id").eq("child_id", childId);
  if (error) throw error;
  const stepIds = (prog ?? []).map((p) => p.step_id);
  if (!stepIds.length) return { vocab: [], grammar: [], phonics: [], dialogue: [] };
  const { data: steps, error: e2 } = await sb.from("bb_lesson_steps").select("id, step_type").in("id", stepIds);
  if (e2) throw e2;
  const idsOf = (type) => (steps ?? []).filter((s) => s.step_type === type).map((s) => s.id);

  const [vocab, grammar, phonics, dialogue, srs] = await Promise.all([
    fetchByIds("bb_vocab", idsOf("vocab")),
    fetchByIds("bb_grammar", idsOf("grammar")),
    fetchByIds("bb_phonics_pairs", idsOf("phonics")),
    fetchByIds("bb_dialogue_lines", idsOf("dialogue")),
    sb.from("bb_srs_state").select("*").eq("child_id", childId).then(({ data, error: e3 }) => {
      if (e3) throw e3;
      return data ?? [];
    }),
  ]);
  const srsByKey = new Map(srs.map((s) => [`${s.item_type}:${s.item_id}`, s]));
  const merge = (rows, type) => rows.map((r) => {
    const s = srsByKey.get(`${type}:${r.id}`);
    return { ...r, box: s?.box ?? 1, due_at: s?.due_at ?? NEVER, reviewed_count: s?.reviewed_count ?? 0 };
  });
  return { vocab: merge(vocab, "vocab"), grammar: merge(grammar, "grammar"), phonics: merge(phonics, "phonics"), dialogue: merge(dialogue, "dialogue") };
}

async function upsertSrs(rows) {
  const { error } = await sb.from("bb_srs_state").upsert(rows, { onConflict: "child_id,item_type,item_id" });
  if (error) console.warn("saveSrs", error.message);
}

// Kết quả 1 thẻ từ vựng (tự đánh giá Nhớ/Quên) — CHỈ 'vocab' dùng box Leitner thật (xem srs.js).
export async function saveVocabResult(childId, itemId, remembered) {
  const { data } = await sb.from("bb_srs_state").select("*").eq("child_id", childId).eq("item_type", "vocab").eq("item_id", itemId);
  const prev = data?.[0];
  const box = nextBox(prev?.box, remembered);
  await upsertSrs([{
    child_id: childId, item_type: "vocab", item_id: itemId, box,
    due_at: dueAfter(box).toISOString(),
    reviewed_count: (prev?.reviewed_count ?? 0) + 1,
    correct_count: (prev?.correct_count ?? 0) + (remembered ? 1 : 0),
    updated_at: new Date().toISOString(),
  }]);
}

// Đánh dấu "đã ôn lại" cho 1 lượt ôn hội thoại/ngữ pháp/ngữ âm (không chấm, chỉ đẩy hạn ôn tới — xem GĐ 4 trong kế hoạch).
const REVIEW_AGAIN_DAYS = 3;
export async function saveReviewBatch(childId, itemType, itemIds) {
  if (!itemIds.length) return;
  const { data } = await sb.from("bb_srs_state").select("*").eq("child_id", childId).eq("item_type", itemType).in("item_id", itemIds);
  const prevByItem = new Map((data ?? []).map((r) => [r.item_id, r]));
  const dueAt = new Date(Date.now() + REVIEW_AGAIN_DAYS * 86_400_000).toISOString();
  await upsertSrs(itemIds.map((id) => {
    const prev = prevByItem.get(id);
    return {
      child_id: childId, item_type: itemType, item_id: id, box: 1, due_at: dueAt,
      reviewed_count: (prev?.reviewed_count ?? 0) + 1, correct_count: (prev?.correct_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    };
  }));
}
