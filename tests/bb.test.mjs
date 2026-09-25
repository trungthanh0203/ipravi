// "Tiếng Việt Bài Bản" — hàm thuần: toán Leitner (srs.js) + chọn phiên ôn tập (practice-core.js) + CSV nhập hàng
// loạt (bb-csv.js). Chạy: node tests/bb.test.mjs
import { INTERVAL_DAYS, nextBox, dueAfter } from "../public/js/bb/srs.js";
import { isDue, dueCount, pickSession } from "../public/js/bb/practice-core.js";
import { SKILLS } from "../public/js/bb/skills.js";
import { parseCsv, validateRows, buildPlan, STEP_TYPES } from "../public/js/admin/bb-csv.js";

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
const HEAD = "level,unit,lesson,step_type,speaker,vi,vi2,pos,task_type,sentence,answer_text,words,min_words,sample,question,choices,answer,examples,de";
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
ok(STEP_TYPES.length === 6 && !STEP_TYPES.includes("minigame"), "STEP_TYPES: 6 loại nhập được qua CSV (minigame không có nội dung CSV)");

{
  // 1 dòng hợp lệ mỗi loại chặng, đủ 6 loại — kiểm hình dạng content parse đúng.
  const rows = [
    ["A1", "Chào hỏi", "Bài 1", "dialogue", "A", "Xin chào!", "", "", "", "", "", "", "", "", "", "", "", "", "Hallo!"],
    ["A1", "Chào hỏi", "Bài 1", "vocab", "", "xin chào", "", "thán từ", "", "", "", "", "", "", "", "", "", "", "Hallo"],
    ["A1", "Chào hỏi", "Bài 1", "grammar", "", "Chào + đại từ", "", "", "", "", "", "", "", "", "", "", "", "Chào bạn;Chào cô", "Gruß + Pronomen"],
    ["A1", "Chào hỏi", "Bài 1", "phonics", "", "ch", "tr", "", "", "", "", "", "", "", "", "", "", "cha - tra", ""],
    ["A1", "Chào hỏi", "Bài 1", "reading", "", "Tôi tên là An.", "", "", "", "", "", "", "", "", "", "", "", "", "Ich heiße An."],
    ["A1", "Chào hỏi", "Bài 1", "reading", "", "", "", "", "", "", "", "", "", "", "Tên là gì?", "An|Bình", "1", "", ""],
    ["A1", "Chào hỏi", "Bài 1", "writing", "", "Điền từ", "", "", "fill", "Xin ___!", "chào", "", "", "", "", "", "", "", ""],
    ["A1", "Chào hỏi", "Bài 1", "writing", "", "Xếp câu", "", "", "order", "", "", "Tôi, là, An", "", "", "", "", "", "", ""],
    ["A1", "Chào hỏi", "Bài 1", "writing", "", "Viết tự do", "", "", "write", "", "", "", "5", "Tôi tên là An.", "", "", "", "", ""],
  ];
  const { items, errors, warnings } = validateRows(parseCsv(csv(rows)), { langs: ["de"] });
  ok(errors.length === 0, "9 dòng đủ 6 loại chặng: không lỗi", JSON.stringify(errors));
  ok(items.length === 9, "9 dòng đều được nhận (không dòng nào bị bỏ)", String(items.length));
  ok(items[0].content.kind === "dialogue" && items[0].content.speaker === "A" && items[0].content.tr.de === "Hallo!", "dialogue: parse đúng speaker + câu + bản dịch");
  ok(items[1].content.kind === "vocab" && items[1].content.pos === "thán từ", "vocab: parse đúng loại từ");
  ok(items[2].content.kind === "grammar" && items[2].content.examples.length === 2, "grammar: examples tách đúng theo dấu ;");
  ok(items[3].content.kind === "phonics" && items[3].content.a === "ch" && items[3].content.b === "tr", "phonics: parse đúng âm A/B");
  ok(items[4].content.kind === "passage" && items[4].content.vi === "Tôi tên là An.", "reading (đoạn văn): question để trống → kind=passage");
  ok(items[5].content.kind === "question" && items[5].content.choices.length === 2 && items[5].content.answer === 1, "reading (câu hỏi): question có giá trị → kind=question, choices tách đúng theo |");
  ok(items[6].content.taskContent.sentence === "Xin ___!" && items[6].content.taskContent.answer === "chào", "writing fill: sentence+answer_text");
  ok(items[7].content.taskContent.words.length === 3, "writing order: words tách đúng theo dấu phẩy");
  ok(items[8].content.taskContent.min_words === 5 && items[8].content.taskContent.sample === "Tôi tên là An.", "writing write: min_words+sample");
  ok(warnings.length === 0, "9 dòng hợp lệ không có cảnh báo thừa cột", JSON.stringify(warnings));

  const plan = buildPlan(items, emptyExisting);
  ok(plan.newLevels.length === 1 && plan.newLevels[0].code === "A1", "buildPlan: CSDL trống → 1 cấp mới");
  ok(plan.newUnits.length === 1 && plan.newLessons.length === 1, "buildPlan: 1 chủ đề mới, 1 bài mới");
  ok(plan.newSteps.length === 6, "buildPlan: 6 chặng mới (đúng số step_type khác nhau)", String(plan.newSteps.length));
  ok(plan.groups.length === 6, "buildPlan: 6 nhóm nội dung (1 nhóm/chặng)");
  const readingGroup = plan.groups.find((g) => g.stepType === "reading");
  ok(readingGroup.rows.length === 2, "buildPlan: nhóm reading gộp đúng cả đoạn văn lẫn câu hỏi vào 1 chặng");
  ok(plan.counts.rows === 9, "buildPlan: đếm đúng tổng số dòng");
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

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
