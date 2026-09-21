import { keyOf, ITEM_TYPES, STANDARD_ACTIVITIES } from "./csv.js";
import { words, caseParts } from "../viet.js";
import { INITIAL_SOUND, VOWELS } from "../sounds.js";
import { LEVELS } from "../levels.js";
import { DICT } from "./dict.js";

// "Thêm nhanh": admin chỉ gõ chữ Việt, phần còn lại được điền sẵn bằng LUẬT (không dùng AI/dịch máy) rồi admin xem lại và lưu.
// Nguồn điền, ưu tiên từ trên xuống: ① mục ĐÃ CÓ trong CSDL cùng chữ (copy emoji + nghĩa + loại) ② từ điển khởi đầu (dict.js)
// ③ luật (loại mục theo độ dài, cách đọc chữ cái, nghĩa mẫu cho chữ cái, tuổi theo cấp) ④ gợi ý emoji từ từ đã biết nằm trong câu.
// Không tìm ra thì để TRỐNG (nghĩa/emoji), tuyệt đối không bịa. Hàm thuần — test: tests/autofill.test.mjs.

const clean = (s) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
const CLASSIFIERS = new Set(["con", "quả", "trái", "cái", "chiếc"]);
// Loại mục admin được chọn khi thêm nhanh. Câu hỏi đọc hiểu (question) cần đáp án nên chỉ nhập bằng CSV.
export const QUICK_TYPES = ITEM_TYPES.filter((t) => t !== "question");

// ---- Tra cứu chữ Việt → { emoji, tr:{lang:nghĩa}, type, source } ----
// existing: các mục trong CSDL [{ text_vi, emoji, item_type, translations:[{lang, meaning}] }]. Mục CSDL đè lên từ điển.
export function makeLookup(existing = [], dict = DICT) {
  const map = new Map();
  // Gộp theo từng trường: nguồn đến sau (CSDL) thắng khi có giá trị, còn thiếu thì giữ giá trị của nguồn trước (từ điển). Mỗi trường nhớ nguồn của nó.
  const put = (text, { emoji = "", tr = {}, type = null, source }) => {
    const key = keyOf(text);
    const prev = map.get(key) ?? { emoji: "", emojiSrc: "", tr: {}, trSrc: {}, type: null, typeSrc: "" };
    const next = { ...prev, tr: { ...prev.tr }, trSrc: { ...prev.trSrc } };
    if (emoji) { next.emoji = emoji; next.emojiSrc = source; }
    for (const [lang, m] of Object.entries(tr)) if (m) { next.tr[lang] = m; next.trSrc[lang] = source; }
    if (type) { next.type = type; next.typeSrc = source; }
    map.set(key, next);
  };
  for (const [vi, [emoji, de, en]] of Object.entries(dict)) put(vi, { emoji, tr: { de, en }, source: "dict" });
  for (const it of existing) {
    put(it.text_vi, { emoji: it.emoji ?? "", tr: Object.fromEntries((it.translations ?? []).map((t) => [t.lang, t.meaning])), type: it.item_type ?? null, source: "db" });
  }
  // Bí danh bỏ từ loại đầu: gõ "chó" cũng ra "con chó" (chỉ khi không trùng khoá thật)
  for (const [key, info] of [...map]) {
    const w = key.split(" ");
    if (w.length > 1 && CLASSIFIERS.has(w[0])) { const alias = w.slice(1).join(" "); if (!map.has(alias)) map.set(alias, info); }
  }
  return map;
}

// ---- Luật ----
// Loại mục theo hình thức: cặp chữ hoa/thường hoặc 1 chữ cái → letter; câu (có dấu câu cuối hoặc ≥ 5 tiếng) → sentence; 2–4 tiếng → phrase; 1 tiếng → word.
// "syllable", "story", "song" không đoán được từ chữ — admin chọn tay. (Từ và cụm từ cùng "họ" nên đoán sai word/phrase không ảnh hưởng trò chơi.)
export function guessType(text) {
  const t = clean(text);
  if (caseParts(t)) return "letter";
  const w = words(t);
  if (w.length === 1) return [...t].length === 1 || INITIAL_SOUND[t.toLowerCase()] ? "letter" : "word"; // ch, ngh, ph… là âm ghép, cũng là chữ cái
  return /[.?!]$/.test(t) || w.length >= 5 ? "sentence" : "phrase";
}

// Chữ để ĐỌC thành tiếng khi khác chữ hiển thị: phụ âm "b" đọc "bờ", "ă" đọc "á". Mục khác để trống (đọc đúng chữ).
export function sayOf(text) {
  const t = clean(text);
  if (guessType(t) !== "letter") return "";
  const cp = caseParts(t);
  const k = (cp ? cp.lower : t).toLowerCase();
  if (INITIAL_SOUND[k]) return INITIAL_SOUND[k];
  const v = VOWELS.find((x) => x[0] === k); // ă → á, â → ớ, y → i dài; nguyên âm khác đọc đúng chữ (cặp hoa–thường thì ghi rõ chữ thường)
  return v ? (v[1] ?? (cp ? k : "")) : "";
}

// Độ tuổi gợi ý của cấp (khung LEVELS: "3–4 tuổi" → [3, 4]).
export function ageRange(level) {
  const L = LEVELS.find((x) => x.n === Number(level)) ?? LEVELS[0];
  const [a, b] = L.age.match(/\d+/g).map(Number);
  return [a, b];
}

// Bộ hoạt động của bài mới theo cấp. Trò không hợp nội dung tự bỏ qua khi chơi nên thừa vài trò cũng không sao.
export function defaultKinds(level) {
  const n = Number(level);
  if (n === 3) return [...STANDARD_ACTIVITIES, "spell_along", "build_syllable", "trace"];
  if (n === 4) return [...STANDARD_ACTIVITIES, "fill_word", "write_check", "order_words"];
  return [...STANDARD_ACTIVITIES];
}

// Nghĩa mẫu cho chữ cái ("b" → Buchstabe b / letter b). Ngôn ngữ khác de/en thì để trống.
const LETTER_TR = { de: (x) => `Buchstabe ${x}`, en: (x) => `letter ${x}` };

// Tiếng/cụm đã biết (có emoji) nằm trọn trong câu → gợi ý emoji (chọn cụm DÀI nhất). Trả { key, emoji } hoặc null.
function containedEmoji(text, lookup) {
  const w = words(text).map((x) => keyOf(x.replace(/[.,!?;:"“”]/g, "")));
  if (w.length < 2) return null;
  for (let len = Math.min(w.length - 1, 4); len >= 1; len--) {
    for (let i = 0; i + len <= w.length; i++) {
      const key = w.slice(i, i + len).join(" ");
      const hit = lookup.get(key);
      if (hit?.emoji && !(len === 1 && CLASSIFIERS.has(key))) return { key, emoji: hit.emoji };
    }
  }
  return null;
}

// Gợi ý cho 1 mục từ/câu. Trả về mọi trường của content_items + translations, kèm nguồn để giao diện ghi chú:
// { text_vi, item_type, say_vi, emoji, pic, min_age, max_age, tr:{lang:nghĩa}, src:{ emoji, tr:{lang:nguồn}, type } }
export function suggestItem(text, { level = 1, lookup = new Map(), langs = ["de", "en"] } = {}) {
  const t = clean(text);
  const hit = lookup.get(keyOf(t));
  const type = hit?.type && QUICK_TYPES.includes(hit.type) ? hit.type : guessType(t);
  const [min_age, max_age] = ageRange(level);
  const src = { type: hit?.type && QUICK_TYPES.includes(hit.type) ? hit.typeSrc : "rule", emoji: "", tr: {} };
  let emoji = "";
  if (hit?.emoji) { emoji = hit.emoji; src.emoji = hit.emojiSrc; }
  else if (type !== "letter") {
    const c = containedEmoji(t, lookup);
    if (c) { emoji = c.emoji; src.emoji = "guess"; src.emojiFrom = c.key; }
  }
  const tr = {};
  for (const lang of langs) {
    if (hit?.tr?.[lang]) { tr[lang] = hit.tr[lang]; src.tr[lang] = hit.trSrc[lang]; continue; }
    if (type === "letter" && LETTER_TR[lang]) { tr[lang] = LETTER_TR[lang](caseParts(t)?.upper ?? t); src.tr[lang] = "rule"; continue; }
    tr[lang] = "";
    src.tr[lang] = "";
  }
  return { text_vi: t, item_type: type, say_vi: sayOf(t), emoji, pic: null, min_age, max_age, tr, src };
}

// Gợi ý emoji cho chủ đề theo từ khoá trong tên (mặc định 📚). Chỉ là gợi ý — admin sửa được.
// Khớp NGUYÊN TỪ (regex ranh giới từ không hợp chữ có dấu): "xe" không khớp "xem". Tên đã làm sạch nên chỉ có dấu cách đơn.
const hint = (alt, emoji) => [new RegExp("(^| )(" + alt + ")(?= |$)", "iu"), emoji];
const UNIT_HINTS = [
  hint("con vật|động vật", "🐾"), hint("gia đình|người thân", "👨‍👩‍👧"), hint("cơ thể|bộ phận", "🧍"), hint("màu|màu sắc", "🎨"), hint("số đếm|số", "🔢"),
  hint("ăn uống|ăn|uống|món|thức ăn|bữa ăn|bữa cơm", "🍚"), hint("trái cây|hoa quả|quả", "🍎"), hint("đồ chơi|trò chơi", "🧸"), hint("học tập|trường|lớp|sách", "🎒"),
  hint("nhà|ngôi nhà|phòng", "🏠"), hint("thời tiết|mưa|nắng", "⛅"), hint("thiên nhiên|cây|hoa", "🌳"), hint("quần áo|trang phục", "👕"),
  hint("xe|xe cộ|giao thông|phương tiện", "🚗"), hint("cảm xúc|vui|buồn", "😊"), hint("tết|lễ hội|lễ", "🎊"), hint("nghề|công việc", "👷"), hint("chữ|chữ cái|vần|âm", "🔤"),
  hint("đọc|truyện|chuyện", "📖"), hint("bài hát|đồng dao|thơ|ca dao", "🎵"), hint("việt nam", "🇻🇳"),
];
export function suggestUnit(title, { level = 1, lookup = new Map(), langs = ["de", "en"] } = {}) {
  const t = clean(title);
  const hit = lookup.get(keyOf(t));
  const emoji = hit?.emoji || UNIT_HINTS.find(([re]) => re.test(t))?.[1] || "📚";
  const tr = Object.fromEntries(langs.map((l) => [l, hit?.tr?.[l] ?? ""]));
  return { title_vi: t, emoji, level: Number(level) || 1, title_tr: tr };
}

export function suggestLesson(title, { level = 1, lookup = new Map(), langs = ["de", "en"] } = {}) {
  const t = clean(title);
  const hit = lookup.get(keyOf(t));
  return { title_vi: t, kinds: defaultKinds(level), title_tr: Object.fromEntries(langs.map((l) => [l, hit?.tr?.[l] ?? ""])) };
}

// ---- Kiểm tra dữ liệu (giống luật nhập CSV) ----
export const checkTitle = (t, what = "Tên") => (!clean(t) ? `${what} không được để trống` : clean(t).length > 60 ? `${what} dài quá 60 ký tự` : null);
export const checkText = (t) => (!clean(t) ? "Chữ tiếng Việt không được để trống" : clean(t).length > 200 ? "Dài quá 200 ký tự" : null);

// Ô nhập nhiều dòng → danh sách chữ (bỏ dòng trống, gộp dòng trùng không phân biệt hoa/thường, giữ thứ tự). skipKeys: chữ đã có trong bài.
export function parseLines(text, skipKeys = new Set()) {
  const seen = new Set(skipKeys);
  const out = [];
  const dup = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const t = clean(line);
    if (!t) continue;
    const k = keyOf(t);
    if (seen.has(k)) { dup.push(t); continue; }
    seen.add(k);
    out.push(t);
  }
  return { lines: out, duplicates: dup };
}
