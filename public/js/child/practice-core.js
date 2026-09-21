import { SKILLS, KIND_COST, KIND_CAP, PAIR_KINDS, kindAllowed } from "./skills.js";
import { feasible, poolOf, sortGroups, toneGroups } from "./pools.js";

// Bộ não của "Luyện tập": chọn mục theo phạm vi + độ ưu tiên, chọn "họ" mục, xếp các trò của 1 phiên. Hàm thuần (rng truyền vào được để test).
// catalog = mục học đã duyệt, mỗi mục gắn { unit_id, level, unit:{id,title_vi,emoji,image_path} }; progress = Map item_id → { mastery, wrong_count, last_seen_at }.

// "Họ" mục: chỉ trộn các mục cùng họ trong 1 phiên — các trò lấy đáp án nhiễu từ chính tập mục, nên trộn chữ cái với câu sẽ ra nhiễu vô nghĩa.
export const FAMILIES = { letters: ["letter", "syllable"], words: ["word", "phrase"], sentences: ["sentence", "story", "song"] };
export const familyOf = (item) => Object.keys(FAMILIES).find((f) => FAMILIES[f].includes(item.item_type ?? "word")) ?? "words";

export const SESSION_TURNS = 7; // mỗi phiên ~7 lượt (6–8)
const DAY = 86_400_000;

// ---- Phạm vi ----
// scope: { type: 'all' } | { type: 'level', level } | { type: 'unit', unitId } | { type: 'weak' }
export const isWeak = (p) => Boolean(p) && (p.wrong_count ?? 0) > 0 && (p.mastery ?? 0) < 3;
export function scopeItems(catalog, scope, progress = new Map()) {
  switch (scope?.type) {
    case "level": return catalog.filter((i) => i.level === scope.level);
    case "unit": return catalog.filter((i) => i.unit_id === scope.unitId);
    case "weak": return catalog.filter((i) => isWeak(progress.get(i.id)));
    default: return catalog;
  }
}
export const weakCount = (catalog, progress) => catalog.filter((i) => isWeak(progress.get(i.id))).length;

// ---- Độ ưu tiên ----
// Từ chưa thuộc (mastery < 3), từ hay sai (tối đa +3) và từ lâu chưa gặp (+1 mỗi tuần, tối đa +2) được chọn nhiều hơn; từ chưa từng gặp tính như "lâu chưa gặp + chưa thuộc".
export function weightOf(prog, now = Date.now()) {
  const mastery = prog?.mastery ?? 0;
  const days = prog?.last_seen_at ? Math.max(0, (now - new Date(prog.last_seen_at).getTime()) / DAY) : 14;
  return 1 + (mastery < 3 ? 2 : 0) + Math.min(prog?.wrong_count ?? 0, 3) + Math.min(days / 7, 2);
}

// Lấy n phần tử KHÔNG lặp, xác suất theo trọng số (Efraimidis–Spirakis: khoá = u^(1/w), lấy khoá lớn nhất).
export function weightedSample(items, n, weightFn, rng = Math.random) {
  return items
    .map((it) => ({ it, k: Math.pow(rng(), 1 / Math.max(weightFn(it), 1e-6)) }))
    .sort((a, b) => b.k - a.k)
    .slice(0, Math.max(0, n))
    .map((x) => x.it);
}

const pickWeighted = (list, weightFn, rng) => weightedSample(list, 1, weightFn, rng)[0];

// ---- Chọn họ + trò ----
// Trả về { family, items, kinds } — họ mục có ≥ 1 trò của kỹ năng chơi được (chọn ngẫu nhiên theo số mục) — hoặc null.
export function chooseFamily(skill, items, { age = null, lang = "" } = {}, rng = Math.random) {
  const env = { lang };
  const cands = Object.keys(FAMILIES).map((family) => {
    const fi = items.filter((i) => familyOf(i) === family);
    const kinds = skill.kinds.filter((k) => kindAllowed(k, age) && feasible(k, fi, env));
    return { family, items: fi, kinds };
  }).filter((c) => c.kinds.length);
  return cands.length ? pickWeighted(cands, (c) => c.items.length, rng) : null;
}

// Thẻ kỹ năng có chơi được không (dùng để làm mờ thẻ chưa đủ dữ liệu).
export const skillPlayable = (skill, items, opts) => chooseFamily(skill, items, opts) !== null;

// ---- Xếp phiên ----
// Trả [{ kind, config, turns }] có tổng lượt ≈ target. Tối đa 3 trò khác nhau (xáo ngẫu nhiên) để đỡ chán; kỹ năng chỉ có 1 trò thì trò đó chạy đủ phiên
// (trò ghép cặp chạy 2 bảng).
export function planSession(kinds, target = SESSION_TURNS, rng = Math.random) {
  const order = [...kinds].sort(() => rng() - 0.5).slice(0, 3);
  const single = order.length === 1;
  const plan = [];
  let remaining = target;
  order.forEach((kind, idx) => {
    const cost = KIND_COST[kind] ?? 1;
    const left = order.length - idx;
    if (PAIR_KINDS.has(kind)) {
      const boards = single ? 2 : 1;
      for (let b = 0; b < boards; b++) plan.push({ kind, config: { pairs: 4 }, turns: cost });
      remaining -= cost * boards;
      return;
    }
    const cap = single ? target : (KIND_CAP[kind] ?? 8);
    const units = Math.max(1, Math.min(cap, Math.floor(Math.ceil(remaining / left) / cost)));
    plan.push({ kind, config: { rounds: units }, turns: units * cost });
    remaining -= units * cost;
  });
  return plan;
}

// ---- Chọn mục cho từng trò ----
// Mỗi trò nhận TẬP MỤC RIÊNG (lấy từ các mục trò đó chơi được) để chắc chắn đủ điều kiện; ưu tiên theo trọng số.
export function selectFor(kind, familyItems, entry, progress, { lang = "" } = {}, rng = Math.random) {
  const env = { lang };
  const w = (i) => weightOf(progress.get(i.id));
  const pool = poolOf(kind, familyItems, env);
  const need = entry.config.pairs ?? entry.config.rounds ?? 4;
  if (kind === "sort_unit") {
    const groups = sortGroups(familyItems);
    const keys = weightedSample([...groups.keys()], 3, (u) => groups.get(u).reduce((a, i) => a + w(i), 0), rng);
    return keys.flatMap((u) => weightedSample(groups.get(u), 4, w, rng));
  }
  if (kind === "tone_pair") {
    const groups = toneGroups(familyItems);
    const keys = weightedSample([...groups.keys()], 3, (b) => groups.get(b).reduce((a, i) => a + w(i), 0), rng);
    return keys.flatMap((b) => groups.get(b));
  }
  if (PAIR_KINDS.has(kind)) return weightedSample(pool, need, w, rng);
  const subset = weightedSample(pool, Math.max(8, need * 2), w, rng);
  // Tập con quá nhỏ để chơi (vd điền từ cần ≥ 4 từ khác nhau) → dùng cả tập.
  return feasible(kind, subset, env) ? subset : weightedSample(pool, 24, w, rng);
}

// Lập cả phiên. Trả { ok:false, reason } hoặc { ok:true, skill, family, plan:[{kind, config, turns, items}], turns, itemIds }.
export function planPractice(skill, catalog, scope, progress, { age = null, lang = "", target = SESSION_TURNS, rng = Math.random } = {}) {
  const scoped = scopeItems(catalog, scope, progress);
  if (!scoped.length) return { ok: false, reason: scope?.type === "weak" ? "noWeak" : "noItems" };
  const fam = chooseFamily(skill, scoped, { age, lang }, rng);
  if (!fam) return { ok: false, reason: "notEnough" };
  const plan = planSession(fam.kinds, target, rng).map((e) => ({ ...e, items: selectFor(e.kind, fam.items, e, progress, { lang }, rng) }));
  const ids = [...new Set(plan.flatMap((e) => e.items.map((i) => i.id)))];
  return { ok: true, skill, family: fam.family, plan, turns: plan.reduce((a, e) => a + e.turns, 0), itemIds: ids };
}

// Các kỹ năng bé có thể chơi ở độ tuổi này (ẩn hẳn kỹ năng chỉ có trò cần đọc chữ khi bé còn nhỏ).
export const skillsForAge = (age) => SKILLS.filter((s) => s.kinds.some((k) => kindAllowed(k, age)));
