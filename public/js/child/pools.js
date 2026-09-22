import { isLiteral } from "./util.js";
import { splitSyllable, words, bare, caseParts, hasProperName, spellParts, traceTexts, stripTone, toneOf, spellingChoices } from "../viet.js";

// "Ai chơi được trò nào": vị từ lọc mục của TỪNG trò, dùng chung cho các trò (khi chạy) và cho Luyện tập (chọn phiên, mờ thẻ kỹ năng).
// Hàm thuần — có test trong tests/practice.test.mjs. Sửa luật lọc của 1 trò thì sửa Ở ĐÂY, không sửa trong file trò.
// items: mục học { id, text_vi, item_type, emoji, image_path, pic, unit_id?, level?, translations? }; env = { lang } (ngôn ngữ bản ngữ của bé).

export const END = [".", "?", "!"];

// Các bản viết SAI của 1 câu (quên viết hoa, thiếu/sai dấu câu) — đáp án nhiễu của "chọn câu viết đúng".
export function variants(text, rng = Math.random) {
  const out = [];
  const first = text[0], last = text.at(-1);
  if (first.toLowerCase() !== first) out.push(first.toLowerCase() + text.slice(1)); // quên viết hoa
  if (END.includes(last)) {
    out.push(text.slice(0, -1)); // thiếu dấu câu
    const others = END.filter((e) => e !== last);
    out.push(text.slice(0, -1) + others[Math.floor(rng() * others.length)]); // sai dấu câu
  }
  return [...new Set(out)];
}

export const withInitial = (items) => items.filter((i) => splitSyllable(i.text_vi)?.initial);
export const meaningIn = (item, lang) => item.translations?.find((t) => t.lang === lang)?.meaning ?? "";

const spellWordOk = (i) => {
  const n = [...String(i.text_vi).normalize("NFC")].length;
  return isLiteral(i) && !/\s/.test(i.text_vi) && n >= 2 && n <= 8;
};

// Nhóm tiếng CÙNG GỐC nhưng khác thanh (ma, má, mà, mả, mã, mạ) — cần ≥ 3 thanh khác nhau mới ra được câu "chọn chữ đúng thanh".
export function toneGroups(items) {
  const by = new Map();
  for (const i of items) {
    if (!splitSyllable(i.text_vi)) continue;
    const base = stripTone(i.text_vi).toLowerCase();
    if (!by.has(base)) by.set(base, []);
    by.get(base).push(i);
  }
  const out = new Map();
  for (const [base, list] of by) {
    const byTone = new Map();
    for (const i of list) if (!byTone.has(toneOf(i.text_vi))) byTone.set(toneOf(i.text_vi), i); // mỗi thanh 1 mục
    if (byTone.size >= 3) out.set(base, [...byTone.values()]);
  }
  return out;
}

// Chủ đề có ≥ 2 mục có hình đúng nghĩa (trò "phân loại": mỗi chủ đề là 1 giỏ). Chỉ từ/cụm từ ở Cấp 2–3 (chủ đề theo đề tài:
// Con vật, Gia đình…) — Cấp 1 (học vần: chữ cái/vần/câu) và Cấp 4 (đọc hiểu) không phải "loại" dù có lẫn vài mục word/phrase.
const SORT_TYPES = new Set(["word", "phrase"]);
export const sortable = (i) => isLiteral(i) && SORT_TYPES.has(i.item_type) && i.unit_id != null && [2, 3].includes(i.level ?? 2);
export function sortGroups(items) {
  const by = new Map();
  for (const i of items.filter(sortable)) {
    if (!by.has(i.unit_id)) by.set(i.unit_id, []);
    by.get(i.unit_id).push(i);
  }
  return new Map([...by].filter(([, list]) => list.length >= 2));
}

export const POOLS = {
  listen_pick: (items) => items.filter(isLiteral),
  listen_pick_text: (items) => items,
  match: (items) => items.filter(isLiteral),
  listen_repeat: (items) => items,
  listen_pick_tone: (items) => items.filter((i) => splitSyllable(i.text_vi)),
  build_syllable: withInitial,
  fill_letter: withInitial,
  read_pick: (items) => items.filter(isLiteral),
  order_words: (items) => items.filter((i) => words(i.text_vi).length >= 3),
  fill_word: (items) => items.filter((i) => words(i.text_vi).length >= 4),
  write_check: (items) => items.filter((i) => words(i.text_vi).length >= 2 && END.includes(i.text_vi.at(-1)) && variants(i.text_vi).length >= 2),
  spell_word: (items) => items.filter(spellWordOk),
  spell_along: (items) => items.filter((i) => (spellParts(i.text_vi)?.length ?? 0) >= 2),
  match_case: (items) => items.filter((i) => caseParts(i.text_vi)),
  pick_case: (items) => items.filter((i) => caseParts(i.text_vi)),
  fix_capital: (items) => items.filter((i) => words(i.text_vi).length >= 3 && hasProperName(i.text_vi)),
  trace: (items) => items.filter((i) => traceTexts(i.text_vi)),
  // Trò chỉ có ở Luyện tập
  meaning_pick: (items, env = {}) => items.filter((i) => meaningIn(i, env.lang)),
  memory_flip: (items) => items.filter(isLiteral),
  sort_unit: (items) => [...sortGroups(items).values()].flat(),
  pick_spelling: (items) => items.filter((i) => spellingChoices(i.text_vi)),
  tone_pair: (items) => [...toneGroups(items).values()].flat(),
};

// Số mục tối thiểu để chơi được (mặc định 2). Các trò còn lại có điều kiện phụ ở feasible().
export const MIN_POOL = { memory_flip: 3, tone_pair: 3, sort_unit: 4, meaning_pick: 3, pick_spelling: 3 };

export const poolOf = (kind, items, env = {}) => (POOLS[kind] ? POOLS[kind](items, env) : []);

// Chơi được trò `kind` với tập mục này không? (đúng những gì trò sẽ tự kiểm khi chạy, để khỏi vào phiên rồi bị bỏ qua hết)
export function feasible(kind, items, env = {}) {
  const pool = poolOf(kind, items, env);
  if (pool.length < (MIN_POOL[kind] ?? 2)) return false;
  if (kind === "fill_word") { // cần ≥ 4 từ khác nhau để làm đáp án nhiễu
    const vocab = new Set(pool.flatMap((i) => words(i.text_vi).map((w) => bare(w).toLowerCase())).filter((w) => w.length >= 2));
    return vocab.size >= 4;
  }
  if (kind === "sort_unit") return sortGroups(items).size >= 2;
  if (kind === "tone_pair") return toneGroups(items).size >= 1;
  return true;
}
