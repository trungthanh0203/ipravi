import { sb } from "../supabase.js";
import { clamp } from "./util.js";
import { levelOf } from "../levels.js";

// Chỉ tải dữ liệu của màn hình đang cần (chủ đề → bài → nội dung 1 bài). RLS tự lọc mục đã duyệt + còn hạn.

// Danh sách chủ đề/bài ít đổi → nhớ 1 phút trong bộ nhớ để bé bấm qua lại giữa các màn hình không phải chờ mạng mỗi lần.
const TTL = 60_000;
const memo = new Map();
async function cachedFor(key, ttl, load) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await load();
  memo.set(key, { t: Date.now(), v });
  return v;
}
async function cached(key, load) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await load();
  memo.set(key, { t: Date.now(), v });
  return v;
}
export const clearCache = () => memo.clear();

// Ngân hàng âm (chủ đề ẨN): Map chữ → mục (kèm âm thanh) để đánh vần theo phần. Chưa chạy migration 010 / chưa tạo ngân hàng → Map rỗng (dùng giọng trình duyệt).
export const loadSoundBank = () => cachedFor("bank", 300_000, async () => {
  try {
    const units = (await sb.from("units").select("id").eq("hidden", true)).data ?? [];
    if (!units.length) return new Map();
    const lessons = (await sb.from("lessons").select("id").in("unit_id", units.map((u) => u.id))).data ?? [];
    if (!lessons.length) return new Map();
    const { data } = await sb.from("content_items").select("id, text_vi, say_vi, content_audio(*)").in("lesson_id", lessons.map((l) => l.id)).range(0, 999);
    return new Map((data ?? []).map((i) => [i.text_vi, i]));
  } catch {
    return new Map();
  }
});

export const loadUnits = () => cached("units", async () => {
  const { data, error } = await sb.from("units").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []).filter((u) => !u.hidden); // chủ đề ẩn (ngân hàng âm) chỉ để lấy âm thanh
});

export const loadLessons = (unitId) => cached("lessons:" + unitId, async () => {
  const { data, error } = await sb.from("lessons").select("*").eq("unit_id", unitId).order("sort_order");
  if (error) throw error;
  return data ?? [];
});

// Mục của 1 bài kèm nghĩa + âm thanh.
export async function loadLessonItems(lessonId) {
  const { data, error } = await sb
    .from("content_items")
    .select("*, translations(lang, meaning, example), content_audio(*)")
    .eq("lesson_id", lessonId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function loadActivities(lessonId) {
  const { data, error } = await sb.from("activities").select("*").eq("lesson_id", lessonId).order("sort_order");
  if (error) throw error;
  return data ?? [];
}

// ---- Luyện tập ----
// Đọc hết 1 truy vấn theo trang 1000 dòng (PostgREST cắt âm thầm ở 1000). build(from, to) trả về truy vấn đã có .range().
async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

// Danh mục mục học ĐÃ DUYỆT (nhẹ: không kèm âm thanh) để chọn phiên luyện tập ở phía trình duyệt. Mỗi mục gắn unit/level của nó.
// Không có chủ đề ẩn (ngân hàng âm), không có câu hỏi đọc hiểu. Nhớ 5 phút; clearCache() khi bé thoát.
export const loadCatalog = () => cachedFor("catalog", 300_000, async () => {
  const units = (await loadUnits()).filter((u) => u.status === "approved");
  const unitById = new Map(units.map((u) => [u.id, u]));
  const lessons = await fetchAll((a, b) => sb.from("lessons").select("id, unit_id").eq("status", "approved").order("id").range(a, b));
  const unitOfLesson = new Map(lessons.filter((l) => unitById.has(l.unit_id)).map((l) => [l.id, unitById.get(l.unit_id)]));
  const rows = await fetchAll((a, b) => sb.from("content_items")
    .select("id, lesson_id, item_type, text_vi, say_vi, emoji, image_path, pic, translations(lang, meaning)")
    .eq("status", "approved").neq("item_type", "question").order("id").range(a, b));
  return rows.filter((r) => unitOfLesson.has(r.lesson_id)).map((r) => {
    const u = unitOfLesson.get(r.lesson_id);
    return { ...r, unit_id: u.id, level: levelOf(u), unit: { id: u.id, title_vi: u.title_vi, emoji: u.emoji, image_path: u.image_path } };
  });
});

// Tiến độ của bé trên MỌI mục: Map item_id → { mastery, wrong_count, last_seen_at, ... } (dùng làm độ ưu tiên + "từ hay sai").
export async function loadAllProgress(childId) {
  const rows = await fetchAll((a, b) => sb.from("child_progress").select("*").eq("child_id", childId).order("id").range(a, b));
  return new Map(rows.map((r) => [r.item_id, r]));
}

// Mục đầy đủ (kèm nghĩa + âm thanh) của các id đã chọn cho 1 phiên.
export async function loadItemsByIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await sb.from("content_items").select("*, translations(lang, meaning, example), content_audio(*)").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

// Điểm cao nhất (0-100) từng bài đã hoàn thành: Map lesson_id → score.
export async function loadLessonScores(childId, lessonIds) {
  if (lessonIds.length === 0) return new Map();
  const { data, error } = await sb
    .from("activity_log")
    .select("lesson_id, score")
    .eq("child_id", childId)
    .eq("kind", "lesson")
    .in("lesson_id", lessonIds);
  if (error) throw error;
  const best = new Map();
  for (const r of data ?? []) best.set(r.lesson_id, Math.max(best.get(r.lesson_id) ?? 0, Number(r.score ?? 0)));
  return best;
}

export async function loadProgress(childId, itemIds) {
  if (itemIds.length === 0) return new Map();
  const { data, error } = await sb.from("child_progress").select("*").eq("child_id", childId).in("item_id", itemIds);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.item_id, r]));
}

// Các hàm ghi KHÔNG ném lỗi ra ngoài: lưu tiến độ hỏng không được làm gián đoạn bài học của trẻ.
export async function saveAnswer(childId, itemId, correct, prev) {
  const row = {
    child_id: childId,
    item_id: itemId,
    mastery: clamp((prev?.mastery ?? 0) + (correct ? 1 : -1), 0, 5),
    correct_count: (prev?.correct_count ?? 0) + (correct ? 1 : 0),
    wrong_count: (prev?.wrong_count ?? 0) + (correct ? 0 : 1),
    last_seen_at: new Date().toISOString(),
  };
  const { error } = await sb.from("child_progress").upsert(row, { onConflict: "child_id,item_id" });
  if (error) console.warn("saveAnswer", error.message);
  return row;
}

export async function saveActivityLogs(rows) {
  let { error } = await sb.from("activity_log").insert(rows);
  if (error && /skill|source/.test(error.message ?? "")) {
    // Chưa chạy migration 016 (chưa có cột skill/source): vẫn phải lưu được nhật ký của bài học; bỏ luôn dòng phiên luyện tập.
    ({ error } = await sb.from("activity_log").insert(rows.filter((r) => r.source !== "practice").map(({ skill, source, ...rest }) => rest)));
  }
  if (error) console.warn("saveActivityLogs", error.message);
}

export async function savePronunciation(childId, itemId, score, transcript) {
  const { error } = await sb.from("pronunciation_attempts").insert({ child_id: childId, item_id: itemId, score, transcript });
  if (error) console.warn("savePronunciation", error.message);
}
