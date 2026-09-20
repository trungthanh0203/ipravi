import { readFileSync } from "node:fs";
const R = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
// Kiểm tra CSV giáo trình bằng chính bộ kiểm tra của app + luật giáo trình (mỗi bài 5–10 mục, không trùng emoji trong 1 bài,
// đủ nghĩa de/en, khớp dữ liệu mẫu đã chạy trên Supabase). Chạy: node tests/curriculum.test.mjs
import { parseCsv, validateRows, keyOf } from "../public/js/admin/csv.js";
let bad = 0;
for (const [f, level] of [["cap1-trung-tu-vung.csv", 1], ["cap2-ga-con-cau-ngan.csv", 2]]) {
  const v = validateRows(parseCsv(R("giao-trinh/csv/" + f)), { langs: ["de", "en"] });
  console.log(`\n== ${f}: ${v.items.length} mục, ${v.errors.length} lỗi, ${v.warnings.length} cảnh báo`);
  for (const e of v.errors) { console.log("  LỖI dòng", e.row, e.msg); bad = 1; }
  for (const w of v.warnings) console.log("  cảnh báo dòng", w.row, w.msg);
  const wrongLevel = v.items.filter((i) => i.level !== level);
  if (wrongLevel.length) { console.log(`  CẤP SAI: ${wrongLevel.length} dòng không ghi level=${level} (dòng đầu: ${wrongLevel[0].row})`); bad = 1; }
  const lessons = new Map(); const units = new Map();
  for (const it of v.items) {
    const k = `${it.unit} › ${it.lesson}`;
    (lessons.get(k) ?? lessons.set(k, []).get(k)).push(it);
    units.set(it.unit, (units.get(it.unit) ?? 0) + 1);
  }
  for (const [k, items] of lessons) {
    const emojis = items.map((i) => i.emoji);
    const dupE = emojis.filter((e, i) => emojis.indexOf(e) !== i);
    const flag = (items.length < 5 || items.length > 10) ? " ⚠ số mục ngoài 5–10" : "";
    if (dupE.length) { console.log(`  TRÙNG EMOJI trong bài ${k}:`, dupE.join(" ")); bad = 1; }
    if (flag) { console.log(`  ${k}: ${items.length}${flag}`); bad = 1; }
    const noTr = items.filter((i) => !i.tr.de || !i.tr.en);
    if (noTr.length) { console.log("  thiếu nghĩa:", noTr.map((i) => i.vi).join(", ")); bad = 1; }
  }
  console.log(`  ${units.size} chủ đề, ${lessons.size} bài; bài nhỏ nhất ${Math.min(...[...lessons.values()].map((a) => a.length))}, lớn nhất ${Math.max(...[...lessons.values()].map((a) => a.length))} mục`);
  console.log("  chủ đề:", [...units].map(([u, n]) => `${u}(${n})`).join(" · "));
}
// khớp với dữ liệu mẫu đã chạy trên Supabase (không được tạo trùng chủ đề/bài/từ)
const seedSql = R("supabase/seed/001_sample_content.sql");
const cap1 = validateRows(parseCsv(R("giao-trinh/csv/cap1-trung-tu-vung.csv")), { langs: ["de", "en"] }).items;
const seedWords = [...seedSql.matchAll(/add_item[(]l[0-9], *[0-9]+, *'([^']+)', *'([^']+)', *'([^']+)', *'([^']+)'[)]/g)].map((m) => ({ vi: m[1], emoji: m[2], de: m[3], en: m[4] }));
let matched = 0;
for (const s of seedWords) {
  const hit = cap1.find((i) => keyOf(i.vi) === keyOf(s.vi));
  if (!hit) { console.log("Từ trong seed KHÔNG có trong CSV:", s.vi); bad = 1; continue; }
  matched++;
  if (hit.emoji !== s.emoji || hit.tr.de !== s.de || hit.tr.en !== s.en) console.log(`  khác seed: ${s.vi}: ${s.emoji}/${s.de}/${s.en} -> ${hit.emoji}/${hit.tr.de}/${hit.tr.en}`);
}
console.log(`\nSeed: ${matched}/${seedWords.length} từ trùng khớp tên (nhập CSV sẽ CẬP NHẬT, không tạo trùng)`);
console.log(bad ? "\nCÓ VẤN ĐỀ" : "\nTẤT CẢ ĐẠT");
process.exit(bad);
