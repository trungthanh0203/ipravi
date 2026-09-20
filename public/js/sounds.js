// "Ngân hàng âm": các âm nhỏ cần giọng người thật — âm chữ cái, vần, tên dấu thanh — dùng để thu âm và (sau này) để đánh vần theo từng phần.
// Hàm thuần, có test trong tests/unit.test.mjs. Danh sách theo cách đọc thông dụng trong dạy học vần; người dạy có thể sửa ở tab Nội dung.

// Âm đầu → cách đọc ("b" đọc "bờ"). k, q, gh, ngh đọc giống c, qu, g, ng.
export const INITIAL_SOUND = {
  b: "bờ", c: "cờ", ch: "chờ", d: "dờ", đ: "đờ", g: "gờ", gh: "gờ", gi: "giờ", h: "hờ", k: "cờ", kh: "khờ", l: "lờ", m: "mờ", n: "nờ",
  ng: "ngờ", ngh: "ngờ", nh: "nhờ", p: "pờ", ph: "phờ", q: "cờ", qu: "quờ", r: "rờ", s: "sờ", t: "tờ", th: "thờ", tr: "trờ", v: "vờ", x: "xờ",
};
export const initialSound = (initial) => INITIAL_SOUND[initial] ?? "";

// Nguyên âm đơn: [chữ, chữ để đọc thành tiếng nếu khác]
export const VOWELS = [["a"], ["ă", "á"], ["â", "ớ"], ["e"], ["ê"], ["i"], ["y", "i dài"], ["o"], ["ô"], ["ơ"], ["u"], ["ư"]];

// Vần thông dụng (không gồm nguyên âm đơn). Nhóm theo âm cuối để thu từng đợt ngắn.
export const VAN_GROUPS = [
  ["Vần -n (an, ăn, ân…)", ["an", "ăn", "ân", "en", "ên", "in", "on", "ôn", "ơn", "un", "ưn"]],
  ["Vần -m (am, ăm, âm…)", ["am", "ăm", "âm", "em", "êm", "im", "om", "ôm", "ơm", "um", "ưm"]],
  ["Vần -p (ap, ăp, âp…)", ["ap", "ăp", "âp", "ep", "êp", "ip", "op", "ôp", "ơp", "up", "ưp"]],
  ["Vần -t (at, ăt, ât…)", ["at", "ăt", "ât", "et", "êt", "it", "ot", "ôt", "ơt", "ut", "ưt"]],
  ["Vần -c (ac, ăc, âc…)", ["ac", "ăc", "âc", "oc", "ôc", "uc", "ưc"]],
  ["Vần -ng, -nh, -ch", ["ang", "ăng", "âng", "eng", "ong", "ông", "ung", "ưng", "anh", "ênh", "inh", "ach", "êch", "ich"]],
  ["Vần kép (ai, ao, ia, ua…)", ["ai", "ay", "ây", "oi", "ôi", "ơi", "ui", "ưi", "ao", "au", "âu", "eo", "êu", "iu", "ia", "ua", "ưa", "iê", "uô", "ươ"]],
];

// Tên 6 thanh. "Tên dấu" khi đánh vần: bờ – a – ba – huyền – bà.
export const TONE_NAMES = ["ngang", "sắc", "huyền", "hỏi", "ngã", "nặng"];

export const BANK_UNIT = "Ngân hàng âm";

// Kế hoạch tạo ngân hàng: [{ lesson, items: [{ text, say? }] }]. Mỗi mục là 1 âm cần giọng thu.
export function bankPlan() {
  const consonants = [...new Set(Object.values(INITIAL_SOUND))]; // bỏ trùng (k/q/c cùng "cờ")
  return [
    { lesson: "Âm phụ âm (bờ, cờ, dờ…)", items: consonants.map((text) => ({ text })) },
    { lesson: "Âm nguyên âm (a, ă, â…)", items: VOWELS.map(([text, say]) => ({ text, ...(say ? { say } : {}) })) },
    { lesson: "Tên sáu thanh", items: TONE_NAMES.map((text) => ({ text })) },
    ...VAN_GROUPS.map(([lesson, list]) => ({ lesson, items: list.map((text) => ({ text })) })),
  ];
}
