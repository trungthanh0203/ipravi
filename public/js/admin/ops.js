import { sb } from "../supabase.js";

// Duyệt / ẩn / xoá nội dung. Trẻ chỉ thấy mục có status = 'approved' ở CẢ chủ đề, bài và mục từ.
const chunk = (arr, n = 100) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const check = ({ error }) => { if (error) throw error; };

async function lessonIdsOfUnit(unitId) {
  const { data, error } = await sb.from("lessons").select("id").eq("unit_id", unitId);
  if (error) throw error;
  return data.map((l) => l.id);
}

// status: 'approved' | 'draft' — áp cho bài + mọi mục từ + mọi hoạt động của bài.
export async function setLessonsStatus(lessonIds, status) {
  for (const ids of chunk(lessonIds)) {
    check(await sb.from("lessons").update({ status }).in("id", ids));
    check(await sb.from("content_items").update({ status }).in("lesson_id", ids));
    check(await sb.from("activities").update({ status }).in("lesson_id", ids));
  }
}

export async function setUnitStatus(unitId, status) {
  check(await sb.from("units").update({ status }).eq("id", unitId));
  await setLessonsStatus(await lessonIdsOfUnit(unitId), status);
}

// Duyệt 1 bài thì chủ đề chứa nó cũng phải hiện (nếu không bé không thấy bài).
export async function setLessonStatus(lesson, status) {
  await setLessonsStatus([lesson.id], status);
  if (status === "approved") check(await sb.from("units").update({ status }).eq("id", lesson.unit_id));
}

// Xoá kèm dọn file âm thanh trong Storage (khoá ngoại chỉ xoá dòng, không xoá file).
async function removeAudioFiles(itemIds) {
  for (const ids of chunk(itemIds)) {
    const { data, error } = await sb.from("content_audio").select("file_path").in("item_id", ids);
    if (error) throw error;
    if (data?.length) await sb.storage.from("content").remove(data.map((r) => r.file_path));
  }
}

async function itemIdsOfLessons(lessonIds) {
  const out = [];
  for (const ids of chunk(lessonIds)) {
    const { data, error } = await sb.from("content_items").select("id").in("lesson_id", ids);
    if (error) throw error;
    out.push(...data.map((i) => i.id));
  }
  return out;
}

export async function deleteItem(itemId) {
  await removeAudioFiles([itemId]);
  check(await sb.from("content_items").delete().eq("id", itemId));
}

export async function deleteLesson(lessonId) {
  await removeAudioFiles(await itemIdsOfLessons([lessonId]));
  check(await sb.from("lessons").delete().eq("id", lessonId));
}

export async function deleteUnit(unitId) {
  await removeAudioFiles(await itemIdsOfLessons(await lessonIdsOfUnit(unitId)));
  check(await sb.from("units").delete().eq("id", unitId));
}
