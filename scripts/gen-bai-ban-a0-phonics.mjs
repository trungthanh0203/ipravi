// Sinh giao-trinh/bai-ban/bai-ban-a0-bang-chu-cai-ngu-am-thanh-dieu.csv — chuyên đề "Bảng chữ cái, Ngữ âm & Thanh
// điệu căn bản" (tiền-A1, cấp "A0") cho giáo trình "Tiếng Việt Bài Bản". LẤY NGUYÊN dữ liệu ngữ âm từ
// public/js/sounds.js (INITIAL_SOUND, VOWELS) và public/js/viet.js (TONES, CONFUSE qua spellingChoices) — CÙNG
// nguồn đã dùng cho "Ngân hàng âm" bên khu trẻ em — để tên đọc chữ cái/thanh điệu nhất quán trong toàn app, không
// tự bịa lại. 5 bài tổng quan → chi tiết (Tổng quan bảng chữ cái → Nguyên âm → Phụ âm → Thanh điệu → Ghép vần),
// bài cuối là "Ôn tập" (Boss cuối Unit, xem KE_HOACH_TIENG_VIET_BAI_BAN.md mục 18–19) tự gộp ôn cả 4 bài trước.
// Sửa nội dung: sửa trong file này rồi chạy lại `node scripts/gen-bai-ban-a0-phonics.mjs`, đừng sửa tay CSV.
import { writeFileSync } from "node:fs";
import { INITIAL_SOUND, VOWELS } from "../public/js/sounds.js";
import { TONES } from "../public/js/viet.js";

const q = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const HEAD = ["level", "level_name", "can_do", "unit", "unit_emoji", "lesson", "lesson_type", "step_type", "speaker", "vi", "vi2", "pos", "say", "game", "question", "choices", "answer", "examples", "en", "de"];
const rows = [];
const r = (obj) => rows.push(HEAD.map((h) => obj[h] ?? ""));

const LEVEL = "A0";
const UNIT = "Bảng chữ cái, Ngữ âm & Thanh điệu căn bản";

// 29 chữ cái theo đúng thứ tự bảng chữ cái tiếng Việt.
const ALPHABET = ["a", "ă", "â", "b", "c", "d", "đ", "e", "ê", "g", "h", "i", "k", "l", "m", "n", "o", "ô", "ơ", "p", "q", "r", "s", "t", "u", "ư", "v", "x", "y"];
const vowelSay = (ch) => VOWELS.find((v) => v[0] === ch)?.[1] ?? null; // ă→á, â→ớ, y→"i dài"; còn lại null (đọc đúng chữ)
const isVowel = (ch) => VOWELS.some((v) => v[0] === ch);
// Gloss chung "vowel a"/"Vokal a" hay "consonant b"/"Konsonant b" — cùng khuôn LETTER_TR đã dùng ở admin/autofill.js
// (khu trẻ em) cho nghĩa mẫu của chữ cái, không tự bịa nghĩa riêng.
const glossEn = (ch) => (isVowel(ch) ? `vowel ${ch}` : `consonant ${ch}`);
const glossDe = (ch) => (isVowel(ch) ? `Vokal ${ch}` : `Konsonant ${ch}`);

// ============================================================== Bài 1: Tổng quan bảng chữ cái
const L1 = "Bài 1: Tổng quan bảng chữ cái";
r({ level: LEVEL, level_name: "Nhập môn", can_do: "Đọc đúng 29 chữ cái, phân biệt nguyên âm/phụ âm, nhận biết 6 thanh điệu, ghép được vần đơn giản.",
  unit: UNIT, unit_emoji: "🔤", lesson: L1, lesson_type: "core", step_type: "grammar",
  vi: "Bảng chữ cái tiếng Việt = 29 chữ cái", en: "Vietnamese alphabet = 29 letters", de: "Vietnamesisches Alphabet = 29 Buchstaben",
  examples: "Dựa trên chữ Latinh, có thêm dấu (ă â ê ô ơ ư đ);Không có f, j, w, z (chỉ dùng trong từ mượn nước ngoài)" });
ALPHABET.forEach((ch, i) => {
  r({ level: LEVEL, unit: UNIT, lesson: L1, step_type: "vocab", vi: ch, pos: isVowel(ch) ? "nguyên âm" : "phụ âm",
    say: isVowel(ch) ? vowelSay(ch) : INITIAL_SOUND[ch], en: glossEn(ch), de: glossDe(ch) });
});
r({ level: LEVEL, unit: UNIT, lesson: L1, step_type: "minigame", game: "meaning_pick" });

// ============================================================== Bài 2: Nguyên âm
const L2 = "Bài 2: Nguyên âm";
const VOWEL_DEMO = {
  a: ["ba", "dad", "Vater"], ă: ["ăn", "to eat", "essen"], â: ["ấm", "warm", "warm"], e: ["em", "younger sibling", "jüngeres Geschwister"],
  ê: ["đêm", "night", "die Nacht"], i: ["đi", "to go", "gehen"], o: ["to", "big", "groß"], ô: ["cô", "aunt, Ms.", "Tante, Frau (Anrede)"],
  ơ: ["nhớ", "to miss, remember", "vermissen, sich erinnern"], u: ["thu", "autumn", "der Herbst"], ư: ["thư", "letter (mail)", "der Brief"], y: ["ý", "idea", "die Idee"],
};
VOWELS.forEach(([ch]) => {
  r({ level: LEVEL, unit: UNIT, lesson: L2, lesson_type: "core", step_type: "vocab", vi: ch, pos: "nguyên âm",
    say: vowelSay(ch), en: glossEn(ch), de: glossDe(ch) });
});
r({ level: LEVEL, unit: UNIT, lesson: L2, step_type: "grammar", vi: "Nguyên âm trong từ", en: "Vowels in words", de: "Vokale in Wörtern",
  examples: Object.entries(VOWEL_DEMO).map(([, [w]]) => w).join(";") });
r({ level: LEVEL, unit: UNIT, lesson: L2, step_type: "minigame", game: "meaning_pick" });

// ============================================================== Bài 3: Phụ âm
const L3 = "Bài 3: Phụ âm";
const CONSONANTS = Object.keys(INITIAL_SOUND); // đơn + tổ hợp (ch, gh, gi, kh, ng, ngh, nh, ph, qu, th, tr…) — cùng nguồn Ngân hàng âm
r({ level: LEVEL, unit: UNIT, lesson: L3, lesson_type: "core", step_type: "grammar", vi: "Phụ âm đơn và phụ âm ghép",
  en: "Single and compound consonants", de: "Einzelne und zusammengesetzte Konsonanten",
  examples: "Phụ âm ghép gồm 2-3 chữ nhưng đọc thành 1 âm: ch, gh, gi, kh, ng, ngh, nh, ph, qu, th, tr" });
r({ level: LEVEL, unit: UNIT, lesson: L3, step_type: "grammar", vi: "Quy tắc viết c/k, g/gh, ng/ngh",
  en: "Spelling rule for c/k, g/gh, ng/ngh", de: "Schreibregel für c/k, g/gh, ng/ngh",
  examples: "Trước i, e, ê viết k, gh, ngh (kem, ghế, nghe);Còn lại viết c, g, ng (cá, gà, ngủ)" });
CONSONANTS.forEach((ch) => {
  r({ level: LEVEL, unit: UNIT, lesson: L3, step_type: "vocab", vi: ch, pos: "phụ âm", say: INITIAL_SOUND[ch], en: glossEn(ch), de: glossDe(ch) });
});
// 5 cặp âm dễ nhầm THẬT (khác vùng miền phát âm khác nhau) — KHÔNG gồm c/k, g/gh, ng/ngh (chỉ khác cách viết, đọc
// giống nhau hoàn toàn nên không hợp để "nghe rồi đoán âm nào" — đã tách riêng thành quy tắc viết ở trên).
const CONFUSE_PAIRS = [["ch", "tr", "cha - tra"], ["s", "x", "sa - xa"], ["d", "gi", "da - gia"], ["d", "r", "da - ra"], ["l", "n", "la - na"]];
CONFUSE_PAIRS.forEach(([a, b, ex]) => r({ level: LEVEL, unit: UNIT, lesson: L3, step_type: "phonics", vi: a, vi2: b, examples: ex }));
r({ level: LEVEL, unit: UNIT, lesson: L3, step_type: "minigame", game: "phonics_discrim" });

// ============================================================== Bài 4: Thanh điệu
const L4 = "Bài 4: Thanh điệu";
// ba/bà/bá/bả/bã/bạ = ví dụ kinh điển khi dạy 6 thanh (cùng 1 phụ âm+vần, chỉ đổi thanh) — TONES.hint là mô tả
// lên/xuống giọng đã dùng cho bé (viet.js), tái dùng để nhất quán, không tự đặt tên/ẩn dụ khác.
const TONE_DEMO = { ngang: "ba", sac: "bá", huyen: "bà", hoi: "bả", nga: "bã", nang: "bạ" };
const TONE_TR = {
  ngang: ["level tone", "gleichbleibender Ton"], sac: ["rising tone", "steigender Ton"], huyen: ["falling tone", "fallender Ton"],
  hoi: ["dipping tone", "fallend-steigender Ton"], nga: ["broken rising tone", "gebrochener, steigender Ton"], nang: ["heavy tone", "schwerer, kurzer Ton"],
};
TONES.forEach((t) => {
  r({ level: LEVEL, unit: UNIT, lesson: L4, lesson_type: "core", step_type: "vocab", vi: TONE_DEMO[t.key], pos: `thanh ${t.name}`,
    en: TONE_TR[t.key][0], de: TONE_TR[t.key][1] });
});
r({ level: LEVEL, unit: UNIT, lesson: L4, step_type: "grammar", vi: "6 thanh điệu — cách lên xuống giọng",
  en: "6 tones — pitch pattern", de: "6 Töne — Tonhöhenverlauf",
  examples: TONES.map((t) => `${t.name}: ${t.hint}`).join(";") });
r({ level: LEVEL, unit: UNIT, lesson: L4, step_type: "phonics", vi: "hỏi (bả)", vi2: "ngã (bã)", examples: "bả - bã;Đây là 2 thanh dễ nhầm nhất" });
r({ level: LEVEL, unit: UNIT, lesson: L4, step_type: "minigame", game: "phonics_discrim" });

// ============================================================== Bài 5: Ghép vần (Ôn tập — Boss cuối Unit)
const L5 = "Bài 5: Ghép vần (Ôn tập)";
r({ level: LEVEL, unit: UNIT, lesson: L5, lesson_type: "review", step_type: "grammar", vi: "Âm đầu + Vần + Thanh điệu = Tiếng",
  en: "Initial sound + rhyme + tone = syllable", de: "Anlaut + Reim + Ton = Silbe",
  examples: "bà = b + a + thanh huyền;mẹ = m + e + thanh nặng;cô = c + ô + thanh ngang;chị = ch + i + thanh nặng" });
r({ level: LEVEL, unit: UNIT, lesson: L5, step_type: "minigame", game: "meaning_pick" });

const text = [HEAD.join(","), ...rows.map((row) => row.map(q).join(","))].join("\n") + "\n";
writeFileSync("giao-trinh/bai-ban/bai-ban-a0-bang-chu-cai-ngu-am-thanh-dieu.csv", text, "utf8");
console.log(`Đã ghi ${rows.length} dòng.`);
