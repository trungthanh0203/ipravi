// Đọc + kiểm tra CSV nội dung học. Hàm thuần (không đụng DOM/mạng) để kiểm thử được.
// Cột: unit, lesson, vi (bắt buộc) · unit_emoji, level (cấp 1–4), emoji, type, min_age, max_age · <mã ngôn ngữ> (de, en...) = nghĩa.
// Ô trống KHÔNG xoá dữ liệu đã có khi nhập lại (chỉ ô có giá trị mới được cập nhật).

export const ITEM_TYPES = ["word", "phrase", "sentence", "story", "song"];

// Tự nhận dấu phân cách: dấu phẩy, chấm phẩy (Excel tiếng Đức/Việt hay xuất dạng này) hoặc Tab.
function detectDelimiter(line) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuote = false;
  for (const c of line) {
    if (c === '"') inQuote = !inQuote;
    else if (!inQuote && c in counts) counts[c]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ",";
}

export function parseCsv(text) {
  text = String(text ?? "").replace(/^﻿/, "");
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? "");
  const records = [];
  let row = [];
  let field = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuote = false;
      } else field += c;
    } else if (c === '"' && field === "") inQuote = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); records.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); records.push(row); }
  const [headers = [], ...rows] = records;
  return { headers: headers.map((h) => h.trim()), rows, delimiter };
}

const clean = (s) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
export const keyOf = (s) => clean(s).toLowerCase();

// langs: mã ngôn ngữ nghĩa được hỗ trợ (vd ["de","en"]).
// Trả về { items, errors, warnings }. Còn lỗi (errors) thì không được nhập.
export function validateRows({ headers, rows }, { langs = [] } = {}) {
  const errors = [];
  const warnings = [];
  const items = [];
  const H = headers.map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const col = (name) => H.indexOf(name);

  for (const req of ["unit", "lesson", "vi"]) {
    if (col(req) < 0) errors.push({ row: 1, msg: `Thiếu cột bắt buộc "${req}"` });
  }
  if (errors.length) return { items, errors, warnings };

  const known = new Set(["unit", "unit_emoji", "level", "lesson", "vi", "emoji", "type", "min_age", "max_age", ...langs]);
  H.forEach((h, i) => { if (h && !known.has(h)) warnings.push({ row: 1, msg: `Cột "${headers[i]}" không được dùng (bỏ qua)` }); });
  for (const l of langs) if (col(l) < 0) warnings.push({ row: 1, msg: `Không có cột nghĩa "${l}" — các mục sẽ thiếu nghĩa ${l}` });

  const seen = new Map();
  rows.forEach((r, idx) => {
    const n = idx + 2; // dòng trong file (dòng 1 là tiêu đề)
    if (r.every((c) => !String(c ?? "").trim())) return;
    const get = (name) => clean(r[col(name)]);

    const unit = get("unit"), lesson = get("lesson"), vi = get("vi");
    const emoji = get("emoji"), unitEmoji = get("unit_emoji");
    const type = get("type").toLowerCase() || "word";
    const problems = [];
    if (!unit) problems.push("thiếu chủ đề (unit)");
    if (!lesson) problems.push("thiếu bài (lesson)");
    if (!vi) problems.push("thiếu từ tiếng Việt (vi)");
    if (unit.length > 60) problems.push("tên chủ đề dài quá 60 ký tự");
    if (lesson.length > 60) problems.push("tên bài dài quá 60 ký tự");
    if (vi.length > 200) problems.push("từ/câu tiếng Việt dài quá 200 ký tự");
    if (emoji.length > 16) problems.push("emoji quá dài");
    if (unitEmoji.length > 16) problems.push("unit_emoji quá dài");
    if (!ITEM_TYPES.includes(type)) problems.push(`type "${type}" không hợp lệ (dùng: ${ITEM_TYPES.join(", ")})`);

    const age = (name) => {
      const v = get(name);
      if (v === "") return null;
      const num = Number(v);
      if (!Number.isInteger(num) || num < 0 || num > 12) { problems.push(`${name} phải là số nguyên 0–12`); return null; }
      return num;
    };
    const minAge = age("min_age"), maxAge = age("max_age");
    let level = null;
    if (get("level") !== "") {
      level = Number(get("level"));
      if (!Number.isInteger(level) || level < 1 || level > 4) { problems.push("level (cấp) phải là số nguyên 1–4"); level = null; }
    }
    if (minAge != null && maxAge != null && minAge > maxAge) problems.push("min_age lớn hơn max_age");

    if (problems.length) {
      for (const p of problems) errors.push({ row: n, msg: p });
      return;
    }

    const dupKey = `${keyOf(unit)}|${keyOf(lesson)}|${keyOf(vi)}`;
    if (seen.has(dupKey)) return errors.push({ row: n, msg: `Trùng với dòng ${seen.get(dupKey)} (cùng chủ đề, bài, từ "${vi}")` });
    seen.set(dupKey, n);

    if (!emoji) warnings.push({ row: n, msg: `"${vi}": chưa có emoji (sẽ hiện dấu ❓ cho trẻ)` });
    const tr = {};
    for (const l of langs) {
      if (col(l) < 0) continue;
      const v = get(l);
      if (v) tr[l] = v;
      else warnings.push({ row: n, msg: `"${vi}": thiếu nghĩa "${l}"` });
    }
    items.push({ row: n, unit, unitEmoji, level, lesson, vi, emoji, type, minAge, maxAge, tr });
  });

  if (items.length === 0 && errors.length === 0) errors.push({ row: 1, msg: "File không có dòng dữ liệu nào" });
  return { items, errors, warnings };
}

// So 1 dòng CSV với mục đã có trong CSDL (ex = {emoji, item_type, min_age, max_age, tr:{lang:meaning}}).
export function classify(item, ex) {
  if (!ex) return { status: "new", changed: [] };
  const changed = [];
  if (item.emoji && item.emoji !== (ex.emoji ?? "")) changed.push("emoji");
  if (item.type !== (ex.item_type ?? "word")) changed.push("type");
  if (item.minAge != null && item.minAge !== ex.min_age) changed.push("min_age");
  if (item.maxAge != null && item.maxAge !== ex.max_age) changed.push("max_age");
  for (const [l, m] of Object.entries(item.tr)) if (m !== (ex.tr?.[l] ?? "")) changed.push(`tr:${l}`);
  return { status: changed.length ? "update" : "same", changed };
}

// File mẫu tải về cho admin.
export function buildTemplate(langs) {
  const head = ["unit", "unit_emoji", "level", "lesson", "vi", "emoji", "type", "min_age", "max_age", ...langs];
  const ex = {
    de: ["Hund", "Katze", "rot"], en: ["dog", "cat", "red"],
  };
  const sample = [
    ["Con vật", "🐾", "1", "Con vật quanh nhà", "con chó", "🐶", "word", "3", "8"],
    ["Con vật", "🐾", "1", "Con vật quanh nhà", "con mèo", "🐱", "word", "3", "8"],
    ["Màu sắc", "🎨", "1", "Các màu cơ bản", "màu đỏ", "🔴", "word", "3", "8"],
  ];
  const q = (v) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [head, ...sample.map((r, i) => [...r, ...langs.map((l) => ex[l]?.[i] ?? "")])];
  return "﻿" + lines.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
}

// Lập kế hoạch nhập: so từng dòng CSV với dữ liệu đã có.
// ex = { units:[{id,title_vi,sort_order}], lessons:[{id,unit_id,title_vi,sort_order}],
//        items:[{id,lesson_id,text_vi,emoji,item_type,min_age,max_age,sort_order,tr:{lang:meaning}}] }
export function buildPlan(items, ex) {
  const unitByKey = new Map(ex.units.map((u) => [keyOf(u.title_vi), u]));
  const lessonByKey = new Map(ex.lessons.map((l) => [`${l.unit_id}|${keyOf(l.title_vi)}`, l]));
  const itemByKey = new Map(ex.items.map((i) => [`${i.lesson_id}|${keyOf(i.text_vi)}`, i]));
  const newUnits = [];
  const levelChanges = []; // chủ đề ĐÃ CÓ mà CSV ghi cấp khác → cập nhật cấp
  const seenLevel = new Set();
  const newLessons = [];
  const seenU = new Set();
  const seenL = new Set();
  const counts = { new: 0, update: 0, same: 0 };

  const rows = items.map((it) => {
    const u = unitByKey.get(keyOf(it.unit));
    if (!u && !seenU.has(keyOf(it.unit))) {
      seenU.add(keyOf(it.unit));
      newUnits.push({ title: it.unit, emoji: it.unitEmoji || "📚", ...(it.level ? { level: it.level } : {}) });
    } else if (!u) {
      const nu = newUnits.find((x) => keyOf(x.title) === keyOf(it.unit));
      if (nu && !nu.level && it.level) nu.level = it.level; // dòng đầu chưa ghi cấp thì lấy cấp của dòng sau
    } else if (it.level && it.level !== (u.level ?? 1) && !seenLevel.has(u.id)) {
      seenLevel.add(u.id);
      levelChanges.push({ id: u.id, title: u.title_vi, level: it.level });
    }
    const l = u ? lessonByKey.get(`${u.id}|${keyOf(it.lesson)}`) : undefined;
    const lk = `${keyOf(it.unit)}|${keyOf(it.lesson)}`;
    if (!l && !seenL.has(lk)) {
      seenL.add(lk);
      newLessons.push({ unit: it.unit, title: it.lesson });
    }
    const existing = l ? itemByKey.get(`${l.id}|${keyOf(it.vi)}`) : undefined;
    const c = classify(it, existing);
    counts[c.status]++;
    return { item: it, existing, ...c };
  });
  return { rows, newUnits, newLessons, levelChanges, counts };
}
