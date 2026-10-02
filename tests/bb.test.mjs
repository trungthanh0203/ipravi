// "Tiếng Việt Bài Bản" — hàm thuần: toán Leitner (srs.js) + chọn phiên ôn tập (practice-core.js) + CSV nhập hàng
// loạt (bb-csv.js). Chạy: node tests/bb.test.mjs
import { INTERVAL_DAYS, nextBox, dueAfter } from "../public/js/bb/srs.js";
import { isDue, dueCount, pickSession } from "../public/js/bb/practice-core.js";
import { SKILLS } from "../public/js/bb/skills.js";
import { parseCsv, validateRows, buildPlan, buildTemplate, aiPrompt, STEP_TYPES, GAME_KINDS } from "../public/js/admin/bb-csv.js";
import { feasible as minigameFeasible } from "../public/js/bb/steps/minigame.js";
import { formatSegments } from "../public/js/bb/format.js";

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

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
