// Kỹ năng của "Luyện tập": mỗi kỹ năng = 1 nhóm trò cùng rèn một việc. Hàm/dữ liệu thuần — test trong tests/practice.test.mjs.
// Ánh xạ trò → kỹ năng PHẢI khớp hàm SQL skill_of() (migration 016); test rls.test.mjs mục 22 kiểm hai bên.
// Màu theo NHÓM (mỗi kỹ năng thêm biểu tượng riêng) để bé nhận ra ngay: xanh = nghe–nói, xanh lá = vui–nhớ, cam = chữ–viết.

export const GROUPS = [
  { id: "listen", name: "Nghe – Nói", color: "#3b82f6", soft: "#e7f0ff" },
  { id: "fun", name: "Vui – Nhớ", color: "#2f9e44", soft: "#e6f7ea" },
  { id: "write", name: "Chữ – Viết", color: "#e8590c", soft: "#fff1e6" },
];

// kinds: các trò thuộc kỹ năng; needsText: chỉ có trò cần nhận mặt chữ (bé < MIN_AGE_FOR_TEXT không chơi).
export const SKILLS = [
  { id: "listen", group: "listen", emoji: "👂", name: "Nghe", desc: "Nghe rồi chọn hình hoặc chữ đúng", kinds: ["listen_pick", "listen_pick_text"] },
  { id: "speak", group: "listen", emoji: "🎤", name: "Nói", desc: "Nghe rồi nói theo", kinds: ["listen_repeat"] },
  { id: "tone", group: "listen", emoji: "🎵", name: "Thanh điệu", desc: "Phân biệt ma – má – mà – mả – mã – mạ", kinds: ["listen_pick_tone", "tone_pair"] },
  { id: "meaning", group: "listen", emoji: "🧠", name: "Hiểu nghĩa", desc: "Từ tiếng Việt nghĩa là gì?", kinds: ["meaning_pick"] },
  { id: "memory", group: "fun", emoji: "🧩", name: "Trí nhớ", desc: "Lật thẻ tìm cặp giống nhau", kinds: ["memory_flip"] },
  { id: "sort", group: "fun", emoji: "🗂️", name: "Phân loại", desc: "Xếp mỗi thứ vào đúng nhóm", kinds: ["sort_unit"] },
  { id: "trace", group: "write", emoji: "✏️", name: "Tô chữ", desc: "Tô theo chữ mẫu", kinds: ["trace"] },
  { id: "spell", group: "write", emoji: "🔤", name: "Đánh vần", desc: "Đánh vần từng phần của tiếng", kinds: ["spell_along"] },
  { id: "build", group: "write", emoji: "🧱", name: "Ghép chữ", desc: "Ghép âm, vần, chữ thành từ", kinds: ["build_syllable", "fill_letter", "order_words", "spell_word", "match_case", "pick_case"] },
  { id: "read", group: "write", emoji: "📖", name: "Đọc", desc: "Đọc chữ rồi chọn hình, điền từ", kinds: ["read_pick", "fill_word", "match"] },
  { id: "case", group: "write", emoji: "🅰️", name: "Viết hoa", desc: "Viết hoa và dấu câu", kinds: ["fix_capital", "write_check"] },
  { id: "spelling", group: "write", emoji: "🔎", name: "Chính tả", desc: "Chọn cách viết đúng", kinds: ["pick_spelling"] },
];

export const skillById = (id) => SKILLS.find((s) => s.id === id);
export const groupById = (id) => GROUPS.find((g) => g.id === id);

// Kỹ năng của 1 trò (cho nhật ký học). Trò của bài học nhưng chưa có thẻ luyện tập (xếp câu, đọc hiểu) vẫn được gán kỹ năng để thống kê.
const EXTRA = { order_story: "story", read_quiz: "quiz" };
export const skillOf = (kind) => SKILLS.find((s) => s.kinds.includes(kind))?.id ?? EXTRA[kind] ?? null;

// Trẻ nhỏ hơn tuổi này thì bỏ các trò cần nhận mặt chữ. (Dùng chung cho bài học và luyện tập.)
export const MIN_AGE_FOR_TEXT = 5;
export const TEXT_KINDS = new Set(["listen_pick_text", "build_syllable", "fill_letter", "read_pick", "order_words", "read_quiz", "fill_word", "write_check", "spell_word", "order_story", "spell_along", "match_case", "pick_case", "fix_capital", "trace",
  "meaning_pick", "pick_spelling", "tone_pair"]);
export const kindAllowed = (kind, age) => !(TEXT_KINDS.has(kind) && age != null && age < MIN_AGE_FOR_TEXT);

// "Lượt" mỗi trò tính vào phiên (mỗi phiên khoảng 6–8 lượt): ghép cặp cả bảng = 3 lượt, tô chữ/đánh vần dài hơn nên tính 2.
export const KIND_COST = { match: 3, match_case: 3, memory_flip: 3, spell_along: 2, trace: 2 };
// Số lượt tối đa của 1 trò trong 1 phiên (để phiên luôn có vài trò khác nhau thay vì 1 trò lặp lại).
export const KIND_CAP = { listen_repeat: 3, trace: 3, spell_along: 3, order_words: 3, fix_capital: 3, sort_unit: 6, match: 1, match_case: 1, memory_flip: 1 };
// Trò dùng cấu hình `pairs` thay vì `rounds`.
export const PAIR_KINDS = new Set(["match", "match_case", "memory_flip"]);
