// "Thêm nhanh" (admin): điền sẵn từ chữ Việt bằng luật + tra CSDL/từ điển. Chạy: node tests/autofill.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { makeLookup, guessType, sayOf, ageRange, defaultKinds, suggestItem, suggestUnit, suggestLesson, checkTitle, checkText, parseLines, QUICK_TYPES } from "../public/js/admin/autofill.js";
import { DICT } from "../public/js/admin/dict.js";
import { parseCsv, validateRows, keyOf, ACTIVITY_DEFAULTS } from "../public/js/admin/csv.js";
import { isEmojiGrapheme, graphemes } from "../public/js/emoji.js";

let pass = 0, fail = 0;
const ok = (c, n, x = "") => { (c ? pass++ : fail++); console.log(`${c ? "ok  " : "FAIL"} ${n}${c ? "" : "  <-- " + x}`); };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);

// ---- Luật ----
eq(["a", "b", "A a", "Ngh ngh"].map(guessType), ["letter", "letter", "letter", "letter"], "guessType: chữ cái và cặp hoa–thường → letter");
eq(["mèo", "bà"].map(guessType), ["word", "word"], "guessType: 1 tiếng → word");
eq(["xin chào", "chào buổi sáng", "con chó nhỏ"].map(guessType), ["phrase", "phrase", "phrase"], "guessType: 2–4 tiếng → phrase");
eq(["Con chào bà ạ.", "Nhà Nam có mấy người?", "hôm nay trời rất đẹp"].map(guessType), ["sentence", "sentence", "sentence"], "guessType: dấu câu cuối hoặc ≥ 5 tiếng → sentence");
eq([sayOf("b"), sayOf("B b"), sayOf("ngh"), sayOf("a"), sayOf("A a"), sayOf("ă"), sayOf("y"), sayOf("mèo")], ["bờ", "bờ", "ngờ", "", "a", "á", "i dài", ""], "sayOf: phụ âm đọc \"bờ\", ă đọc \"á\"; từ thường để trống");
eq([ageRange(1), ageRange(2), ageRange(3), ageRange(4), ageRange(9)], [[3, 4], [4, 6], [5, 7], [6, 8], [3, 4]], "ageRange: theo khung cấp");
ok(defaultKinds(1).join() === "listen_pick,match,listen_pick_text,listen_repeat" && defaultKinds(3).includes("spell_along") && defaultKinds(4).includes("fill_word"), "defaultKinds: cấp 1–2 = bộ chuẩn; cấp 3–4 thêm trò hợp cấp");
ok([1, 2, 3, 4].every((n) => defaultKinds(n).every((k) => ACTIVITY_DEFAULTS[k])), "defaultKinds: mọi trò đều có cấu hình mặc định");
ok(!QUICK_TYPES.includes("question") && QUICK_TYPES.includes("story"), "QUICK_TYPES: bỏ câu hỏi đọc hiểu");

// ---- Tra cứu ----
const existing = [
  { text_vi: "con mèo", emoji: "🐱", item_type: "word", translations: [{ lang: "de", meaning: "Katze" }, { lang: "en", meaning: "cat" }] },
  { text_vi: "Con Chó", emoji: "🐕", item_type: "word", translations: [{ lang: "de", meaning: "Hund (CSDL)" }] },
  { text_vi: "quả xoài", emoji: "", item_type: "word", translations: [] },
];
const lookup = makeLookup(existing);
{
  const a = suggestItem("con chó", { lookup });
  eq([a.emoji, a.tr.de, a.src.emoji, a.src.tr.de], ["🐕", "Hund (CSDL)", "db", "db"], "suggestItem: mục đã có trong CSDL đè từ điển (không phân biệt hoa/thường)");
  eq([a.tr.en, a.src.tr.en], ["dog", "dict"], "suggestItem: ngôn ngữ CSDL còn thiếu thì bổ sung từ từ điển");
  const m = suggestItem("quả xoài", { lookup });
  eq([m.emoji, m.src.emoji, m.tr.de, m.src.tr.de], ["🥭", "dict", "Mango", "dict"], "suggestItem: mục CSDL thiếu emoji/nghĩa thì lấy từ điển");
  eq(suggestItem("chó", { lookup }).emoji, "🐕", "suggestItem: gõ \"chó\" (bỏ từ loại) vẫn ra \"con chó\"");
  eq(suggestItem("mèo", { lookup }).tr.en, "cat", "suggestItem: bí danh bỏ từ loại cho mục CSDL");
  const d = suggestItem("con voi", { lookup });
  eq([d.emoji, d.tr.de, d.tr.en, d.src.tr.de, d.item_type, d.min_age, d.max_age], ["🐘", "Elefant", "elephant", "dict", "phrase", 3, 4], "suggestItem: từ điển + loại + tuổi theo cấp 1");
  const l = suggestItem("b", { level: 3, lookup });
  eq([l.item_type, l.say_vi, l.tr.de, l.tr.en, l.src.tr.de, l.emoji, l.min_age, l.max_age], ["letter", "bờ", "Buchstabe b", "letter b", "rule", "", 5, 7], "suggestItem: chữ cái → cách đọc + nghĩa mẫu, không bịa emoji");
  const c = suggestItem("A a", { level: 3, lookup });
  eq([c.item_type, c.tr.de, c.say_vi], ["letter", "Buchstabe A", "a"], "suggestItem: cặp chữ hoa–thường → đọc chữ thường");
  const s = suggestItem("Con chào bà ạ.", { level: 2, lookup });
  eq([s.item_type, s.emoji, s.src.emoji, s.src.emojiFrom, s.tr.de, s.src.tr.de], ["sentence", "👵", "guess", "bà", "", ""], "suggestItem: câu chứa từ đã biết → GỢI Ý emoji (ghi nguồn), nghĩa để trống");
  const u = suggestItem("cái quạt trần", { lookup });
  eq([u.emoji, u.tr.de, u.tr.en], ["", "", ""], "suggestItem: từ lạ → để trống, không bịa");
  const only = suggestItem("con chó", { lookup, langs: ["de", "en", "fr"] });
  eq(only.tr.fr, "", "suggestItem: ngôn ngữ chưa có nguồn → trống");
  eq(suggestItem("Con chó", { lookup }).text_vi, "Con chó", "suggestItem: giữ nguyên chữ admin gõ (chỉ chuẩn hoá khoảng trắng)");
  eq(suggestItem("  con   voi  ", { lookup }).text_vi, "con voi", "suggestItem: chuẩn hoá khoảng trắng");
  eq(suggestItem("xin chào", { lookup, level: 1 }).emoji, "👋", "suggestItem: cụm từ trong từ điển");
}

// ---- Chủ đề / bài ----
{
  eq([suggestUnit("Con vật", { lookup }).emoji, suggestUnit("Xe cộ", { lookup }).emoji, suggestUnit("Xem phim", { lookup }).emoji, suggestUnit("Điều bất kỳ", { lookup }).emoji], ["🐾", "🚗", "📚", "📚"], "suggestUnit: emoji theo từ khoá NGUYÊN TỪ (\"xe\" không khớp \"xem\"), mặc định 📚");
  eq(suggestUnit("Con vật", { level: 2, lookup }).level, 2, "suggestUnit: cấp theo lựa chọn");
  eq(suggestUnit("Ngôi nhà", { lookup }).title_tr, { de: "", en: "" }, "suggestUnit: tên dịch trống khi chưa biết");
  const ls = suggestLesson("Bài mới", { level: 3, lookup });
  eq([ls.title_vi, ls.kinds.length > 4, ls.title_tr], ["Bài mới", true, { de: "", en: "" }], "suggestLesson: bộ hoạt động theo cấp");
  eq(suggestLesson("Con vật quanh nhà", { level: 1, lookup: makeLookup([]) }).kinds, ["listen_pick", "match", "listen_pick_text", "listen_repeat"], "suggestLesson: cấp 1 = bộ chuẩn");
}

// ---- Kiểm tra dữ liệu + nhiều dòng ----
{
  eq([checkTitle(""), checkTitle("x".repeat(61)), checkTitle("Con vật")], ["Tên không được để trống", "Tên dài quá 60 ký tự", null], "checkTitle");
  eq([checkText("  "), checkText("x".repeat(201)), checkText("mèo")], ["Chữ tiếng Việt không được để trống", "Dài quá 200 ký tự", null], "checkText");
  const r = parseLines("con mèo\n\n Con  Mèo \ncon chó\r\ncon gà\ncon chó", new Set(["con gà"]));
  eq(r, { lines: ["con mèo", "con chó"], duplicates: ["Con Mèo", "con gà", "con chó"], }, "parseLines: bỏ dòng trống, gộp trùng (kể cả trùng với bài), giữ thứ tự");
}

// ---- Từ điển ----
{
  const keys = Object.keys(DICT);
  const bad = keys.filter((k) => k !== k.normalize("NFC") || k !== k.toLowerCase() || k !== k.trim() || /\s{2}/.test(k));
  ok(bad.length === 0, "dict: khoá chuẩn hoá NFC, chữ thường, không thừa khoảng trắng", bad.join());
  ok(new Set(keys.map(keyOf)).size === keys.length, "dict: không có khoá trùng");
  const bad2 = keys.filter((k) => { const [e, de, en] = DICT[k]; return !e || !de?.trim() || !en?.trim() || !graphemes(e).every(() => true) || !isEmojiGrapheme(graphemes(e)[0]); });
  ok(bad2.length === 0, `dict: ${keys.length} mục đều có emoji + nghĩa Đức + nghĩa Anh`, bad2.join());
}

// ---- Trên giáo trình thật: đoán loại mục + tra ngược ----
{
  const dir = new URL("../giao-trinh/csv/", import.meta.url);
  const rows = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".csv"))) {
    const v = validateRows(parseCsv(readFileSync(new URL(f, dir), "utf8")), { langs: ["de", "en"] });
    for (const r of v.items) if (r.type !== "question") rows.push(r);
  }
  const letters = rows.filter((r) => r.type === "letter");
  ok(letters.every((r) => guessType(r.vi) === "letter") || letters.filter((r) => guessType(r.vi) === "letter").length / letters.length >= 0.95, "giáo trình: chữ cái đoán đúng loại letter (≥ 95%)");
  const sentences = rows.filter((r) => r.type === "sentence");
  ok(sentences.every((r) => guessType(r.vi) === "sentence"), "giáo trình: mọi câu đều đoán đúng loại sentence");
  const withSay = letters.filter((r) => r.say && r.say !== r.vi);
  ok(withSay.every((r) => sayOf(r.vi) === r.say), `giáo trình: cách đọc chữ cái khớp cột say của CSV (${withSay.length} chữ)`, withSay.filter((r) => sayOf(r.vi) !== r.say).map((r) => `${r.vi}: ${sayOf(r.vi)} ≠ ${r.say}`).join("; "));
  // Tra ngược: nạp mọi mục của giáo trình vào "CSDL" thì mỗi từ đều tra lại đúng emoji + nghĩa của nó
  const db = rows.map((r) => ({ text_vi: r.vi, emoji: r.emoji, item_type: r.type, translations: Object.entries(r.tr).map(([lang, meaning]) => ({ lang, meaning })) }));
  const lk = makeLookup(db);
  const miss = rows.filter((r) => { const a = suggestItem(r.vi, { lookup: lk }); return r.tr.de && (a.tr.de === "" || (a.emoji !== r.emoji && r.emoji && !db.some((x) => keyOf(x.text_vi) === keyOf(r.vi) && x.emoji === a.emoji))); });
  ok(miss.length === 0, "giáo trình: tra lại chính từ đã có luôn ra nghĩa (và emoji của một mục cùng chữ)", miss.slice(0, 3).map((r) => r.vi).join());
  // Từ điển khởi đầu không mâu thuẫn với giáo trình: cùng chữ thì cùng emoji
  const conflicts = rows.filter((r) => DICT[r.vi.toLowerCase()] && r.emoji && DICT[r.vi.toLowerCase()][0] !== r.emoji);
  // Hai từ khác emoji có chủ ý: trong bài về thanh điệu giáo trình dùng ký hiệu thanh làm hình (lá ↗️, vẽ 〰️)
  const bad3 = [...new Set(conflicts.map((r) => r.vi.toLowerCase()))].filter((w) => !["lá", "vẽ"].includes(w));
  ok(bad3.length === 0, "từ điển khởi đầu thống nhất emoji với giáo trình (trừ ký hiệu thanh điệu)", bad3.join());
}

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
