// "Tiếng Việt Bài Bản" — hàm thuần: toán Leitner (srs.js) + chọn phiên ôn tập (practice-core.js) + CSV nhập hàng
// loạt (bb-csv.js). Chạy: node tests/bb.test.mjs
import { INTERVAL_DAYS, nextBox, dueAfter } from "../public/js/bb/srs.js";
import { isDue, dueCount, pickSession, sampleReview, pickLessonGroup } from "../public/js/bb/practice-core.js";
import { SKILLS } from "../public/js/bb/skills.js";
import { parseCsv, validateRows, buildPlan, buildTemplate, aiPrompt, STEP_TYPES, GAME_KINDS } from "../public/js/admin/bb-csv.js";
import { feasible as minigameFeasible } from "../public/js/bb/steps/minigame.js";
import { formatSegments } from "../public/js/bb/format.js";
import { summarizeBb } from "../public/js/bb/stats.js";
import { idOf, plainText, vocabItem, dialogueItem, grammarItems, phonicsItems, storyOf, buildPracticeData, srsAfter, progressMap, scopeBb, scopeReview, isWeakReview } from "../public/js/bb/adapter.js";
import { planPractice, weightOf } from "../public/js/child/practice-core.js";
import { SKILLS as CHILD_SKILLS } from "../public/js/child/skills.js";

let pass = 0, fail = 0;
const ok = (c, n, x = "") => { (c ? pass++ : fail++); console.log(`${c ? "ok  " : "FAIL"} ${n}${c ? "" : "  <-- " + x}`); };

// ---- srs.js: toán Leitner ----
ok(nextBox(1, true) === 2 && nextBox(3, true) === 4, "nextBox: nhớ thì tăng hộp");
ok(nextBox(5, true) === 5, "nextBox: hộp 5 là tối đa, không tăng thêm");
ok(nextBox(4, false) === 1 && nextBox(1, false) === 1, "nextBox: quên thì về hộp 1, bất kể hộp cũ");
ok(nextBox(undefined, true) === 2, "nextBox: box chưa có (mục mới) coi như hộp 1");

const from = new Date("2026-01-01T00:00:00.000Z");
ok(dueAfter(1, from).getTime() === from.getTime() + INTERVAL_DAYS[1] * 86_400_000, "dueAfter: hộp 1 → +1 ngày");
ok(dueAfter(5, from).getTime() === from.getTime() + INTERVAL_DAYS[5] * 86_400_000, "dueAfter: hộp 5 → +16 ngày");
ok(dueAfter(99, from).getTime() === from.getTime() + INTERVAL_DAYS[5] * 86_400_000, "dueAfter: hộp lạ rơi về khoảng xa nhất (an toàn)");
for (let b = 1; b <= 5; b++) ok(INTERVAL_DAYS[b] >= 0 && (b === 1 || INTERVAL_DAYS[b] > INTERVAL_DAYS[b - 1]), `INTERVAL_DAYS[${b}] tăng dần theo hộp`);

// ---- practice-core.js: đến hạn + chọn phiên ----
const now = new Date("2026-06-15T00:00:00.000Z");
const item = (id, daysFromNow) => ({ id, due_at: new Date(now.getTime() + daysFromNow * 86_400_000).toISOString() });
ok(isDue(item(1, -1), now) && isDue(item(2, 0), now) && !isDue(item(3, 1), now), "isDue: quá hạn/đúng hạn = due, chưa tới hạn = không");
ok(dueCount([item(1, -1), item(2, 5), item(3, -2)], now) === 2, "dueCount: đếm đúng số mục đến hạn");

{
  const items = [item("a", 5), item("b", -3), item("c", -1), item("d", 2), item("e", -10)];
  const session = pickSession(items, { limit: 3, now });
  ok(session.length === 3, "pickSession: giới hạn đúng limit");
  ok(session.every((i) => isDue(i, now)), "pickSession: ưu tiên mục đến hạn trước (limit vừa đủ số mục quá hạn)");
  ok(session[0].id === "e" && session[1].id === "b" && session[2].id === "c", "pickSession: trong số đến hạn, hạn xa nhất (lâu quá hạn nhất) lên đầu");
}
{
  // Không có mục nào đến hạn → vẫn trả về mục (chưa tới hạn), ưu tiên hạn gần nhất (ôn sớm nhất trong số chưa tới hạn).
  const items = [item("x", 10), item("y", 2), item("z", 5)];
  const session = pickSession(items, { limit: 8, now });
  ok(session.length === 3 && session[0].id === "y" && session[2].id === "x", "pickSession: không mục nào đến hạn thì vẫn trả đủ, sắp theo hạn gần nhất trước");
}
ok(pickSession([], { now }).length === 0, "pickSession: rỗng không lỗi");

// ---- skills.js ----
ok(SKILLS.length === 4, "4 kỹ năng (Từ vựng SRS + ôn Hội thoại/Ngữ pháp/Ngữ âm)", String(SKILLS.length));
ok(SKILLS.filter((s) => s.graded).length === 1 && SKILLS.find((s) => s.graded).id === "vocab", "chỉ 'vocab' có graded:true (box Leitner thật)");
ok(new Set(SKILLS.map((s) => s.itemType)).size === 4, "itemType không trùng nhau giữa các kỹ năng");
ok(SKILLS.every((s) => ["vocab", "grammar", "phonics", "dialogue"].includes(s.itemType)), "itemType khớp CHECK constraint bb_srs_state.item_type (migration 023)");

// ---- bb-csv.js: validateRows + buildPlan (nhập hàng loạt) ----
const HEAD = "level,unit,lesson,step_type,speaker,vi,vi2,pos,task_type,sentence,answer_text,words,min_words,sample,question,choices,answer,examples,de,game,say";
const q = (v) => (/[",;\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v); // trường có dấu phẩy (vd cột words) phải bọc trong ngoặc kép, đúng chuẩn CSV
const csv = (rows) => [HEAD, ...rows.map((r) => r.map(q).join(","))].join("\n");
const emptyExisting = { levels: [], units: [], lessons: [], steps: [] };

{
  const { errors } = validateRows(parseCsv("a,b\n1,2"), { langs: ["de"] });
  ok(errors.length > 0 && errors.some((e) => /level/.test(e.msg)), "validateRows: thiếu cột bắt buộc bị báo lỗi");
}
{
  const bad = csv([["a9", "Chào hỏi", "Bài 1", "dialogue", "A", "Xin chào", "", "", "", "", "", "", "", "", "", "", "", "", "Hallo"]]);
  const { errors } = validateRows(parseCsv(bad), { langs: ["de"] });
  ok(errors.some((e) => /level phải dạng CEFR/.test(e.msg)), "validateRows: level sai định dạng CEFR bị báo lỗi");
}
{
  const bad = csv([["A1", "Chào hỏi", "Bài 1", "hack", "A", "Xin chào", "", "", "", "", "", "", "", "", "", "", "", "", "Hallo"]]);
  const { errors } = validateRows(parseCsv(bad), { langs: ["de"] });
  ok(errors.some((e) => /step_type/.test(e.msg)), "validateRows: step_type lạ bị chặn", JSON.stringify(errors));
}
ok(STEP_TYPES.length === 8 && STEP_TYPES.includes("minigame") && STEP_TYPES.includes("listening"), "STEP_TYPES: 8 loại nhập được qua CSV (minigame chỉ ghi config.kind, không có bảng nội dung)");
ok(GAME_KINDS.length === 3 && GAME_KINDS.includes("meaning_pick") && GAME_KINDS.includes("phonics_discrim") && GAME_KINDS.includes("sentence_builder"), "GAME_KINDS khớp 3 engine đã cài");

{
  // 1 dòng hợp lệ mỗi loại chặng, đủ 7 loại (minigame kiểm riêng ở khối dưới) — kiểm hình dạng content parse đúng.
  // listening dùng lại ĐÚNG 2 dòng của reading (cùng hình dạng cột, chỉ đổi step_type — migration 026).
  const rows = [
    ["A1", "Chào hỏi", "Bài 1", "dialogue", "A", "Xin chào!", "", "", "", "", "", "", "", "", "", "", "", "", "Hallo!"],
    ["A1", "Chào hỏi", "Bài 1", "vocab", "", "xin chào", "", "thán từ", "", "", "", "", "", "", "", "", "", "", "Hallo"],
    ["A1", "Chào hỏi", "Bài 1", "grammar", "", "Chào + đại từ", "", "", "", "", "", "", "", "", "", "", "", "Chào bạn;Chào cô", "Gruß + Pronomen"],
    ["A1", "Chào hỏi", "Bài 1", "phonics", "", "ch", "tr", "", "", "", "", "", "", "", "", "", "", "cha - tra", ""],
    ["A1", "Chào hỏi", "Bài 1", "reading", "", "Tôi tên là An.", "", "", "", "", "", "", "", "", "", "", "", "", "Ich heiße An."],
    ["A1", "Chào hỏi", "Bài 1", "reading", "", "", "", "", "", "", "", "", "", "", "Tên là gì?", "An|Bình", "1", "", ""],
    ["A1", "Chào hỏi", "Bài 1", "listening", "", "Tôi tên là An.", "", "", "", "", "", "", "", "", "", "", "", "", "Ich heiße An."],
    ["A1", "Chào hỏi", "Bài 1", "listening", "", "", "", "", "", "", "", "", "", "", "Tên là gì?", "An|Bình", "1", "", ""],
    ["A1", "Chào hỏi", "Bài 1", "writing", "", "Điền từ", "", "", "fill", "Xin ___!", "chào", "", "", "", "", "", "", "", ""],
    ["A1", "Chào hỏi", "Bài 1", "writing", "", "Xếp câu", "", "", "order", "", "", "Tôi, là, An", "", "", "", "", "", "", ""],
    ["A1", "Chào hỏi", "Bài 1", "writing", "", "Viết tự do", "", "", "write", "", "", "", "5", "Tôi tên là An.", "", "", "", "", ""],
  ];
  const { items, errors, warnings } = validateRows(parseCsv(csv(rows)), { langs: ["de"] });
  ok(errors.length === 0, "11 dòng đủ 7 loại chặng: không lỗi", JSON.stringify(errors));
  ok(items.length === 11, "11 dòng đều được nhận (không dòng nào bị bỏ)", String(items.length));
  ok(items[0].content.kind === "dialogue" && items[0].content.speaker === "A" && items[0].content.tr.de === "Hallo!", "dialogue: parse đúng speaker + câu + bản dịch");
  ok(items[1].content.kind === "vocab" && items[1].content.pos === "thán từ", "vocab: parse đúng loại từ");
  ok(items[2].content.kind === "grammar" && items[2].content.examples.length === 2, "grammar: examples tách đúng theo dấu ;");
  ok(items[3].content.kind === "phonics" && items[3].content.a === "ch" && items[3].content.b === "tr", "phonics: parse đúng âm A/B");
  ok(items[4].content.kind === "passage" && items[4].content.vi === "Tôi tên là An.", "reading (đoạn văn): question để trống → kind=passage");
  ok(items[5].content.kind === "question" && items[5].content.choices.length === 2 && items[5].content.answer === 1, "reading (câu hỏi): question có giá trị → kind=question, choices tách đúng theo |");
  ok(items[6].content.kind === "passage" && items[6].content.vi === "Tôi tên là An.", "listening (đoạn văn): parse giống hệt reading, chỉ khác step_type");
  ok(items[7].content.kind === "question" && items[7].content.answer === 1, "listening (câu hỏi): parse giống hệt reading");
  ok(items[8].content.taskContent.sentence === "Xin ___!" && items[8].content.taskContent.answer === "chào", "writing fill: sentence+answer_text");
  ok(items[9].content.taskContent.words.length === 3, "writing order: words tách đúng theo dấu phẩy");
  ok(items[10].content.taskContent.min_words === 5 && items[10].content.taskContent.sample === "Tôi tên là An.", "writing write: min_words+sample");
  ok(warnings.length === 0, "11 dòng hợp lệ không có cảnh báo thừa cột", JSON.stringify(warnings));

  const plan = buildPlan(items, emptyExisting);
  ok(plan.newLevels.length === 1 && plan.newLevels[0].code === "A1", "buildPlan: CSDL trống → 1 cấp mới");
  ok(plan.newUnits.length === 1 && plan.newLessons.length === 1, "buildPlan: 1 chủ đề mới, 1 bài mới");
  ok(plan.newSteps.length === 7, "buildPlan: 7 chặng mới (đúng số step_type khác nhau)", String(plan.newSteps.length));
  ok(plan.groups.length === 7, "buildPlan: 7 nhóm nội dung (1 nhóm/chặng)");
  const readingGroup = plan.groups.find((g) => g.stepType === "reading");
  ok(readingGroup.rows.length === 2, "buildPlan: nhóm reading gộp đúng cả đoạn văn lẫn câu hỏi vào 1 chặng");
  const listeningGroup = plan.groups.find((g) => g.stepType === "listening");
  ok(listeningGroup.rows.length === 2, "buildPlan: nhóm listening gộp đúng cả đoạn văn lẫn câu hỏi vào 1 chặng");
  ok(plan.counts.rows === 11, "buildPlan: đếm đúng tổng số dòng");
}
{
  // Ô CSV (vi/examples chặng grammar) có xuống dòng thật bên trong (phải đặt trong ngoặc kép mới hợp lệ CSV) —
  // clean() thường sẽ gộp \n thành dấu cách, GIỮ NGUYÊN xuống dòng bằng getLines()/cleanLines() mới (lỗi chủ dự
  // án báo 2026-10-03: mở file text thấy đúng nhiều dòng nhưng nhập vào CSDL lại dính thành 1 dòng).
  const multilineVi = "Dòng 1\nDòng 2 **đậm**";
  const multilineExamples = "Ví dụ dòng 1\nVí dụ dòng 2 !!đỏ!!";
  const rows = [["A1", "Chào hỏi", "Bài 1", "grammar", "", multilineVi, "", "", "", "", "", "", "", "", "", "", "", multilineExamples, ""]];
  const { items, errors } = validateRows(parseCsv(csv(rows)), { langs: ["de"] });
  ok(errors.length === 0, "grammar nhiều dòng trong 1 ô: không lỗi", JSON.stringify(errors));
  ok(items[0].content.vi === multilineVi, "grammar: cột vi (công thức) GIỮ nguyên xuống dòng từ CSV", JSON.stringify(items[0]?.content?.vi));
  ok(items[0].content.examples.length === 1 && items[0].content.examples[0] === multilineExamples,
    "grammar: cột examples (không có ;) GIỮ nguyên xuống dòng, không bị gộp thành 1 dòng", JSON.stringify(items[0]?.content?.examples));
}
{
  // CSDL đã có sẵn cấp/chủ đề/bài/chặng trùng tên → không tạo mới, chỉ gộp vào nhóm nội dung của chặng đã có.
  const existing = {
    levels: [{ id: 1, code: "A1", name_vi: "Sơ cấp 1" }],
    units: [{ id: 10, level_id: 1, title_vi: "Chào hỏi" }],
    lessons: [{ id: 100, unit_id: 10, title_vi: "Bài 1" }],
    steps: [{ id: 1000, lesson_id: 100, step_type: "vocab" }],
  };
  const rows = [["A1", "CHÀO HỎI", "bài 1", "vocab", "", "tạm biệt", "", "", "", "", "", "", "", "", "", "", "", "", "Tschüss"]];
  const { items } = validateRows(parseCsv(csv(rows)), { langs: ["de"] });
  const plan = buildPlan(items, existing);
  ok(plan.newLevels.length === 0 && plan.newUnits.length === 0 && plan.newLessons.length === 0 && plan.newSteps.length === 0,
    "buildPlan: khớp tên có sẵn (không phân biệt hoa/thường) → không tạo mới tầng nào", JSON.stringify({ l: plan.newLevels.length, u: plan.newUnits.length, le: plan.newLessons.length, s: plan.newSteps.length }));
  ok(plan.groups.length === 1 && plan.groups[0].rows.length === 1, "buildPlan: nội dung vẫn gộp đúng vào chặng đã có");
}
{
  // minigame qua CSV: cột game bắt buộc + hợp lệ; buildPlan gắn config.kind vào chặng mới.
  const pad = (a) => [...a, ...Array(20 - a.length).fill("")]; // HEAD có 20 cột
  const good = pad(["A1", "Chào hỏi", "Bài 1", "minigame"]); good[19] = "sentence_builder";
  const bad = pad(["A1", "Chào hỏi", "Bài 1", "minigame"]); bad[19] = "flappy";
  const none = pad(["A1", "Chào hỏi", "Bài 1", "minigame"]);
  const r1 = validateRows(parseCsv(csv([good])), { langs: ["de"] });
  ok(r1.errors.length === 0 && r1.items[0].content.game === "sentence_builder", "minigame: dòng hợp lệ đọc đúng game", JSON.stringify(r1.errors));
  ok(validateRows(parseCsv(csv([bad])), { langs: ["de"] }).errors.length === 1, "minigame: game lạ bị từ chối");
  ok(validateRows(parseCsv(csv([none])), { langs: ["de"] }).errors.length === 1, "minigame: thiếu cột game bị từ chối");
  const p = buildPlan(r1.items, { levels: [], units: [], lessons: [], steps: [] });
  ok(p.newSteps.length === 1 && p.newSteps[0].config.kind === "sentence_builder", "buildPlan: chặng minigame mới mang config.kind");
}
{
  // Cấp "A0" (tiền-A1, chuyên đề bảng chữ cái/ngữ âm) được chấp nhận như mã CEFR chuẩn; cột "say" (chữ đọc, vd
  // "b" đọc "bờ") đọc đúng vào vocab, đi kèm cột "say" mới thêm ở cuối HEAD (cột 21).
  const row = ["A0", "Phụ âm", "Bài 1", "vocab", "", "b", "", "", "", "", "", "", "", "", "", "", "", "", "Konsonant b", "", "bờ"];
  const { items, errors } = validateRows(parseCsv(csv([row])), { langs: ["de"] });
  ok(errors.length === 0, "level: mã \"A0\" (tiền-A1) được chấp nhận", JSON.stringify(errors));
  ok(items[0]?.content?.say === "bờ", "vocab: cột say đọc đúng chữ đọc thành tiếng", JSON.stringify(items[0]));
  const bad = ["Z9", "Phụ âm", "Bài 1", "vocab", "", "b"];
  ok(validateRows(parseCsv(csv([bad])), { langs: ["de"] }).errors.length > 0, "level: mã lạ (không phải A0/CEFR) vẫn bị từ chối");
}
{
  // unit_<lang>/lesson_<lang> (tên chủ đề/bài dịch, migration 025) — chỉ cần điền ở 1 dòng bất kỳ của cùng
  // chủ đề/bài, buildPlan gộp lại đúng khi tạo MỚI (không áp dụng cho chủ đề/bài đã có trong CSDL).
  const head = HEAD + ",unit_de,lesson_de";
  const q2 = (v) => (/[",;\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const csv2 = (rows) => [head, ...rows.map((r) => r.map(q2).join(","))].join("\n");
  const pad2 = (a, extra) => [...a, ...Array(21 - a.length).fill(""), ...extra];
  const rows = [
    pad2(["A1", "Chào hỏi", "Bài 1", "dialogue", "A", "Xin chào!", "", "", "", "", "", "", "", "", "", "", "", "", "Hallo!"], ["Begrüßung", "Lektion 1"]),
    pad2(["A1", "Chào hỏi", "Bài 1", "vocab", "", "xin chào", "", "", "", "", "", "", "", "", "", "", "", "", "Hallo"], ["", ""]),
  ];
  const { items, errors, warnings } = validateRows(parseCsv(csv2(rows)), { langs: ["de"] });
  ok(errors.length === 0 && warnings.length === 0, "unit_de/lesson_de: cột hợp lệ, không lỗi/cảnh báo thừa", JSON.stringify({ errors, warnings }));
  ok(items[0].unitTr.de === "Begrüßung" && items[0].lessonTr.de === "Lektion 1", "validateRows: đọc đúng unit_de/lesson_de ở dòng có điền");
  ok(Object.keys(items[1].unitTr).length === 0, "validateRows: dòng để trống unit_de thì không có giá trị (không bịa)");

  const plan = buildPlan(items, emptyExisting);
  ok(plan.newUnits.length === 1 && plan.newUnits[0].title_tr.de === "Begrüßung", "buildPlan: chủ đề mới mang đúng title_tr từ dòng có điền");
  ok(plan.newLessons.length === 1 && plan.newLessons[0].title_tr.de === "Lektion 1", "buildPlan: bài mới mang đúng title_tr từ dòng có điền");
}
{
  // Chủ đề/bài ĐÃ CÓ trong CSDL: cột unit_de/lesson_de trong CSV lúc này không có tác dụng gì (không có cơ chế
  // cập nhật title_tr qua CSV cho tầng đã có — admin sửa qua ✎ Sửa) — buildPlan không tạo mới, không lỗi.
  const existing = {
    levels: [{ id: 1, code: "A1", name_vi: "Sơ cấp 1" }],
    units: [{ id: 10, level_id: 1, title_vi: "Chào hỏi" }],
    lessons: [{ id: 100, unit_id: 10, title_vi: "Bài 1" }],
    steps: [],
  };
  const head = HEAD + ",unit_de,lesson_de";
  const q2 = (v) => (/[",;\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const csv2 = (rows) => [head, ...rows.map((r) => r.map(q2).join(","))].join("\n");
  const pad2 = (a, extra) => [...a, ...Array(21 - a.length).fill(""), ...extra];
  const row = pad2(["A1", "Chào hỏi", "Bài 1", "vocab", "", "tạm biệt", "", "", "", "", "", "", "", "", "", "", "", "", "Tschüss"], ["Begrüßung (mới)", ""]);
  const { items } = validateRows(parseCsv(csv2([row])), { langs: ["de"] });
  const plan = buildPlan(items, existing);
  ok(plan.newUnits.length === 0 && plan.newLessons.length === 0, "buildPlan: chủ đề/bài đã có → unit_de trong CSV bị bỏ qua, không tạo trùng");
}
{
  // buildTemplate()/aiPrompt() (⬇ Tải file mẫu / 📋 Sao chép câu lệnh cho AI) phải khớp ĐÚNG cấu trúc dữ liệu hiện
  // có — tự kiểm bằng cách chạy ngược qua validateRows/buildPlan (0 lỗi, 0 cảnh báo) và phải phủ đủ cả 8 step_type.
  const tpl = buildTemplate(["de", "en"]);
  const v = validateRows(parseCsv(tpl), { langs: ["de", "en"] });
  ok(v.errors.length === 0, "buildTemplate: file mẫu không có lỗi", JSON.stringify(v.errors));
  ok(v.warnings.length === 0, "buildTemplate: file mẫu không có cột thừa/cảnh báo", JSON.stringify(v.warnings));
  const stepTypesInTemplate = new Set(v.items.map((it) => it.stepType));
  ok(STEP_TYPES.every((t) => stepTypesInTemplate.has(t)), "buildTemplate: phủ đủ cả 8 step_type", [...stepTypesInTemplate].join(","));
  const plan = buildPlan(v.items, { levels: [], units: [], lessons: [], steps: [] });
  ok(plan.newUnits[0]?.title_tr?.de && plan.newUnits[0]?.title_tr?.en, "buildTemplate: chủ đề mẫu mang đúng title_tr de+en");
  ok(plan.newLessons[0]?.title_tr?.de && plan.newLessons[0]?.title_tr?.en, "buildTemplate: bài mẫu mang đúng title_tr de+en");

  const prompt = aiPrompt(["de", "en"]);
  for (const col of ["level_name", "can_do", "unit_emoji", "lesson_type", "say", "task_type", "sentence", "answer_text", "words", "min_words", "sample", "question", "choices", "answer", "unit_de", "lesson_de", "unit_en", "lesson_en"]) {
    ok(prompt.includes(col), `aiPrompt: có nhắc cột "${col}"`, prompt.slice(0, 200));
  }
  for (const t of STEP_TYPES) ok(prompt.includes(t), `aiPrompt: có giải thích step_type "${t}"`);
}

// ---- minigame.feasible(): dùng ở bb/runner.js để ẩn/hiện chặng minigame trong lưới chọn chặng (2026-09-28) ----
{
  const vocabStep = (words) => ({ step_type: "vocab", content: words });
  const words4 = [1, 2, 3, 4].map((id) => ({ id, meaning: { de: "x" } }));
  ok(minigameFeasible({ config: { kind: "meaning_pick" } }, [vocabStep(words4)], "de") === true, "feasible: meaning_pick đủ 4 từ có nghĩa → chơi được");
  ok(minigameFeasible({ config: { kind: "meaning_pick" } }, [vocabStep(words4.slice(0, 3))], "de") === false, "feasible: meaning_pick chỉ 3 từ → chưa đủ");
  ok(minigameFeasible({ config: { kind: "meaning_pick" } }, [vocabStep(words4)], "en") === false, "feasible: meaning_pick đủ từ nhưng SAI ngôn ngữ (không có nghĩa en) → chưa đủ");
  ok(minigameFeasible({ config: {} }, [vocabStep(words4)], "de") === false, "feasible: chưa chọn engine (config.kind trống) → luôn false (ẩn khỏi lưới)");
  ok(minigameFeasible({ config: { kind: "hack" } }, [vocabStep(words4)], "de") === false, "feasible: engine lạ/chưa cài → luôn false");
  ok(minigameFeasible({ config: { kind: "phonics_discrim" } }, [], "de") === false, "feasible: phonics_discrim không có cặp âm nào → chưa đủ");
  ok(minigameFeasible({ config: { kind: "phonics_discrim" } }, [{ step_type: "phonics", content: [{ sound_a: "ch", sound_b: "tr" }] }], "de") === true, "feasible: phonics_discrim có 1 cặp âm → chơi được");
  ok(minigameFeasible({ config: { kind: "sentence_builder" } }, [{ step_type: "dialogue", content: [{ line_vi: "Xin chào bạn" }] }], "de") === true, "feasible: sentence_builder có câu ≥2 từ → chơi được");
  ok(minigameFeasible({ config: { kind: "sentence_builder" } }, [{ step_type: "dialogue", content: [{ line_vi: "Ừ" }] }], "de") === false, "feasible: sentence_builder câu chỉ 1 từ → chưa đủ để xếp lại");
  ok(minigameFeasible({ config: { kind: "sentence_builder" } }, [{ step_type: "grammar", content: [{ examples: [{ vi: "Chào bạn nhé" }] }] }], "de") === true, "feasible: sentence_builder lấy được câu ví dụ từ chặng ngữ pháp");
}

// ---- format.js: formatSegments() — markdown-lite **đậm**/*nghiêng*/!!đỏ!!/xuống dòng cho công thức + câu ví dụ
// chặng Ngữ pháp (2026-10-01, mở rộng từ boldSegments() chỉ có đậm) ----
{
  ok(JSON.stringify(formatSegments("Chào **bạn** nhé")) === JSON.stringify([[{ text: "Chào " }, { text: "bạn", bold: true }, { text: " nhé" }]]),
    "formatSegments: tách đúng phần đậm ở giữa câu");
  ok(JSON.stringify(formatSegments("Không có gì đậm")) === JSON.stringify([[{ text: "Không có gì đậm" }]]), "formatSegments: không có ký hiệu nào thì trả nguyên câu, 1 dòng");
  ok(JSON.stringify(formatSegments("**Cả câu đậm**")) === JSON.stringify([[{ text: "Cả câu đậm", bold: true }]]), "formatSegments: cả câu nằm trong ** thì chỉ 1 đoạn đậm, không có đoạn rỗng thừa");
  ok(JSON.stringify(formatSegments("**a** và **b**")) === JSON.stringify([[{ text: "a", bold: true }, { text: " và " }, { text: "b", bold: true }]]),
    "formatSegments: nhiều đoạn đậm trong cùng 1 câu");
  ok(JSON.stringify(formatSegments("Câu *nghiêng* nhé")) === JSON.stringify([[{ text: "Câu " }, { text: "nghiêng", italic: true }, { text: " nhé" }]]),
    "formatSegments: *chữ* tách đúng phần nghiêng");
  ok(JSON.stringify(formatSegments("Câu !!đỏ!! nhé")) === JSON.stringify([[{ text: "Câu " }, { text: "đỏ", red: true }, { text: " nhé" }]]),
    "formatSegments: !!chữ!! tách đúng phần đỏ");
  ok(JSON.stringify(formatSegments("Dòng 1\nDòng 2")) === JSON.stringify([[{ text: "Dòng 1" }], [{ text: "Dòng 2" }]]),
    "formatSegments: xuống dòng (\\n) tách thành nhiều DÒNG riêng, mỗi dòng tự phân đoạn");
  ok(JSON.stringify(formatSegments("")) === JSON.stringify([[]]), "formatSegments: chuỗi rỗng trả 1 dòng rỗng");
  ok(JSON.stringify(formatSegments(null)) === JSON.stringify([[]]), "formatSegments: null (thiếu dữ liệu) không lỗi, trả 1 dòng rỗng");
  // !!đỏ!! LỒNG trong **đậm**/*nghiêng* — lỗi chủ dự án báo 2026-10-02: trước đây !!...!! bên trong bị nuốt làm chữ
  // thường, hiện trần dấu !! ra màn hình thay vì tô đỏ.
  ok(JSON.stringify(formatSegments("**Táo !!giá!! bao nhiêu**")) === JSON.stringify([[{ text: "Táo ", bold: true }, { text: "giá", red: true }, { text: " bao nhiêu", bold: true }]]),
    "formatSegments: !!đỏ!! lồng trong **đậm** vẫn tách ra tô đỏ riêng, 2 đầu còn lại vẫn đậm");
  ok(JSON.stringify(formatSegments("*nghiêng !!đỏ!! vẫn nghiêng*")) === JSON.stringify([[{ text: "nghiêng ", italic: true }, { text: "đỏ", red: true }, { text: " vẫn nghiêng", italic: true }]]),
    "formatSegments: !!đỏ!! lồng trong *nghiêng* vẫn tách ra tô đỏ riêng");
  ok(JSON.stringify(formatSegments("Táo *rất* **ngon** nhưng !!đắt!! quá")) === JSON.stringify([[
    { text: "Táo " }, { text: "rất", italic: true }, { text: " " }, { text: "ngon", bold: true }, { text: " nhưng " }, { text: "đắt", red: true }, { text: " quá" },
  ]]), "formatSegments: đậm/nghiêng/đỏ đứng cạnh nhau (không lồng) trong cùng 1 câu vẫn tách đúng từng phần");
  // `khối nổi` (code/badge) — thêm 2026-10-02, kiểu thứ 4 cùng khuôn đệ quy với đậm/nghiêng/đỏ.
  ok(JSON.stringify(formatSegments("Công thức: `Hôm nay / Ngày mai` + là")) === JSON.stringify([[
    { text: "Công thức: " }, { text: "Hôm nay / Ngày mai", code: true }, { text: " + là" },
  ]]), "formatSegments: `chữ` tách đúng phần khối nổi (code)");
  ok(JSON.stringify(formatSegments("**Mẫu: `thứ mấy`**")) === JSON.stringify([[{ text: "Mẫu: ", bold: true }, { text: "thứ mấy", code: true }]]),
    "formatSegments: `code` lồng trong **đậm** vẫn tách ra riêng (code), không cộng dồn thêm đậm — giống !!đỏ!!");
}

// ---- adapter.js: nội dung Bài Bản → mục khu Trẻ em để dùng lại trò Luyện tập (2026-10-04) ----
{
  ok(idOf("vocab", 5) !== idOf("dialogue", 5) && idOf("grammar", 5, 1) !== idOf("grammar", 5, 2), "adapter.idOf: id ghép không trùng giữa các bảng/chỉ số con");
  ok(plainText("Hỏi: **Hôm nay** !!là thứ mấy!!?\n*(What day?)*") === "Hỏi: Hôm nay là thứ mấy? (What day?)", "adapter.plainText: bỏ ký hiệu markdown-lite + gộp xuống dòng");
  const where = { unit: { id: 7, title_vi: "Chào hỏi", emoji: null }, bbLevel: 3 };
  const v = vocabItem({ id: 1, word_vi: "chào", meaning: { de: "Hallo", en: "" }, audio_path: "bb/a.mp3" }, where);
  ok(v.item_type === "word" && v.translations.length === 1 && v.translations[0].lang === "de" && v.content_audio[0].file_path === "bb/a.mp3" && v.bbLevel === 3 && v.level === 2,
    "adapter.vocabItem: từ → mục word, bản dịch trống bị bỏ, âm thanh thành content_audio, level cổng lọc = 2", JSON.stringify(v));
  ok(vocabItem({ id: 2, word_vi: "b", say_vi: "bờ", meaning: {} }, where).item_type === "letter", "adapter.vocabItem: chữ cái có chữ đọc → letter");
  ok(vocabItem({ id: 3, word_vi: "xin chào", meaning: {} }, where).item_type === "phrase", "adapter.vocabItem: nhiều từ → phrase");
  ok(dialogueItem({ id: 4, speaker: "A", line_vi: "Chào **bạn**!", line_tr: { de: "Hallo!" } }, where).text_vi === "Chào bạn!", "adapter.dialogueItem: câu hội thoại thành chữ thường");
  const gi = grammarItems({ id: 9, examples: [{ vi: "Táo **giá** bao nhiêu?", tr: { de: "x" } }, { vi: "" }, { vi: "Câu hai." }] }, where);
  ok(gi.length === 2 && gi[0].text_vi === "Táo giá bao nhiêu?" && gi[0].src.type === "grammar" && gi[0].id !== gi[1].id, "adapter.grammarItems: mỗi ví dụ 1 mục câu, bỏ ví dụ rỗng, cùng src với điểm ngữ pháp");
  const pi = phonicsItems({ id: 6, sound_a: "ch", sound_b: "tr", audio_a_path: "a.mp3", examples: ["cha - tra", "chào - trào"] }, where);
  ok(pi.filter((i) => i.item_type === "syllable").length === 2 && pi.filter((i) => i.item_type === "word").length === 4 && pi[0].content_audio.length === 1, "adapter.phonicsItems: 2 âm + từng từ ví dụ tách riêng");
  const st = storyOf({ id: 2, passage_vi: "Tôi là An. Tôi học tiếng Việt.", audio_path: null }, [{ id: 8, question_vi: "Ai?", choices: ["An", "Bình"], answer: 1 }], where);
  ok(st.itemIds.length === 2 && st.questionIds.length === 1 && st.questions[0].extra.answer === 1, "adapter.storyOf: đoạn tách câu, câu hỏi giữ choices/answer (đếm từ 1)");
  ok(srsAfter({ box: 2, reviewed_count: 1, correct_count: 1 }, true).box === 3 && srsAfter({ box: 4, reviewed_count: 3, correct_count: 3 }, false).box === 1, "adapter.srsAfter: đúng tăng hộp, sai về hộp 1");
  const pm = progressMap([{ item_type: "vocab", item_id: 1, box: 2, reviewed_count: 4, correct_count: 1, updated_at: "2026-01-01" }], [v]);
  ok(pm.get(v.id).mastery === 2 && pm.get(v.id).wrong_count === 3, "adapter.progressMap: hộp = mức thuộc, ôn − đúng = số lần sai");

  const done = {
    steps: [{ id: 1, lesson_id: 1, step_type: "vocab" }, { id: 2, lesson_id: 1, step_type: "dialogue" }, { id: 3, lesson_id: 1, step_type: "reading" }],
    vocab: [1, 2, 3, 4].map((n) => ({ id: n, step_id: 1, word_vi: "từ" + n, meaning: { de: "w" + n } })),
    dialogue: [1, 2, 3, 4].map((n) => ({ id: n, step_id: 2, speaker: n % 2 ? "A" : "B", line_vi: "Câu " + n + ".", sort_order: n })),
    grammar: [], phonics: [], listening: [], srs: [{ item_type: "vocab", item_id: 1, box: 1, reviewed_count: 2, correct_count: 0 }],
    reading: [{ id: 5, step_id: 3, passage_vi: "Một. Hai. Ba." }],
  };
  const structure = { lessons: [{ id: 1, unit_id: 10 }], units: [{ id: 10, level_id: 20, title_vi: "Chủ đề", emoji: "🔤" }], levels: [{ id: 20, code: "A1", name_vi: "Sơ cấp 1" }],
    readingQuestions: [{ id: 1, passage_id: 5, question_vi: "Mấy?", choices: ["1", "2"], answer: 2, sort_order: 1 }], listeningQuestions: [] };
  const data = buildPracticeData(done, structure);
  ok(data.catalog.length === 8 && data.levels.length === 1 && data.levels[0].code === "A1", "adapter.buildPracticeData: 4 từ + 4 câu hội thoại vào catalog, cấp có nội dung được liệt kê");
  ok(data.storyLessons.length === 1 && data.listenLessons.length === 1 && data.dialogueLessons.length === 1, "adapter.buildPracticeData: đoạn đọc có câu hỏi + hội thoại ≥ 4 dòng thành 'bài'");
  ok(data.byId.has(data.storyLessons[0].questionIds[0]) && data.progress.get(data.catalog[0].id).wrong_count === 2, "adapter.buildPracticeData: byId có cả câu hỏi; tiến độ lấy từ bb_srs_state");
  ok(scopeBb(data.catalog, { type: "level", level: 20 }, data.progress).length === 8 && scopeBb(data.catalog, { type: "level", level: 99 }, data.progress).length === 0, "adapter.scopeBb: lọc theo cấp Bài Bản");
  ok(scopeBb(data.catalog, { type: "weak" }, data.progress).length === 1, "adapter.scopeBb: 'từ hay sai' chỉ lấy mục sai & chưa thuộc");

  // Chạy THẬT lõi kế hoạch của khu Trẻ em trên dữ liệu Bài Bản: kỹ năng "Hiểu nghĩa" (từ có bản dịch) phải lập được phiên.
  const meaning = CHILD_SKILLS.find((x) => x.id === "meaning");
  const plan = planPractice(meaning, data.catalog, { type: "all" }, data.progress, { lang: "de", target: 7 });
  ok(plan.ok && plan.plan[0].kind === "meaning_pick" && plan.plan[0].items.length >= 3, "Luyện tập mượn khu Trẻ em: planPractice() lập được phiên 'Hiểu nghĩa' từ dữ liệu Bài Bản", JSON.stringify(plan).slice(0, 120));
  ok(weightOf(data.progress.get(data.catalog[0].id)) > weightOf({ mastery: 5, wrong_count: 0, last_seen_at: new Date().toISOString() }), "Luyện tập mượn: mục sai nhiều có trọng số ôn cao hơn mục đã thuộc");
}

{
  const rows = [
    { id: 1, bbLevel: 1, unit_id: 10, box: 1, reviewed_count: 3, correct_count: 1 },
    { id: 2, bbLevel: 1, unit_id: 11, box: 4, reviewed_count: 3, correct_count: 3 },
    { id: 3, bbLevel: 2, unit_id: 20, box: 1, reviewed_count: 0, correct_count: 0 },
  ];
  ok(scopeReview(rows, { type: "all" }).length === 3, "Ôn tập: phạm vi tất cả");
  ok(scopeReview(rows, { type: "level", level: 1 }).length === 2, "Ôn tập: phạm vi theo cấp");
  ok(scopeReview(rows, { type: "unit", unitId: 20 }).map((r) => r.id).join() === "3", "Ôn tập: phạm vi theo chủ đề");
  ok(scopeReview(rows, { type: "weak" }).map((r) => r.id).join() === "1" && !isWeakReview(rows[1]) && !isWeakReview(rows[2]), "Ôn tập: hay sai = sai nhiều hơn đúng và chưa thuộc");
}

{
  const now = new Date("2026-10-05T10:00:00Z");
  const iso = (daysAgo) => new Date(now.getTime() - daysAgo * 86400000).toISOString();
  const st = summarizeBb({
    now, tz: "UTC", totalSteps: 10,
    progress: [{ step_id: 1, completed_at: iso(0) }, { step_id: 2, completed_at: iso(1) }, { step_id: 2, completed_at: iso(1) }, { step_id: 3, completed_at: iso(5) }],
    srs: [{ box: 4, due_at: iso(-3), reviewed_count: 3, correct_count: 3 }, { box: 1, due_at: iso(1), reviewed_count: 3, correct_count: 1 }],
    log: [{ skill: "meaning", kind: "meaning_pick", score: 80 }, { skill: "meaning", kind: "practice", score: 90, duration_seconds: 120, created_at: iso(0) }, { skill: "meaning", kind: "practice", score: 70, duration_seconds: 60, created_at: iso(2) }],
  });
  ok(st.stepsDone === 3 && st.totalSteps === 10, "Thống kê Bài Bản: đếm chặng xong theo step_id khác nhau");
  ok(st.learned === 1 && st.reviewing === 1 && st.dueNow === 1 && st.weak === 1, "Thống kê Bài Bản: thuộc/đang ôn/đến hạn/hay sai", JSON.stringify(st));
  ok(st.sessions === 2 && st.avgScore === 80 && st.minutes === 3, "Thống kê Bài Bản: chỉ tính dòng tổng kind='practice'");
  ok(st.skills.length === 1 && st.skills[0].sessions === 2 && st.skills[0].good === 1, "Thống kê Bài Bản: theo kỹ năng + số phiên tốt");
  ok(st.streak === 3 && st.series.length === 14 && st.series[13].count === 2, "Thống kê Bài Bản: chuỗi ngày + chuỗi 14 ngày", JSON.stringify([st.streak, st.series[13]]));
  ok(summarizeBb({}).streak === 0 && summarizeBb({}).avgScore === null, "Thống kê Bài Bản: chưa có dữ liệu không lỗi");
}

{
  const mk = (n) => Array.from({ length: n }, (_, k) => ({ id: k }));
  ok(sampleReview(mk(20)).length === 20, "sampleReview: ít (≤30) thì ôn hết");
  ok(sampleReview(mk(30)).length === 30, "sampleReview: đúng ngưỡng 30 vẫn ôn hết");
  const big = sampleReview(mk(100));
  ok(big.length === 50 && new Set(big.map((x) => x.id)).size === 50, "sampleReview: nhiều thì lấy 50% ngẫu nhiên, không trùng");
  ok(sampleReview(mk(31)).length === 16, "sampleReview: làm tròn lên (31 → 16)");
  const ordered = sampleReview(mk(100), { shuffle: false });
  ok(ordered.every((x, k) => k === 0 || ordered[k - 1].id < x.id), "sampleReview: shuffle=false giữ thứ tự gốc");
  ok(sampleReview([]).length === 0, "sampleReview: rỗng không lỗi");
  ok(sampleReview(mk(100), { ratio: 0.3 }).length === 30, "sampleReview: đổi tỉ lệ 30%");
}

{
  const rows = [{ id: 1, lesson_id: 10, lesson_title: "A" }, { id: 2, lesson_id: 11, lesson_title: "B" }, { id: 3, lesson_id: 10, lesson_title: "A" }, { id: 4, lesson_id: 12, lesson_title: "C" }];
  for (const r of [0, 0.4, 0.7, 0.99]) {
    const g = pickLessonGroup(rows, { rand: () => r });
    ok(new Set(g.items.map((x) => x.lesson_id)).size === 1 && g.items.every((x) => x.lesson_id === g.lessonId), `pickLessonGroup: chỉ 1 bài (rand=${r})`);
  }
  ok(pickLessonGroup(rows, { rand: () => 0 }).items.map((x) => x.id).join() === "1,3", "pickLessonGroup: giữ đủ + đúng thứ tự các mục của bài được chọn");
  ok(pickLessonGroup(rows, { rand: () => 0.4 }).lessonTitle === "B", "pickLessonGroup: trả tên bài");
  ok(pickLessonGroup([]).items.length === 0, "pickLessonGroup: rỗng không lỗi");
}

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
