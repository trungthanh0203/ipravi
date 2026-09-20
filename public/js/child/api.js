import { sb } from "../supabase.js";
import { clamp } from "./util.js";

// Chỉ tải dữ liệu của màn hình đang cần (chủ đề → bài → nội dung 1 bài). RLS tự lọc mục đã duyệt + còn hạn.

// Danh sách chủ đề/bài ít đổi → nhớ 1 phút trong bộ nhớ để bé bấm qua lại giữa các màn hình không phải chờ mạng mỗi lần.
const TTL = 60_000;
const memo = new Map();
async function cached(key, load) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = await load();
  memo.set(key, { t: Date.now(), v });
  return v;
}
export const clearCache = () => memo.clear();

export const loadUnits = () => cached("units", async () => {
  const { data, error } = await sb.from("units").select("*").order("sort_order");
  if (error) throw error;
  return data ?? [];
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
  const { error } = await sb.from("activity_log").insert(rows);
  if (error) console.warn("saveActivityLogs", error.message);
}

export async function savePronunciation(childId, itemId, score, transcript) {
  const { error } = await sb.from("pronunciation_attempts").insert({ child_id: childId, item_id: itemId, score, transcript });
  if (error) console.warn("savePronunciation", error.message);
}
