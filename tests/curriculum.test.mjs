import { readFileSync } from "node:fs";
const R = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
// Kiểm tra CSV giáo trình bằng chính bộ kiểm tra của app + luật giáo trình (mỗi bài 5–10 mục, không trùng emoji trong 1 bài,
// đủ nghĩa de/en, khớp dữ liệu mẫu đã chạy trên Supabase). Chạy: node tests/curriculum.test.mjs
import { parseCsv, validateRows, keyOf } from "../public/js/admin/csv.js";
import { splitSyllable, words, toneOf, TONES } from "../public/js/viet.js";
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
// ---- Cấp 3 (học vần): luật riêng ----
{
  const f = "cap3-ga-choai-hoc-van.csv";
  const v = validateRows(parseCsv(R("giao-trinh/csv/" + f)), { langs: ["de", "en"] });
  console.log(`
== ${f}: ${v.items.length} mục, ${v.errors.length} lỗi, ${v.warnings.length} cảnh báo`);
  for (const e of v.errors) { console.log("  LỖI dòng", e.row, e.msg); bad = 1; }
  for (const w of v.warnings) console.log("  cảnh báo dòng", w.row, w.msg);
  const fail = (m) => { console.log("  CẤP 3:", m); bad = 1; };
  const lessons = new Map();
  for (const it of v.items) {
    if (it.level !== 3) fail(`dòng ${it.row} không ghi level=3`);
    const k = `${it.unit} › ${it.lesson}`;
    (lessons.get(k) ?? lessons.set(k, []).get(k)).push(it);
  }
  const ALL29 = [..."aăâbcdđeêghiklmnoôơpqrstuưvxy"];
  const letterItems = v.items.filter((i) => i.type === "letter");
  const seen = letterItems.map((i) => i.vi).sort();
  if (JSON.stringify(seen) !== JSON.stringify([...ALL29].sort())) fail("29 chữ cái phải có mặt đúng 1 lần: thiếu/thừa " + JSON.stringify(ALL29.filter((c) => !seen.includes(c)).concat(seen.filter((c, i) => seen.indexOf(c) !== i))));
  for (const i of letterItems) if (!i.say) fail(`chữ cái "${i.vi}" chưa có cột say (chữ đọc)`);
  for (const [k, items] of lessons) {
    const isLetters = items.every((i) => i.type === "letter");
    const min = isLetters ? 4 : 5;
    if (items.length < min || items.length > 10) fail(`${k}: ${items.length} mục (cần ${min}–10)`);
    const emojis = items.map((i) => i.emoji);
    const dup = emojis.filter((e, i) => emojis.indexOf(e) !== i);
    if (dup.length) fail(`${k}: trùng emoji ${dup.join(" ")}`);
    if (!items[0].kinds.length) fail(`${k}: dòng đầu chưa ghi activities`);
    if (items.slice(1).some((i) => i.kinds.length)) fail(`${k}: activities chỉ ghi ở dòng đầu của bài`);
    // mỗi hoạt động phải chơi được với dữ liệu của bài (nếu không sẽ tự bỏ qua — vô nghĩa)
    const single = items.filter((i) => splitSyllable(i.vi));
    const withInit = single.filter((i) => splitSyllable(i.vi).initial);
    const need = { listen_pick_tone: single.length, build_syllable: withInit.length, fill_letter: withInit.length,
      read_pick: items.filter((i) => i.emoji).length, order_words: items.filter((i) => words(i.vi).length >= 3).length };
    for (const a of items[0].kinds) if (a in need && need[a] < 3) fail(`${k}: hoạt động ${a} cần ≥3 mục phù hợp, bài chỉ có ${need[a]}`);
    if (items[0].kinds.length < 2) fail(`${k}: chỉ ${items[0].kinds.length} hoạt động`);
    const noTr = items.filter((i) => !i.tr.de || !i.tr.en);
    if (noTr.length) fail(`${k}: thiếu nghĩa: ${noTr.map((i) => i.vi).join(", ")}`);
  }
  // thanh điệu: ký hiệu emoji của từng mục phải đúng thanh của chữ
  for (const i of v.items.filter((x) => x.unit === "Sáu thanh điệu")) {
    const t = TONES.find((x) => x.key === toneOf(i.vi));
    if (i.emoji !== t.symbol) fail(`"${i.vi}" là thanh ${t.name} nhưng emoji là ${i.emoji} (cần ${t.symbol})`);
  }
  const perUnit = new Map();
  for (const [k, items] of lessons) perUnit.set(k.split(" › ")[0], (perUnit.get(k.split(" › ")[0]) ?? 0) + 1);
  console.log(`  ${perUnit.size} chủ đề, ${lessons.size} bài:`, [...perUnit].map(([u, n]) => `${u}(${n})`).join(" · "));
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
