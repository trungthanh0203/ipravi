// Ngữ âm tiếng Việt cho các hoạt động học vần (Cấp 3). Hàm thuần — có test trong tests/unit.test.mjs.

// 6 thanh: khoá, tên, ký hiệu hình (mẹo nhớ cho bé) và gợi ý. Ký hiệu chọn emoji cũ (Unicode ≤ 6) để máy nào cũng hiện được.
export const TONES = [
  { key: "ngang", name: "ngang", symbol: "➖", hint: "phẳng như mặt hồ" },
  { key: "sac", name: "sắc", symbol: "↗️", hint: "đi lên như mũi tên" },
  { key: "huyen", name: "huyền", symbol: "↘️", hint: "trượt xuống như cầu tuột" },
  { key: "hoi", name: "hỏi", symbol: "❓", hint: "lượn xuống rồi lên" },
  { key: "nga", name: "ngã", symbol: "〰️", hint: "gồ ghề như sóng" },
  { key: "nang", name: "nặng", symbol: "⬇️", hint: "rơi bịch xuống" },
];

const MARKS = { "\u0301": "sac", "\u0300": "huyen", "\u0309": "hoi", "\u0303": "nga", "\u0323": "nang" };

// Thanh của 1 tiếng ("má" → "sac"; không dấu → "ngang"). Dấu mũ/móc (â ê ô ơ ư ă) KHÔNG phải dấu thanh.
export function toneOf(syllable) {
  for (const ch of String(syllable ?? "").normalize("NFD")) if (MARKS[ch]) return MARKS[ch];
  return "ngang";
}
export const toneInfo = (key) => TONES.find((t) => t.key === key);

// Bỏ dấu thanh, giữ dấu mũ/móc/trăng ("bà" → "ba", "ầ" → "â").
export const stripTone = (s) => [...String(s ?? "").normalize("NFD")].filter((ch) => !MARKS[ch]).join("").normalize("NFC");

// Âm đầu (dài trước): ngh ng nh ch kh gh gi ph th tr qu + phụ âm đơn.
const INITIALS = ["ngh", "ng", "nh", "ch", "kh", "gh", "gi", "ph", "th", "tr", "qu", "b", "c", "d", "đ", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "v", "x"];

// Tách 1 tiếng thành {initial, rest}: "bà" → b + à ; "nghé" → ngh + é ; "ăn" → "" + ăn ; "gì" → g + ì ; "quả" → qu + ả.
// Trả về null nếu không phải 1 tiếng đơn (có khoảng trắng / rỗng).
export function splitSyllable(word) {
  const w = String(word ?? "").normalize("NFC").trim().toLowerCase();
  if (!w || /\s/.test(w)) return null;
  for (const ini of INITIALS) {
    if (!w.startsWith(ini) || w.length === ini.length) continue;
    // "gi" chỉ là âm đầu khi theo sau là nguyên âm ("giá", "giữ"); "gìn"/"gì" thì i là nguyên âm → âm đầu là "g"
    if (ini === "gi" && !/^[aăâeêioôơuưy]/.test(stripTone(w.slice(2)))) continue;
    return { initial: ini, rest: w.slice(ini.length) };
  }
  return { initial: "", rest: w };
}

// Các tiếng trong 1 câu/cụm ("Con chào bà ạ." → ["Con","chào","bà","ạ."]) — giữ dấu câu dính vào chữ để hiển thị.
export const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean);
export const bare = (w) => w.replace(/[.,!?;:"“”]/g, "");

// Chữ để ĐỌC thành tiếng: chữ cái/vần đọc bằng tên âm ("b" → "bờ") nên có thể khác chữ hiển thị (cột `say` trong CSV).
export const spoken = (item) => item?.say_vi || item?.text_vi || "";

// ---- Đánh vần theo từng phần ----
// "bà" → bờ (âm đầu) – a (vần) – ba (tiếng chưa dấu) – huyền (dấu) – bà (cả tiếng). Bỏ phần trùng/không cần: tiếng chưa dấu trùng cả tiếng (thanh ngang),
// dấu (thanh ngang), vần trùng cả tiếng (tiếng không âm đầu). Trả về null nếu không phải 1 tiếng đơn. Mỗi phần: { role, text }.
import { initialSound } from "./sounds.js";

export function spellParts(word) {
  const sp = splitSyllable(word);
  if (!sp) return null;
  const whole = String(word).normalize("NFC").trim().toLowerCase();
  const van = stripTone(sp.rest);
  const parts = [];
  if (sp.initial) {
    const snd = initialSound(sp.initial);
    if (snd) parts.push({ role: "initial", text: snd });
  }
  if (van !== whole) parts.push({ role: "van", text: van });
  const tone = toneOf(whole);
  const base = sp.initial + van;
  if (sp.initial && tone !== "ngang" && base !== whole) parts.push({ role: "base", text: base });
  if (tone !== "ngang") parts.push({ role: "tone", text: TONES.find((t) => t.key === tone).name });
  parts.push({ role: "whole", text: whole });
  return parts;
}

// ---- Chữ hoa ----
// Mục chữ hoa có dạng "A a" / "Ch ch" (chữ hoa, dấu cách, chữ thường). Trả về { upper, lower } hoặc null.
export function caseParts(text) {
  const t = String(text ?? "").normalize("NFC").trim().split(/\s+/);
  if (t.length !== 2) return null;
  const [upper, lower] = t;
  if (!upper || upper[0] === upper[0].toLowerCase() || lower !== upper.toLowerCase()) return null;
  return { upper, lower };
}

// Chữ hoa hay bị lẫn (dùng làm đáp án nhiễu, ưu tiên hơn chữ ngẫu nhiên): hình dạng gần nhau.
const LOOKALIKES = [["B", "D", "P", "R"], ["Q", "O", "G", "C"], ["M", "N", "H"], ["I", "L", "T"], ["U", "V", "Ư"], ["A", "Ă", "Â"], ["O", "Ô", "Ơ"], ["E", "Ê"], ["D", "Đ"], ["S", "X"], ["K", "X"], ["Y", "V"]];
export function lookalikes(upper) {
  const first = upper[0];
  return [...new Set(LOOKALIKES.filter((g) => g.includes(first)).flat().filter((c) => c !== first))];
}

// Những từ PHẢI viết hoa trong câu: từ đầu câu + các từ viết hoa giữa câu (tên riêng, địa danh). Trả chỉ số từ (theo words()).
export function capitalIndexes(sentence) {
  return words(sentence).map((w, i) => ({ w: bare(w), i })).filter(({ w }) => w && w[0] !== w[0].toLowerCase()).map(({ i }) => i);
}
// Câu có ít nhất 1 tên riêng ngoài từ đầu câu (để bài "chạm từ cần viết hoa" có gì để học ngoài chữ đầu câu).
export const hasProperName = (sentence) => capitalIndexes(sentence).some((i) => i > 0);

// ---- Tô chữ ----
// Các chuỗi cần tô của 1 mục: cặp chữ hoa/thường → [hoa, thường]; 1 từ/1 chữ (tối đa 8 ký tự) → [chữ]; còn lại (câu, cụm từ) → null (không tô).
export function traceTexts(text) {
  const cp = caseParts(text);
  if (cp) return [cp.upper, cp.lower];
  const t = String(text ?? "").normalize("NFC").trim();
  if (!t || /\s/.test(t) || [...t].length > 8) return null;
  return [t];
}
