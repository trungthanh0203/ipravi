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

// Đổi chỗ chủ đề với chủ đề liền kề CÙNG CẤP (dir = -1 lên, +1 xuống). Thứ tự = sort_order; gán lại các giá trị sort_order hiện có của nhóm
// (làm cho tăng dần thật sự nếu đang trùng nhau) chứ không đụng chủ đề ở cấp khác.
export async function moveUnit(units, unit, dir, levelOf) {
  const group = units.filter((u) => !u.hidden && levelOf(u) === levelOf(unit)).sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
  const i = group.findIndex((u) => u.id === unit.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= group.length) return;
  const orders = [];
  group.forEach((u, k) => orders.push(k === 0 ? u.sort_order : Math.max(u.sort_order, orders[k - 1] + 1)));
  [group[i], group[j]] = [group[j], group[i]];
  for (let k = 0; k < group.length; k++) {
    if (group[k].sort_order !== orders[k]) check(await sb.from("units").update({ sort_order: orders[k] }).eq("id", group[k].id));
  }
}

export async function setUnitLevel(unitId, level) {
  check(await sb.from("units").update({ level: Number(level) }).eq("id", unitId));
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
