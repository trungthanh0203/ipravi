import { sb } from "../supabase.js";
import { keyOf, activitiesFor, ITEM_TYPES } from "./csv.js";
import { checkTitle, checkText } from "./autofill.js";

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

// Xoá file ảnh riêng (Storage) của các mục / chủ đề bị xoá.
async function removeImageFiles({ itemIds = [], unitIds = [] }) {
  for (const ids of chunk(itemIds)) {
    const { data, error } = await sb.from("content_items").select("image_path").in("id", ids);
    if (error) throw error;
    const paths = (data ?? []).map((r) => r.image_path).filter(Boolean);
    if (paths.length) await sb.storage.from("content").remove(paths);
  }
  if (unitIds.length) {
    const { data, error } = await sb.from("units").select("image_path").in("id", unitIds);
    if (error) throw error;
    const paths = (data ?? []).map((r) => r.image_path).filter(Boolean);
    if (paths.length) await sb.storage.from("content").remove(paths);
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
  await removeImageFiles({ itemIds: [itemId] });
  check(await sb.from("content_items").delete().eq("id", itemId));
}

export async function deleteLesson(lessonId) {
  const ids = await itemIdsOfLessons([lessonId]);
  await removeAudioFiles(ids);
  await removeImageFiles({ itemIds: ids });
  check(await sb.from("lessons").delete().eq("id", lessonId));
}

export async function deleteUnit(unitId) {
  const ids = await itemIdsOfLessons(await lessonIdsOfUnit(unitId));
  await removeAudioFiles(ids);
  await removeImageFiles({ itemIds: ids, unitIds: [unitId] });
  check(await sb.from("units").delete().eq("id", unitId));
}

// ---- Thêm / sửa (chỉ phần "Thêm nhanh" + sửa tên; sửa chi tiết từng mục nằm ở content.js) ----
const clean = (s) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
const only = (obj) => Object.fromEntries(Object.entries(obj ?? {}).map(([k, v]) => [k, clean(v)]).filter(([, v]) => v));
const need = (msg) => { if (msg) throw new Error(msg); };
const nextOrder = (rows) => Math.max(0, ...rows.map((r) => r.sort_order ?? 0)) + 1;

// Tên chủ đề không trùng chủ đề khác (không phân biệt hoa/thường); exceptId = chủ đề đang sửa.
function uniqueUnit(units, title, exceptId) {
  if (units.some((u) => u.id !== exceptId && !u.hidden && keyOf(u.title_vi) === keyOf(title))) throw new Error(`Đã có chủ đề "${title}".`);
}

// units: danh sách chủ đề hiện có (để kiểm trùng + tính thứ tự). Trả về dòng vừa tạo. Luôn là NHÁP (bé chỉ thấy sau khi duyệt).
export async function createUnit({ title_vi, emoji, level, title_tr }, units) {
  const title = clean(title_vi);
  need(checkTitle(title, "Tên chủ đề"));
  uniqueUnit(units, title);
  const tr = only(title_tr);
  const row = { title_vi: title, emoji: clean(emoji) || "📚", level: Number(level) || 1, sort_order: nextOrder(units), status: "draft", ...(Object.keys(tr).length ? { title_tr: tr } : {}) };
  need(row.emoji.length > 16 ? "Emoji quá dài" : null);
  const { data, error } = await sb.from("units").insert(row).select().single();
  if (error) throw error;
  return data;
}

// Gộp tên dịch mới vào title_tr hiện có: ngôn ngữ nào có trong `next` thì đặt/xoá (rỗng = xoá), ngôn ngữ không nhắc tới giữ nguyên. Trả về đối tượng mới nếu có đổi, không thì null.
function mergeTitleTr(old, next) {
  if (next == null) return null;
  const out = { ...(old ?? {}) };
  for (const [lang, v] of Object.entries(next)) {
    const t = clean(v);
    if (t.length > 60) throw new Error(`Tên dịch (${lang}) dài quá 60 ký tự`);
    if (t) out[lang] = t; else delete out[lang];
  }
  return JSON.stringify(out) === JSON.stringify(old ?? {}) ? null : out;
}

// Nội dung diễn giải (units.description / lessons.description, migration 020+021): trống = xoá.
function descriptionPatch(patch, row, description) {
  if (description == null) return;
  const desc = clean(description);
  need(desc.length > 500 ? "Nội dung diễn giải dài quá 500 ký tự" : null);
  if (desc !== (row.description ?? "")) patch.description = desc || null;
}

export async function updateUnit(unit, { title_vi, emoji, title_tr, description }, units) {
  const patch = {};
  if (title_vi != null && clean(title_vi) !== unit.title_vi) { need(checkTitle(title_vi, "Tên chủ đề")); uniqueUnit(units, clean(title_vi), unit.id); patch.title_vi = clean(title_vi); }
  if (emoji != null && clean(emoji) !== (unit.emoji ?? "")) { need(clean(emoji).length > 16 ? "Emoji quá dài" : null); patch.emoji = clean(emoji) || "📚"; }
  const tr = mergeTitleTr(unit.title_tr, title_tr);
  if (tr) patch.title_tr = tr;
  descriptionPatch(patch, unit, description);
  if (Object.keys(patch).length) check(await sb.from("units").update(patch).eq("id", unit.id));
  return patch;
}

// Bài mới: NHÁP, kèm bộ hoạt động (kinds) — giống bài tạo bằng nhập CSV.
export async function createLesson(unitId, { title_vi, kinds, title_tr }, siblings) {
  const title = clean(title_vi);
  need(checkTitle(title, "Tên bài"));
  if (siblings.some((l) => keyOf(l.title_vi) === keyOf(title))) throw new Error(`Chủ đề này đã có bài "${title}".`);
  const tr = only(title_tr);
  const { data, error } = await sb.from("lessons").insert({ unit_id: unitId, title_vi: title, sort_order: nextOrder(siblings), status: "draft", ...(Object.keys(tr).length ? { title_tr: tr } : {}) }).select().single();
  if (error) throw error;
  const acts = activitiesFor(kinds).map(([kind, config], i) => ({ lesson_id: data.id, kind, config, sort_order: i + 1, status: "draft" }));
  if (acts.length) check(await sb.from("activities").insert(acts));
  return data;
}

export async function updateLesson(lesson, { title_vi, title_tr, description }, siblings) {
  const patch = {};
  if (title_vi != null && clean(title_vi) !== lesson.title_vi) {
    const title = clean(title_vi);
    need(checkTitle(title, "Tên bài"));
    if (siblings.some((l) => l.id !== lesson.id && keyOf(l.title_vi) === keyOf(title))) throw new Error(`Chủ đề này đã có bài "${title}".`);
    patch.title_vi = title;
  }
  const tr = mergeTitleTr(lesson.title_tr, title_tr);
  if (tr) patch.title_tr = tr;
  descriptionPatch(patch, lesson, description);
  if (Object.keys(patch).length) check(await sb.from("lessons").update(patch).eq("id", lesson.id));
  return patch;
}

// Thêm nhiều mục vào 1 bài. rows: [{ text_vi, item_type, say_vi, emoji, pic, min_age, max_age, tr:{lang:nghĩa} }].
// Mục mới lấy trạng thái của bài (bài đã duyệt → mục mới hiện ngay; bài nháp → nháp). Trả về các mục đã tạo kèm translations để sinh âm thanh.
export async function createItems(lesson, rows) {
  if (!rows.length) return [];
  const { data: last, error: e0 } = await sb.from("content_items").select("text_vi, sort_order").eq("lesson_id", lesson.id).order("sort_order", { ascending: false }).range(0, 999);
  if (e0) throw e0;
  const have = new Set((last ?? []).map((r) => keyOf(r.text_vi)));
  let order = Math.max(0, ...(last ?? []).map((r) => r.sort_order ?? 0));
  const payload = rows.map((r) => {
    const text = clean(r.text_vi);
    need(checkText(text));
    if (have.has(keyOf(text))) throw new Error(`Bài đã có "${text}".`);
    if (!ITEM_TYPES.includes(r.item_type) || r.item_type === "question") throw new Error(`Loại "${r.item_type}" không hợp lệ.`);
    need(clean(r.emoji).length > 16 ? `Emoji của "${text}" quá dài` : null);
    have.add(keyOf(text));
    return { lesson_id: lesson.id, item_type: r.item_type, text_vi: text, say_vi: clean(r.say_vi) || null, emoji: clean(r.emoji) || null, pic: r.pic === "decor" ? "decor" : null,
      min_age: r.min_age ?? null, max_age: r.max_age ?? null, sort_order: ++order, status: lesson.status === "approved" ? "approved" : "draft" };
  });
  const made = [];
  for (const part of chunk(payload)) {
    const { data, error } = await sb.from("content_items").insert(part).select("id, text_vi");
    if (error) throw error;
    made.push(...data);
  }
  const idOf = new Map(made.map((m) => [keyOf(m.text_vi), m.id]));
  const trRows = rows.flatMap((r) => Object.entries(only(r.tr)).map(([lang, meaning]) => ({ item_id: idOf.get(keyOf(r.text_vi)), lang, meaning })));
  for (const part of chunk(trRows)) check(await sb.from("translations").insert(part));
  return made.map((m) => ({ ...m, translations: trRows.filter((t) => t.item_id === m.id).map(({ lang, meaning }) => ({ lang, meaning })), content_audio: [] }));
}

// Đổi chỗ với phần tử liền kề (dir = -1 lên, +1 xuống) trong cùng nhóm (các bài của 1 chủ đề / các mục của 1 bài). Thứ tự = sort_order; gán lại
// giá trị tăng dần thật sự nếu đang trùng nhau. Thứ tự mục QUAN TRỌNG (xếp câu thành chuyện dùng đúng thứ tự này).
export async function moveIn(table, group, item, dir) {
  const list = [...group].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
  const i = list.findIndex((x) => x.id === item.id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const orders = [];
  list.forEach((x, k) => orders.push(k === 0 ? x.sort_order : Math.max(x.sort_order, orders[k - 1] + 1)));
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) {
    if (list[k].sort_order !== orders[k]) check(await sb.from(table).update({ sort_order: orders[k] }).eq("id", list[k].id));
  }
}
