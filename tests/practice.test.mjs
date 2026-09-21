// Luyện tập theo kỹ năng: hàm thuần (vị từ lọc, kỹ năng, chọn phiên) + kiểm tra trên giáo trình thật. Chạy: node tests/practice.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { SKILLS, GROUPS, skillOf, skillById, kindAllowed, KIND_COST } from "../public/js/child/skills.js";
import { POOLS, feasible, toneGroups, variants, meaningIn } from "../public/js/child/pools.js";
import { familyOf, weightOf, weightedSample, scopeItems, weakCount, chooseFamily, planSession, planPractice, selectFor, skillPlayable, skillsForAge } from "../public/js/child/practice-core.js";
import { spellingChoices } from "../public/js/viet.js";
import { parseCsv, validateRows } from "../public/js/admin/csv.js";

let pass = 0, fail = 0;
const ok = (c, n, x = "") => { (c ? pass++ : fail++); console.log(`${c ? "ok  " : "FAIL"} ${n}${c ? "" : "  <-- " + x}`); };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---- Đăng ký kỹ năng ----
const runnersSrc = readFileSync(new URL("../public/js/child/runners.js", import.meta.url), "utf8");
const runnerKinds = [...runnersSrc.slice(runnersSrc.indexOf("export const RUNNERS")).matchAll(/^\s{2}(\w+): [\w.]+,$/gm)].map((m) => m[1]);
ok(runnerKinds.length === 24, "runners.js: 24 loại trò", String(runnerKinds.length));
const kindsInSkills = SKILLS.flatMap((s) => s.kinds);
ok(new Set(kindsInSkills).size === kindsInSkills.length, "mỗi trò thuộc đúng 1 kỹ năng");
ok(kindsInSkills.every((k) => runnerKinds.includes(k)), "mọi trò trong kỹ năng đều có runner", kindsInSkills.filter((k) => !runnerKinds.includes(k)).join());
ok(runnerKinds.every((k) => skillOf(k)), "mọi runner đều có kỹ năng (kể cả xếp câu/đọc hiểu để thống kê)", runnerKinds.filter((k) => !skillOf(k)).join());
ok(kindsInSkills.every((k) => POOLS[k]), "mọi trò của kỹ năng đều có vị từ lọc trong pools.js");
eq(SKILLS.length, 12, "12 kỹ năng");
ok(SKILLS.every((s) => GROUPS.some((g) => g.id === s.group)), "mỗi kỹ năng thuộc 1 nhóm màu");
eq([skillOf("order_story"), skillOf("read_quiz"), skillOf("listen_pick"), skillOf("nope")], ["story", "quiz", "listen", null], "skillOf");
ok(kindAllowed("trace", 4) === false && kindAllowed("trace", 6) && kindAllowed("memory_flip", 3) && kindAllowed("trace", null), "tuổi < 5 bỏ trò cần chữ; không rõ tuổi thì cho chơi");
ok(skillsForAge(3).length < skillsForAge(6).length && skillsForAge(3).some((s) => s.id === "memory") && !skillsForAge(3).some((s) => s.id === "trace"), "bé 3 tuổi không thấy kỹ năng chỉ có trò cần chữ");

// ---- Chính tả ----
{
  eq(spellingChoices("chó", () => 0), { right: "chó", wrongs: ["tró"] }, "chính tả: chó → tró");
  eq(spellingChoices("dì", () => 0).wrongs, ["rì"], "chính tả: dì → rì (gì bị loại vì là từ có thật)");
  ok(spellingChoices("gì") === null && spellingChoices("a") === null && spellingChoices("ăn") === null, "chính tả: 'gì', 'a', 'ăn' không có âm đầu dễ nhầm");
  eq(spellingChoices("Chị", () => 0).wrongs, ["Trị"], "chính tả: giữ chữ hoa đầu");
  eq(spellingChoices("con cá", () => 0).wrongs, ["kon cá"], "chính tả: chọn tiếng đầu tiên có âm dễ nhầm (rng=0)");
  ok(spellingChoices("một hai ba bốn") === null, "chính tả: quá 3 tiếng bị bỏ qua");
}

// ---- Vị từ lọc ----
const it = (id, text, extra = {}) => ({ id, text_vi: text, item_type: "word", emoji: "🐶", ...extra });
{
  eq(POOLS.listen_pick([it(1, "a"), it(2, "b", { emoji: null }), it(3, "c", { pic: "decor" })]).map((i) => i.id), [1], "listen_pick: chỉ mục có hình đúng nghĩa");
  const tones = ["ma", "má", "mà", "mả"].map((t, i) => it(10 + i, t, { item_type: "syllable" }));
  eq([...toneGroups(tones).keys()], ["ma"], "toneGroups: nhóm ma có 4 thanh");
  ok(!feasible("tone_pair", tones.slice(0, 2)) && feasible("tone_pair", tones), "tone_pair: cần ≥ 3 thanh cùng gốc");
  const u = (id, unit, lvl = 1) => it(id, "w" + id, { unit_id: unit, level: lvl, unit: { id: unit, title_vi: "U" + unit } });
  ok(feasible("sort_unit", [u(1, 1), u(2, 1), u(3, 2), u(4, 2)]) && !feasible("sort_unit", [u(1, 1), u(2, 1), u(3, 1), u(4, 1)]), "sort_unit: cần ≥ 2 chủ đề, mỗi chủ đề ≥ 2 mục");
  ok(!feasible("sort_unit", [u(1, 1, 3), u(2, 1, 3), u(3, 2, 3), u(4, 2, 3)]), "sort_unit: chỉ Cấp 1–2 (chữ cái/câu không phải 'loại')");
  const tr = (id, m) => it(id, "t" + id, { translations: [{ lang: "de", meaning: m }] });
  ok(feasible("meaning_pick", [tr(1, "a"), tr(2, "b"), tr(3, "c")], { lang: "de" }) && !feasible("meaning_pick", [tr(1, "a"), tr(2, "b"), tr(3, "c")], { lang: "en" }), "meaning_pick: cần nghĩa của ngôn ngữ bản ngữ");
  ok(!feasible("fill_word", [it(1, "con con con con"), it(2, "con con con con")]) && feasible("fill_word", [it(1, "con chó chạy nhanh"), it(2, "mẹ nấu cơm ngon lắm")]), "fill_word: cần ≥ 4 từ khác nhau");
  ok(!feasible("memory_flip", [it(1, "a"), it(2, "b")]) && feasible("memory_flip", [it(1, "a"), it(2, "b"), it(3, "c")]), "memory_flip: ≥ 3 mục");
  ok(variants("Con chào bà.", () => 0).length >= 2, "variants: có ≥ 2 bản sai");
  eq(meaningIn({ translations: [{ lang: "de", meaning: "Hund" }] }, "de"), "Hund", "meaningIn");
}

// ---- Trọng số + lấy mẫu ----
{
  const now = Date.parse("2026-09-21T00:00:00Z");
  const fresh = { mastery: 5, wrong_count: 0, last_seen_at: "2026-09-21T00:00:00Z" };
  const weak = { mastery: 1, wrong_count: 4, last_seen_at: "2026-09-01T00:00:00Z" };
  ok(weightOf(fresh, now) === 1, "weightOf: từ đã thuộc, vừa gặp = 1", String(weightOf(fresh, now)));
  ok(weightOf(weak, now) === 1 + 2 + 3 + 2, "weightOf: từ chưa thuộc + sai nhiều + lâu chưa gặp = 8", String(weightOf(weak, now)));
  ok(weightOf(undefined, now) === 5, "weightOf: từ chưa từng gặp = 5");
  const rng = seeded(7);
  let hitsWeak = 0, hitsFresh = 0;
  for (let i = 0; i < 2000; i++) { const [x] = weightedSample(["weak", "fresh"], 1, (k) => (k === "weak" ? 8 : 1), rng); x === "weak" ? hitsWeak++ : hitsFresh++; }
  ok(hitsWeak > hitsFresh * 5, "weightedSample: từ trọng số cao được chọn nhiều hơn hẳn", `${hitsWeak}/${hitsFresh}`);
  eq(new Set(weightedSample([1, 2, 3, 4, 5], 5, () => 1, seeded(1))).size, 5, "weightedSample: không lặp");
  eq(weightedSample([1, 2], 5, () => 1).length, 2, "weightedSample: n lớn hơn số phần tử");
}

// ---- Phạm vi ----
{
  const cat = [it(1, "a", { level: 1, unit_id: 1 }), it(2, "b", { level: 2, unit_id: 2 }), it(3, "c", { level: 2, unit_id: 2 })];
  const prog = new Map([[3, { mastery: 1, wrong_count: 2 }], [2, { mastery: 4, wrong_count: 2 }]]);
  eq(scopeItems(cat, { type: "level", level: 2 }).map((i) => i.id), [2, 3], "scope: theo cấp");
  eq(scopeItems(cat, { type: "unit", unitId: 1 }).map((i) => i.id), [1], "scope: theo chủ đề");
  eq(scopeItems(cat, { type: "weak" }, prog).map((i) => i.id), [3], "scope: từ hay sai = sai ≥ 1 lần và chưa thuộc (mastery < 3)");
  eq(weakCount(cat, prog), 1, "weakCount");
  eq(scopeItems(cat, { type: "all" }).length, 3, "scope: tất cả");
}

// ---- Xếp phiên ----
{
  const check = (kinds, n) => {
    for (let s = 1; s <= n; s++) {
      const t = planSession(kinds, 7, seeded(s)).reduce((a, e) => a + e.turns, 0);
      if (t < 5 || t > 9) return `${kinds.join()} seed ${s}: ${t} lượt`;
    }
    return true;
  };
  for (const s of SKILLS) ok(check(s.kinds, 30) === true, `planSession: kỹ năng ${s.id} có 5–9 lượt/phiên`, String(check(s.kinds, 30)));
  const p1 = planSession(["listen_pick", "listen_pick_text"], 7, seeded(3));
  eq(p1.reduce((a, e) => a + e.turns, 0), 7, "planSession: 2 trò chia đủ 7 lượt");
  eq(planSession(["memory_flip"], 7, seeded(1)).map((e) => e.kind), ["memory_flip", "memory_flip"], "planSession: 1 trò ghép cặp → 2 bảng");
  ok(planSession(["a", "b", "c", "d", "e"], 7, seeded(2)).length <= 3, "planSession: tối đa 3 trò khác nhau");
  ok(KIND_COST.match === 3 && KIND_COST.trace === 2, "KIND_COST");
}

// ---- Họ mục ----
{
  const cat = [it(1, "b", { item_type: "letter" }), it(2, "ba", { item_type: "syllable" }), it(3, "con bò", { item_type: "word" }), it(4, "Con chào bà.", { item_type: "sentence" })];
  eq(cat.map(familyOf), ["letters", "letters", "words", "sentences"], "familyOf");
  const skill = skillById("listen");
  const fam = chooseFamily(skill, cat, { age: 6 }, () => 0);
  ok(fam === null || fam.items.every((i) => familyOf(i) === fam.family), "chooseFamily: các mục cùng họ");
  const more = [...cat, it(5, "c", { item_type: "letter" }), it(6, "d", { item_type: "letter" })];
  const r = planPractice(skill, more, { type: "all" }, new Map(), { age: 6, rng: seeded(5) });
  ok(r.ok && new Set(r.plan.flatMap((e) => e.items.map((i) => familyOf(i)))).size === 1, "planPractice: 1 phiên chỉ dùng 1 họ mục (không lẫn chữ cái với câu)");
  eq(planPractice(skill, more, { type: "weak" }, new Map(), { age: 6 }), { ok: false, reason: "noWeak" }, "planPractice: không có từ hay sai");
  eq(planPractice(skillById("trace"), [], { type: "all" }, new Map(), { age: 6 }).ok, false, "planPractice: không có mục");
  eq(planPractice(skillById("trace"), more, { type: "all" }, new Map(), { age: 4 }).reason, "notEnough", "planPractice: bé 4 tuổi không chơi tô chữ");
}

// ---- Trên giáo trình thật (giao-trinh/csv) ----
{
  const dir = new URL("../giao-trinh/csv/", import.meta.url);
  const catalog = [];
  const unitId = new Map();
  let id = 1;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".csv"))) {
    const v = validateRows(parseCsv(readFileSync(new URL(f, dir), "utf8")), { langs: ["de", "en"] });
    const lvl = new Map();
    for (const r of v.items) {
      if (r.level) lvl.set(r.unit, r.level);
      if (!unitId.has(r.unit)) unitId.set(r.unit, unitId.size + 1);
      if (r.type === "question") continue;
      const uid = unitId.get(r.unit);
      catalog.push({ id: id++, text_vi: r.vi, say_vi: r.say, item_type: r.type, emoji: r.emoji, pic: r.pic === "decor" ? "decor" : null, unit_id: uid, level: lvl.get(r.unit) ?? 1,
        unit: { id: uid, title_vi: r.unit, emoji: r.unitEmoji }, translations: Object.entries(r.tr).map(([lang, meaning]) => ({ lang, meaning })) });
    }
  }
  ok(catalog.length > 700, `catalog từ CSV: ${catalog.length} mục`);
  for (const s of SKILLS) ok(skillPlayable(s, catalog, { age: 6, lang: "de" }), `giáo trình: kỹ năng ${s.name} chơi được (bé 6 tuổi, bản ngữ de)`);
  const young = SKILLS.filter((s) => skillPlayable(s, catalog, { age: 4, lang: "de" })).map((s) => s.id);
  console.log("     (bé 4 tuổi chơi được:", young.join(", "), ")");
  ok(["listen", "speak", "memory", "sort"].every((k) => young.includes(k)), "giáo trình: bé 4 tuổi chơi được ít nhất nghe, nói, trí nhớ, phân loại", young.join());
  // Mọi phiên dựng ra phải hợp lệ: trò nào cũng đủ mục theo đúng vị từ lọc, và tập mục của từng trò cùng họ
  let bad = null;
  for (const s of SKILLS) {
    for (let seed = 1; seed <= 25 && !bad; seed++) {
      for (const scope of [{ type: "all" }, { type: "level", level: 1 }, { type: "level", level: 3 }]) {
        const p = planPractice(s, catalog, scope, new Map(), { age: 6, lang: "de", rng: seeded(seed) });
        if (!p.ok) continue;
        for (const e of p.plan) {
          if (!feasible(e.kind, e.items, { lang: "de" })) bad = `${s.id}/${e.kind} seed ${seed}: tập mục không chơi được (${e.items.length} mục)`;
          if (new Set(e.items.map(familyOf)).size !== 1) bad = `${s.id}/${e.kind}: trộn họ mục`;
        }
      }
    }
  }
  ok(bad === null, "giáo trình: mọi phiên (12 kỹ năng × 25 lần chọn × 3 phạm vi) đều chơi được và cùng họ", String(bad));
  const sortSel = selectFor("sort_unit", catalog.filter((i) => familyOf(i) === "words"), { config: { rounds: 6 } }, new Map(), {}, seeded(2));
  ok(new Set(sortSel.map((i) => i.unit_id)).size >= 2, "selectFor(sort_unit): có ≥ 2 chủ đề");
  const toneSel = selectFor("tone_pair", catalog.filter((i) => familyOf(i) === "letters"), { config: { rounds: 4 } }, new Map(), {}, seeded(2));
  ok(toneGroups(toneSel).size >= 1, "selectFor(tone_pair): có nhóm ≥ 3 thanh");
}

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
