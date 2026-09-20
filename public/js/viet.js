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
