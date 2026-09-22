// Luyện tập theo kỹ năng: hàm thuần (vị từ lọc, kỹ năng, chọn phiên) + kiểm tra trên giáo trình thật. Chạy: node tests/practice.test.mjs
import { readFileSync, readdirSync } from "node:fs";
import { SKILLS, GROUPS, BADGES, skillOf, skillById, kindAllowed, KIND_COST, badgeOf, badgeProgress, trendOf, skillMap, suggestSkills } from "../public/js/child/skills.js";
import { POOLS, feasible, toneGroups, variants, meaningIn } from "../public/js/child/pools.js";
import { familyOf, weightOf, weightedSample, scopeItems, weakCount, chooseFamily, planSession, planPractice, selectFor, skillPlayable, skillsForAge, scopeStoryLessons, storySkillPlayable, planStoryPractice } from "../public/js/child/practice-core.js";
import { spellingChoices } from "../public/js/viet.js";
import { parseCsv, validateRows } from "../public/js/admin/csv.js";

let pass = 0, fail = 0;
const ok = (c, n, x = "") => { (c ? pass++ : fail++); console.log(`${c ? "ok  " : "FAIL"} ${n}${c ? "" : "  <-- " + x}`); };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const seeded = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---- Đăng ký kỹ năng ----
const runnersSrc = readFileSync(new URL("../public/js/child/runners.js", import.meta.url), "utf8");
const runnerKinds = [...runnersSrc.slice(runnersSrc.indexOf("export const RUNNERS")).matchAll(/^\s{2}(\w+): [\w.]+,$/gm)].map((m) => m[1]);
ok(runnerKinds.length === 26, "runners.js: 26 loại trò", String(runnerKinds.length));
const kindsInSkills = SKILLS.flatMap((s) => s.kinds);
ok(new Set(kindsInSkills).size === kindsInSkills.length, "mỗi trò thuộc đúng 1 kỹ năng");
ok(kindsInSkills.every((k) => runnerKinds.includes(k)), "mọi trò trong kỹ năng đều có runner", kindsInSkills.filter((k) => !runnerKinds.includes(k)).join());
ok(runnerKinds.every((k) => skillOf(k)), "mọi runner đều có kỹ năng (kể cả xếp câu để thống kê)", runnerKinds.filter((k) => !skillOf(k)).join());
// Kỹ năng "story" (Đọc nhớ/Nghe nhớ) lấy mục NGUYÊN theo bài (planStoryPractice), không qua POOLS như các trò khác.
const storyKindsInSkills = SKILLS.filter((s) => s.story).flatMap((s) => s.kinds);
ok(kindsInSkills.filter((k) => !storyKindsInSkills.includes(k)).every((k) => POOLS[k]), "mọi trò thường (không phải story) đều có vị từ lọc trong pools.js");
eq(SKILLS.length, 15, "15 kỹ năng (12 trò thường + 3 kỹ năng story: Đọc nhớ, Nghe nhớ, Giao tiếp)");
ok(SKILLS.every((s) => GROUPS.some((g) => g.id === s.group)), "mỗi kỹ năng thuộc 1 nhóm màu");
eq([skillOf("order_story"), skillOf("read_quiz"), skillOf("listen_quiz"), skillOf("listen_pick"), skillOf("nope")], ["story", "readMemory", "listenMemory", "listen", null], "skillOf");
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
  const u = (id, unit, lvl = 2) => it(id, "w" + id, { unit_id: unit, level: lvl, unit: { id: unit, title_vi: "U" + unit } });
  ok(feasible("sort_unit", [u(1, 1), u(2, 1), u(3, 2), u(4, 2)]) && !feasible("sort_unit", [u(1, 1), u(2, 1), u(3, 1), u(4, 1)]), "sort_unit: cần ≥ 2 chủ đề, mỗi chủ đề ≥ 2 mục");
  ok(!feasible("sort_unit", [u(1, 1, 1), u(2, 1, 1), u(3, 2, 1), u(4, 2, 1)]), "sort_unit: chỉ Cấp 2–3 (chữ cái/câu không phải 'loại')");
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
  const storyGroups = new Map(); // khoá `chủ đề|bài` -> {itemIds, questionIds, unitId, level} — mô phỏng api.loadStoryLessons() nhóm theo lesson_id
  const dialogueGroups = new Map(); // khoá `chủ đề|bài` -> {itemIds, questionIds:[], unitId, level} — mô phỏng api.loadDialogueLessons() (bài có activities=dialogue)
  let id = 1;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".csv"))) {
    const v = validateRows(parseCsv(readFileSync(new URL(f, dir), "utf8")), { langs: ["de", "en"] });
    const lvl = new Map();
    for (const r of v.items) {
      if (r.level) lvl.set(r.unit, r.level);
      if (!unitId.has(r.unit)) unitId.set(r.unit, unitId.size + 1);
      const uid = unitId.get(r.unit);
      const curId = id++;
      const groupKey = `${r.unit}|${r.lesson}`;
      if (!storyGroups.has(groupKey)) storyGroups.set(groupKey, { itemIds: [], questionIds: [], unitId: uid, level: lvl.get(r.unit) ?? 1 });
      if (r.type === "question") {
        storyGroups.get(groupKey).questionIds.push(curId);
        continue;
      }
      catalog.push({ id: curId, text_vi: r.vi, say_vi: r.say, item_type: r.type, emoji: r.emoji, pic: r.pic === "decor" ? "decor" : null, unit_id: uid, level: lvl.get(r.unit) ?? 1,
        unit: { id: uid, title_vi: r.unit, emoji: r.unitEmoji }, translations: Object.entries(r.tr).map(([lang, meaning]) => ({ lang, meaning })) });
      // Đoạn văn = MỌI mục còn lại của cùng bài (không riêng item_type 'story') — giống lesson.js/runQuiz thật.
      storyGroups.get(groupKey).itemIds.push(curId);
      if (r.kinds?.includes("dialogue")) {
        if (!dialogueGroups.has(groupKey)) dialogueGroups.set(groupKey, { itemIds: [], questionIds: [], unitId: uid, level: lvl.get(r.unit) ?? 1 });
        dialogueGroups.get(groupKey).itemIds.push(curId);
      }
    }
  }
  const storyLessons = [...storyGroups.values()].filter((g) => g.itemIds.length >= 3 && g.questionIds.length >= 1);
  const dialogueLessons = [...dialogueGroups.values()].filter((g) => g.itemIds.length >= 4);
  ok(catalog.length > 700, `catalog từ CSV: ${catalog.length} mục`);
  ok(storyLessons.length > 0, `giáo trình: ${storyLessons.length} bài dùng được cho Đọc nhớ/Nghe nhớ`);
  ok(dialogueLessons.length > 0, `giáo trình: ${dialogueLessons.length} bài giao tiếp dùng được cho Luyện tập`);
  const playableFor = (s, age) => {
    if (s.id === "converse") return storySkillPlayable(s, dialogueLessons, { age, lang: "de" });
    return s.story ? storySkillPlayable(s, storyLessons, { age, lang: "de" }) : skillPlayable(s, catalog, { age, lang: "de" });
  };
  for (const s of SKILLS) ok(playableFor(s, 6), `giáo trình: kỹ năng ${s.name} chơi được (bé 6 tuổi, bản ngữ de)`);
  const young = SKILLS.filter((s) => playableFor(s, 4)).map((s) => s.id);
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

  // planStoryPractice trên dữ liệu thật: lấy NGUYÊN 1 bài (không trộn mục của bài khác), items/questions khớp đúng 1 trong storyLessons.
  const readSkill = skillById("readMemory");
  const rp = planStoryPractice(readSkill, storyLessons, { type: "all" }, new Map(), { age: 6, rng: seeded(3) });
  ok(rp.ok && rp.plan.length === 1, "planStoryPractice: dựng được 1 phiên Đọc nhớ từ giáo trình thật");
  const chosen = storyLessons.find((g) => g.itemIds.length === rp.plan[0].items.length && g.questionIds.length === rp.plan[0].questions.length
    && g.itemIds.every((id) => rp.plan[0].items.some((i) => i.id === id)));
  ok(Boolean(chosen), "planStoryPractice: items/questions khớp NGUYÊN 1 bài trong storyLessons (không cắt/trộn)");
  ok(planStoryPractice(readSkill, storyLessons, { type: "all" }, new Map(), { age: 4 }).ok === false, "planStoryPractice: bé 4 tuổi không chơi Đọc nhớ (cần nhận mặt chữ)");
  const byLevel4 = scopeStoryLessons(storyLessons, { type: "level", level: 4 }, new Map());
  ok(byLevel4.every((g) => g.level === 4) && byLevel4.length > 0, "scopeStoryLessons: lọc theo cấp");

  // "Giao tiếp" (converse) trên dữ liệu thật (giao-trinh/csv/hoi-thoai-giao-tiep.csv, migration 019).
  const converseSkill = skillById("converse");
  ok(storySkillPlayable(converseSkill, [], { age: 6 }) === false, "storySkillPlayable(converse): danh sách rỗng → chưa chơi được");
  ok(storySkillPlayable(converseSkill, dialogueLessons, { age: 6 }), "storySkillPlayable(converse): giáo trình thật có bài giao tiếp → chơi được");
  const cp = planStoryPractice(converseSkill, dialogueLessons, { type: "all" }, new Map(), { age: 6, rng: seeded(1) });
  ok(cp.ok && cp.plan[0].kind === "dialogue" && cp.plan[0].items.length % 2 === 0 && cp.plan[0].items.length >= 4,
    "planStoryPractice(converse): dựng được 1 bài giao tiếp thật, đủ cặp hỏi-đáp");
  const chosenD = dialogueLessons.find((g) => g.itemIds.length === cp.plan[0].items.length && g.itemIds.every((id) => cp.plan[0].items.some((i) => i.id === id)));
  ok(Boolean(chosenD), "planStoryPractice(converse): lấy NGUYÊN thứ tự các dòng của 1 bài trong dialogueLessons (không cắt/trộn)");
  ok(planStoryPractice(converseSkill, dialogueLessons, { type: "all" }, new Map(), { age: 4 }).ok === false, "planStoryPractice(converse): bé 4 tuổi không chơi Giao tiếp (cần đọc chữ)");
}

// ---- Huy hiệu + xu hướng + gợi ý (giai đoạn 2) ----
{
  eq([badgeOf(0), badgeOf(2)], [null, null], "badgeOf: dưới 3 phiên tốt chưa có huy hiệu");
  eq([badgeOf(3).emoji, badgeOf(9).emoji, badgeOf(10).emoji, badgeOf(24).emoji, badgeOf(25).emoji, badgeOf(99).emoji], ["🥉", "🥉", "🥈", "🥈", "🥇", "🥇"], "badgeOf: 3 / 10 / 25 phiên");
  eq(badgeProgress(1), { cur: null, next: BADGES[0], remaining: 2 }, "badgeProgress: còn 2 phiên để được 🥉");
  eq(badgeProgress(10).remaining, 15, "badgeProgress: từ 🥈 còn 15 phiên để được 🥇");
  eq(badgeProgress(30).next, null, "badgeProgress: đã cao nhất");
  eq([trendOf(80, 70), trendOf(60, 70), trendOf(72, 70), trendOf(80, null), trendOf(null, 70)], ["up", "down", null, null, null], "trendOf: lệch từ 5 điểm; thiếu số liệu thì không kết luận");
  const rows = [
    { skill: "listen", activities_30: 10, avg_30: 90, good: 5, sessions: 6 },
    { skill: "spell", activities_30: 5, avg_30: 55, good: 0, sessions: 2 },
    { skill: "trace", activities_30: 3, avg_30: 40, good: 0, sessions: 1 },
    { skill: "read", activities_30: 2, avg_30: 30, good: 0, sessions: 1 },   // ít hơn 3 lượt → chưa đủ kết luận
    { skill: "story", activities_30: 9, avg_30: 20, good: 0, sessions: 0 },  // không thuộc 12 kỹ năng → bỏ
  ];
  eq(skillMap(rows).size, 4, "skillMap: bỏ dòng không thuộc 12 kỹ năng");
  eq(suggestSkills(rows).map((x) => [x.skill, x.reason]), [["trace", "low"], ["spell", "low"]], "suggestSkills: kỹ năng điểm thấp nhất trước, tối đa 2");
  eq(suggestSkills([{ skill: "listen", activities_30: 10, avg_30: 90 }], ["listen", "speak", "memory"]).map((x) => [x.skill, x.reason]), [["speak", "unused"], ["memory", "unused"]], "suggestSkills: điểm cao hết thì gợi ý kỹ năng chưa chơi");
  eq(suggestSkills([], ["listen"]).map((x) => x.skill), ["listen"], "suggestSkills: bé chưa chơi gì → gợi ý kỹ năng phù hợp tuổi");
  eq(suggestSkills(rows, ["listen"]), [], "suggestSkills: chỉ gợi ý kỹ năng phù hợp tuổi (đã chơi tốt thì không gợi ý)");
}

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
