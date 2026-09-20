// Kiểm thử phần lõi của công cụ admin: đọc/kiểm tra CSV và endpoint TTS của Worker. Chạy: node tests/admin.test.mjs
import { parseCsv, validateRows, classify, buildTemplate, keyOf, buildPlan, activitiesFor, ACTIVITY_DEFAULTS, STANDARD_ACTIVITIES } from "../public/js/admin/csv.js";
import worker from "../worker.js";

let fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.log("FAIL", m, "\n  được:", JSON.stringify(a), "\n  cần:  ", JSON.stringify(b)); fail = 1; } else console.log("ok  ", m); };
const langs = ["de", "en"];

// ---- parseCsv ----
eq(parseCsv("a,b\n1,2\n").rows, [["1", "2"]], "parse: cơ bản");
eq(parseCsv("﻿a;b\r\n1;2\r\n3;4").rows, [["1", "2"], ["3", "4"]], "parse: BOM + chấm phẩy (Excel) + CRLF, không xuống dòng cuối");
eq(parseCsv("a\tb\n1\t2").delimiter, "\t", "parse: nhận dạng Tab");
eq(parseCsv('a,b\n"x, y","có ""ngoặc"""\n').rows, [["x, y", 'có "ngoặc"']], "parse: ô có dấu phẩy + ngoặc kép");
eq(parseCsv('a,b\n"dòng 1\ndòng 2",z\n').rows, [["dòng 1\ndòng 2", "z"]], "parse: ô nhiều dòng");
eq(parseCsv("a,b").rows, [], "parse: chỉ có tiêu đề");
eq(parseCsv("").headers, [], "parse: rỗng");
eq(parseCsv('a;b\n"1;2";3').rows, [["1;2", "3"]], "parse: dấu ; trong ngoặc kép không tách");

// ---- validateRows ----
const H = "unit,unit_emoji,lesson,vi,emoji,type,min_age,max_age,de,en";
const run = (body, l = langs) => validateRows(parseCsv(`${H}\n${body}`), { langs: l });
let v = run("Con vật,🐾,Vật nuôi,con chó,🐶,word,3,8,Hund,dog\nCon vật,🐾,Vật nuôi,con mèo,🐱,,,,Katze,cat");
eq([v.errors.length, v.warnings.length, v.items.length], [0, 0, 2], "hợp lệ: 2 mục, không lỗi/cảnh báo");
eq(v.items[0], { row: 2, unit: "Con vật", unitEmoji: "🐾", level: null, lesson: "Vật nuôi", vi: "con chó", say: "", kinds: [], choices: [], answer: null, emoji: "🐶", type: "word", minAge: 3, maxAge: 8, tr: { de: "Hund", en: "dog" } }, "hợp lệ: nội dung dòng 1");

// Học vần: kiểu letter/syllable, cột say, cột activities
{
  const H3 = "unit,level,lesson,vi,say,activities,emoji,type,de,en";
  const run3 = (body) => validateRows(parseCsv(H3 + "\n" + body), { langs });
  const r = run3("Chữ cái,3,Nhóm 1,b,bờ,listen_pick_text listen_repeat,🐄,letter,Buchstabe b,letter b\nChữ cái,3,Nhóm 1,ba,,,👨,syllable,Silbe ba,syllable ba");
  eq([r.errors.length, r.items[0].say, r.items[0].kinds, r.items[0].type, r.items[1].kinds, r.items[1].say], [0, "bờ", ["listen_pick_text", "listen_repeat"], "letter", [], ""], "học vần: đọc letter, say, activities");
  eq(run3("U,3,L,b,,hack,🐄,letter,x,y").errors.length, 1, "học vần: activities lạ bị từ chối");
  eq(run3("U,3,L,b,,,🐄,letter,x,y").errors.length, 0, "học vần: say/activities để trống hợp lệ");
  eq(run3(`U,3,L,b,${"x".repeat(201)},,🐄,letter,x,y`).errors.length, 1, "học vần: say quá dài bị từ chối");
  eq(Object.keys(ACTIVITY_DEFAULTS).length, 18, "học vần + đọc hiểu + đánh vần + chữ hoa: 18 loại hoạt động có cấu hình mặc định");
  eq(activitiesFor([]).map((a) => a[0]), STANDARD_ACTIVITIES, "học vần: bài không ghi activities → 4 hoạt động chuẩn");
  eq(activitiesFor(["listen_pick_tone", "read_pick"]), [["listen_pick_tone", { rounds: 5, choices: 3 }], ["read_pick", { rounds: 4, choices: 3 }]], "học vần: bộ hoạt động theo CSV kèm cấu hình");
  const ex = { units: [], lessons: [], items: [] };
  const mk = (kinds) => ({ row: 2, unit: "U", unitEmoji: "", level: 3, lesson: "L", vi: "x", say: "", kinds, emoji: "", type: "letter", minAge: null, maxAge: null, tr: {} });
  eq(buildPlan([mk([]), mk(["read_pick"])], ex).newLessons, [{ unit: "U", title: "L", kinds: ["read_pick"] }], "học vần: bài mới lấy activities từ dòng có ghi");
  eq(classify({ ...mk([]), say: "bờ", type: "letter" }, { item_type: "letter", say_vi: "bơ", tr: {} }).changed, ["say"], "học vần: đổi say → cập nhật");
  eq(classify({ ...mk([]), say: "", type: "letter" }, { item_type: "letter", say_vi: "bơ", tr: {} }).status, "same", "học vần: say trống không xoá say cũ");
}

// Đọc hiểu: type question + choices + answer
{
  const HQ = "unit,level,lesson,vi,activities,choices,answer,type,de,en";
  const runQ = (body) => validateRows(parseCsv(HQ + "\n" + body), { langs });
  const good = runQ('Đoạn,4,Bài 1,Nhà Nam có mấy người?,read_quiz,bốn người|ba người|năm người,1,question,Wie viele?,How many?');
  eq([good.errors.length, good.items[0].choices, good.items[0].answer], [0, ["bốn người", "ba người", "năm người"], 1], "câu hỏi: đọc choices + answer");
  for (const [name, row] of [
    ["thiếu đáp án", "Đ,4,B,Hỏi?,,,,question,x,y"],
    ["chỉ 1 đáp án", "Đ,4,B,Hỏi?,,a,1,question,x,y"],
    ["5 đáp án", "Đ,4,B,Hỏi?,,a|b|c|d|e,1,question,x,y"],
    ["answer vượt số đáp án", "Đ,4,B,Hỏi?,,a|b,3,question,x,y"],
    ["answer = 0", "Đ,4,B,Hỏi?,,a|b,0,question,x,y"],
    ["thiếu answer", "Đ,4,B,Hỏi?,,a|b,,question,x,y"],
    ["đáp án trùng nhau", "Đ,4,B,Hỏi?,,a|A,1,question,x,y"],
    ["choices ở mục không phải câu hỏi", "Đ,4,B,Câu.,,a|b,1,sentence,x,y"],
  ]) eq(Math.min(runQ(row).errors.length, 1), 1, "câu hỏi: " + name + " bị từ chối");
  const it = good.items[0];
  eq(classify(it, { item_type: "question", extra: { choices: ["bốn người", "ba người", "năm người"], answer: 1 }, tr: { de: "Wie viele?", en: "How many?" } }).status, "same", "câu hỏi: không đổi → same");
  eq(classify(it, { item_type: "question", extra: { choices: ["bốn người", "ba người", "năm người"], answer: 2 }, tr: {} }).changed.includes("extra"), true, "câu hỏi: đổi đáp án đúng → cập nhật extra");
}

// Cột level (cấp 1–4)
{
  const H2 = "unit,unit_emoji,level,lesson,vi,emoji,type,min_age,max_age,de,en";
  const run2 = (body) => validateRows(parseCsv(`${H2}
${body}`), { langs });
  const ok2 = run2("Con vật,🐾,2,Vật nuôi,con chó,🐶,word,3,8,Hund,dog");
  eq([ok2.errors.length, ok2.items[0].level], [0, 2], "level: đọc được cấp 2");
  eq(run2("Con vật,🐾,,Vật nuôi,con chó,🐶,word,3,8,Hund,dog").items[0].level, null, "level: ô trống = null");
  for (const bad of ["0", "5", "abc", "1.5"]) eq(run2(`Con vật,🐾,${bad},Vật nuôi,con chó,🐶,word,3,8,Hund,dog`).errors.length, 1, `level: "${bad}" bị từ chối`);
  const mk = (level) => ({ row: 2, unit: "Mới", unitEmoji: "🆕", level, lesson: "B", vi: "x", emoji: "", type: "word", minAge: null, maxAge: null, tr: {} });
  const ex = { units: [{ id: 1, title_vi: "Cũ", sort_order: 1, level: 1 }], lessons: [], items: [] };
  eq(buildPlan([mk(3)], ex).newUnits[0].level, 3, "buildPlan: chủ đề mới mang cấp từ CSV");
  eq("level" in buildPlan([mk(null)], ex).newUnits[0], false, "buildPlan: CSV không ghi cấp → không đặt (CSDL mặc định cấp 1)");
  eq(buildPlan([mk(null), mk(2)], ex).newUnits[0].level, 2, "buildPlan: dòng sau ghi cấp thì bổ sung cho chủ đề mới");
  const old = (level) => ({ ...mk(level), unit: "cũ" });
  eq(buildPlan([old(2), old(2)], ex).levelChanges, [{ id: 1, title: "Cũ", level: 2 }], "buildPlan: chủ đề đã có đổi cấp → 1 thay đổi (không lặp)");
  eq(buildPlan([old(1)], ex).levelChanges, [], "buildPlan: cùng cấp → không đổi");
  eq(buildPlan([old(null)], ex).levelChanges, [], "buildPlan: CSV không ghi cấp → không đụng cấp cũ");
}
eq([v.items[1].type, v.items[1].minAge], ["word", null], "type mặc định = word, tuổi trống = null");

v = run(",,,,,,,,,");
eq(v.items.length + v.errors.length, 1, "dòng trống toàn bộ: bỏ qua (chỉ còn lỗi 'không có dữ liệu')");
v = run("Con vật,,Vật nuôi,,🐶,,,,Hund,dog");
eq(v.errors.map((e) => e.msg), ["thiếu từ tiếng Việt (vi)"], "lỗi: thiếu vi");
v = run("Con vật,,Vật nuôi,con chó,🐶,animal,3,8,Hund,dog");
eq(v.errors[0].msg.startsWith('type "animal" không hợp lệ'), true, "lỗi: type sai");
v = run("Con vật,,Vật nuôi,con chó,🐶,word,9,3,Hund,dog");
eq(v.errors.map((e) => e.msg), ["min_age lớn hơn max_age"], "lỗi: min_age > max_age");
v = run("Con vật,,Vật nuôi,con chó,🐶,word,abc,,Hund,dog");
eq(v.errors[0].msg, "min_age phải là số nguyên 0–12", "lỗi: tuổi không phải số");
v = run("Con vật,,Vật nuôi,con chó,🐶,,,,Hund,dog\nCON  VẬT,,vật nuôi,Con  Chó,🐶,,,,Hund,dog");
eq(v.errors.map((e) => `${e.row}:${e.msg.slice(0, 20)}`), ["3:Trùng với dòng 2 (cù"], "lỗi: trùng (không phân biệt hoa/thường, khoảng trắng)");
v = run("Con vật,,Vật nuôi,con chó,,,,,Hund,");
eq(v.warnings.map((w) => w.msg), ['"con chó": chưa có emoji (sẽ hiện dấu ❓ cho trẻ)', '"con chó": thiếu nghĩa "en"'], "cảnh báo: thiếu emoji + thiếu nghĩa en");
eq(v.errors.length, 0, "cảnh báo không chặn nhập");
v = validateRows(parseCsv("unit,lesson\nA,B"), { langs });
eq(v.errors[0].msg, 'Thiếu cột bắt buộc "vi"', "lỗi: thiếu cột bắt buộc");
v = validateRows(parseCsv("unit,lesson,vi,foo\nA,B,c,x"), { langs: [] });
eq(v.warnings.map((w) => w.msg), ['Cột "foo" không được dùng (bỏ qua)', '"c": chưa có emoji (sẽ hiện dấu ❓ cho trẻ)'], "cảnh báo: cột lạ bị bỏ qua");
v = run("Con vật,,Vật nuôi,con gà,🐔,,,,Huhn,chicken\n" + "x".repeat(0));
eq(v.items[0].tr, { de: "Huhn", en: "chicken" }, "nghĩa theo ngôn ngữ");
v = validateRows(parseCsv("unit,lesson,vi,emoji\nÐ,B,con gà,🐔".normalize("NFD")), { langs: [] });
eq(v.items[0]?.vi, "con gà", "chuẩn hoá Unicode NFC (dấu tiếng Việt tổ hợp sẵn)");

// ---- classify ----
const item = { emoji: "🐶", type: "word", minAge: null, maxAge: null, tr: { de: "Hund", en: "dog" } };
eq(classify(item, undefined), { status: "new", changed: [] }, "classify: mới");
eq(classify(item, { emoji: "🐶", item_type: "word", tr: { de: "Hund", en: "dog" } }).status, "same", "classify: giống hệt");
eq(classify({ ...item, emoji: "" }, { emoji: "🐕", item_type: "word", tr: { de: "Hund", en: "dog" } }).status, "same", "classify: ô emoji trống không ghi đè");
eq(classify({ ...item, tr: { de: "Hunde" } }, { emoji: "🐶", item_type: "word", tr: { de: "Hund" } }), { status: "update", changed: ["tr:de"] }, "classify: đổi nghĩa");
eq(classify(item, { emoji: "🐕", item_type: "word", tr: {} }).changed, ["emoji", "tr:de", "tr:en"], "classify: nhiều thay đổi");
eq(keyOf("  Con   CHÓ "), "con chó", "keyOf");

// ---- mẫu tải về phải tự hợp lệ ----
const t = validateRows(parseCsv(buildTemplate(langs)), { langs });
eq([t.errors.length, t.warnings.length, t.items.length], [0, 0, 3], "file mẫu tải về tự nhập được (0 lỗi, 0 cảnh báo)");

// ---- buildPlan ----
{
  const csv = [
    "unit,unit_emoji,lesson,vi,emoji,de",
    "Con vật,🐾,Vật nuôi,con chó,🐶,Hund",      // đã có, giống hệt
    "con vật,,vật nuôi,con mèo,🐱,Katzen",     // đã có, đổi nghĩa (khác hoa/thường ở tên chủ đề/bài vẫn khớp)
    "Con vật,🐾,Vật nuôi,con gà,🐔,Huhn",      // mục mới trong bài đã có
    "Con vật,🐾,Sở thú,con voi,🐘,Elefant",    // bài mới trong chủ đề đã có
    "Màu sắc,🎨,Màu cơ bản,màu đỏ,🔴,rot",     // chủ đề + bài mới
    "Màu sắc,,Màu cơ bản,màu xanh,🔵,blau",
  ].join(String.fromCharCode(10));
  const { items } = validateRows(parseCsv(csv), { langs: ["de"] });
  const ex = {
    units: [{ id: 1, title_vi: "Con vật", sort_order: 1 }],
    lessons: [{ id: 10, unit_id: 1, title_vi: "Vật nuôi", sort_order: 1 }],
    items: [
      { id: 100, lesson_id: 10, text_vi: "con chó", emoji: "🐶", item_type: "word", tr: { de: "Hund" } },
      { id: 101, lesson_id: 10, text_vi: "con mèo", emoji: "🐱", item_type: "word", tr: { de: "Katze" } },
    ],
  };
  const p = buildPlan(items, ex);
  eq(p.counts, { new: 4, update: 1, same: 1 }, "buildPlan: đếm mới/cập nhật/không đổi");
  eq(p.newUnits, [{ title: "Màu sắc", emoji: "🎨" }], "buildPlan: chủ đề mới (lấy unit_emoji)");
  eq(p.newLessons, [{ unit: "Con vật", title: "Sở thú", kinds: [] }, { unit: "Màu sắc", title: "Màu cơ bản", kinds: [] }], "buildPlan: bài mới, không lặp");
  eq(p.rows.map((r) => r.status), ["same", "update", "new", "new", "new", "new"], "buildPlan: trạng thái từng dòng");
  eq(p.rows[1].changed, ["tr:de"], "buildPlan: dòng cập nhật chỉ đổi nghĩa");
  eq(buildPlan(items, { units: [], lessons: [], items: [] }).counts, { new: 6, update: 0, same: 0 }, "buildPlan: CSDL trống -> tất cả mới");
  eq(buildPlan(items, { units: [], lessons: [], items: [] }).newUnits.map((u) => u.emoji), ["🐾", "🎨"], "buildPlan: emoji chủ đề mặc định lấy dòng đầu");
}

// ---- Worker /api/tts ----
const realFetch = globalThis.fetch;
const calls = [];
let adminAnswer = true;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes("/rpc/is_admin")) return new Response(JSON.stringify(adminAnswer), { status: 200 });
  if (String(url).includes("tts.speech.microsoft.com")) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  if (String(url).includes("texttospeech.googleapis.com")) return new Response(JSON.stringify({ audioContent: btoa("abc") }), { status: 200 });
  return new Response("?", { status: 500 });
};
const env = (o = {}) => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", ASSETS: { fetch: async () => new Response("a") }, ...o });
const post = (body, headers = { authorization: "Bearer tok" }) =>
  new Request("https://a.dev/api/tts", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

let r = await worker.fetch(post({ text: "con gà", lang: "vi" }, {}), env({ TTS_PROVIDER: "azure", TTS_KEY: "k", TTS_REGION: "westeurope" }));
eq(r.status, 403, "tts: không có token -> 403");
adminAnswer = false;
r = await worker.fetch(post({ text: "con gà", lang: "vi" }), env({ TTS_PROVIDER: "azure", TTS_KEY: "k", TTS_REGION: "westeurope" }));
eq(r.status, 403, "tts: không phải admin -> 403");
adminAnswer = true;
r = await worker.fetch(post({ text: "con gà", lang: "vi" }), env());
eq(r.status, 501, "tts: chưa cấu hình -> 501");
eq((await r.json()).error.includes("TTS_PROVIDER"), true, "tts: thông báo nói rõ thiếu gì");
r = await worker.fetch(new Request("https://a.dev/api/tts"), env());
eq(r.status, 405, "tts: GET -> 405");
const azure = env({ TTS_PROVIDER: "azure", TTS_KEY: "k", TTS_REGION: "westeurope" });
r = await worker.fetch(post({ text: "", lang: "vi" }), azure);
eq(r.status, 400, "tts: văn bản trống -> 400");
r = await worker.fetch(post({ text: "x".repeat(301), lang: "vi" }), azure);
eq(r.status, 400, "tts: quá 300 ký tự -> 400");
r = await worker.fetch(post({ text: "hola", lang: "xx" }), azure);
eq(r.status, 400, "tts: ngôn ngữ chưa có giọng -> 400");

calls.length = 0;
r = await worker.fetch(post({ text: "con <gà> & vịt", lang: "vi", speed: "slow" }), azure);
eq([r.status, r.headers.get("content-type"), r.headers.get("x-tts-voice")], [200, "audio/mpeg", "vi-VN-HoaiMyNeural"], "azure: trả mp3 + tên giọng");
eq([...new Uint8Array(await r.arrayBuffer())], [1, 2, 3], "azure: byte âm thanh nguyên vẹn");
const az = calls.find((c) => c.url.includes("microsoft"));
eq(az.url, "https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1", "azure: đúng URL theo vùng");
eq(az.init.headers["Ocp-Apim-Subscription-Key"], "k", "azure: gửi khoá qua header");
eq(az.init.body.includes('xml:lang="vi-VN"') && az.init.body.includes('rate="-30%"') && az.init.body.includes("con &lt;gà&gt; &amp; vịt"), true, "azure: SSML đúng locale, nghe chậm -30%, escape XML");
eq(calls.find((c) => c.url.includes("/rpc/is_admin")).init.headers.authorization, "Bearer tok", "kiểm admin bằng chính token của người gọi");

r = await worker.fetch(post({ text: "Hund", lang: "de", gender: "male" }), env({ TTS_PROVIDER: "google", TTS_KEY: "gk", TTS_VOICES: '{"de":"de-DE-Wavenet-B"}' }));
eq([r.status, r.headers.get("x-tts-voice")], [200, "de-DE-Wavenet-B"], "google: TTS_VOICES ghi đè giọng");
eq(new TextDecoder().decode(await r.arrayBuffer()), "abc", "google: giải mã base64");
const g = calls.find((c) => c.url.includes("googleapis"));
const gb = JSON.parse(g.init.body);
eq([gb.voice.languageCode, gb.audioConfig.speakingRate, g.url.includes("key=gk")], ["de-DE", 1, true], "google: locale suy từ tên giọng, tốc độ thường");

globalThis.fetch = async (url) => (String(url).includes("/rpc/is_admin") ? new Response("true") : new Response("quota exceeded", { status: 429 }));
r = await worker.fetch(post({ text: "con gà", lang: "vi" }), azure);
eq([r.status, (await r.json()).error.startsWith("Azure TTS 429")], [502, true], "tts: lỗi nhà cung cấp -> 502 kèm lý do");
r = await worker.fetch(post({ text: "con gà", lang: "vi" }), env({ TTS_PROVIDER: "azure", TTS_KEY: "k", TTS_VOICES: "{oops" }));
eq(r.status, 500, "tts: TTS_VOICES hỏng -> 500");
// ---- giọng do admin chọn (body.voice) ----
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes("/rpc/is_admin")) return new Response("true");
  return new Response(new Uint8Array([9]), { status: 200 });
};
calls.length = 0;
r = await worker.fetch(post({ text: "con gà", lang: "vi", voice: "vi-VN-NamMinhNeural" }), env({ TTS_PROVIDER: "azure", TTS_KEY: "k", TTS_REGION: "westeurope", TTS_VOICES: JSON.stringify({ vi: "vi-VN-HoaiMyNeural" }) }));
eq([r.status, r.headers.get("x-tts-voice")], [200, "vi-VN-NamMinhNeural"], "voice: giọng admin chọn ưu tiên hơn TTS_VOICES");
eq(calls.find((c) => c.url.includes("microsoft")).init.body.includes("<voice name=\"vi-VN-NamMinhNeural\">"), true, "voice: SSML dùng đúng giọng đã chọn");
r = await worker.fetch(post({ text: "con gà", lang: "vi" }), env({ TTS_PROVIDER: "azure", TTS_KEY: "k", TTS_REGION: "westeurope", TTS_VOICES: JSON.stringify({ vi: "vi-VN-HoaiMyNeural" }) }));
eq(r.headers.get("x-tts-voice"), "vi-VN-HoaiMyNeural", "voice: không chọn thì dùng TTS_VOICES");
for (const bad of ["vi-VN-x\"><break/>", "de-DE-KatjaNeural", "abc", "vi-VN-Ne ural", "vi--x", "../../etc"]) {
  r = await worker.fetch(post({ text: "con gà", lang: "vi", voice: bad }), env({ TTS_PROVIDER: "azure", TTS_KEY: "k", TTS_REGION: "westeurope" }));
  eq(r.status, 400, "voice: từ chối tên giọng không hợp lệ / sai ngôn ngữ / có ký tự lạ: " + JSON.stringify(bad));
}
{
  const before = calls.length;
  await worker.fetch(post({ text: "x", lang: "vi", voice: "vi-VN-x\"><break/>" }), env({ TTS_PROVIDER: "azure", TTS_KEY: "k", TTS_REGION: "westeurope" }));
  eq(calls.slice(before).some((c) => c.url.includes("microsoft")), false, "voice: giọng bị từ chối thì KHÔNG gọi nhà cung cấp");
}
eq((await (await worker.fetch(new Request("https://a.dev/api/config"), env({ TTS_PROVIDER: "Azure", TTS_KEY: "secret-key" }))).json()).ttsProvider, "azure", "config: lộ tên nhà cung cấp (chữ thường)");
eq(JSON.stringify(await (await worker.fetch(new Request("https://a.dev/api/config"), env({ TTS_PROVIDER: "azure", TTS_KEY: "secret-key" }))).text()).includes("secret-key"), false, "config: KHÔNG lộ khoá TTS");

// ---- giọng nữ/nam + nhiều ngôn ngữ ----
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes("/rpc/is_admin")) return new Response("true");
  if (String(url).includes("googleapis")) return new Response(JSON.stringify({ audioContent: btoa("x") }), { status: 200 });
  return new Response(new Uint8Array([7]), { status: 200 });
};
{
  const az = (o = {}) => env({ TTS_PROVIDER: "azure", TTS_KEY: "k", TTS_REGION: "westeurope", ...o });
  const voiceOf = async (body, e = az()) => { const x = await worker.fetch(post(body), e); return [x.status, x.headers.get("x-tts-voice"), x.headers.get("x-tts-gender")]; };
  eq(await voiceOf({ text: "a", lang: "vi" }), [200, "vi-VN-HoaiMyNeural", "female"], "gender: mặc định = nữ");
  eq(await voiceOf({ text: "a", lang: "vi", gender: "male" }), [200, "vi-VN-NamMinhNeural", "male"], "gender: nam -> NamMinh");
  eq(await voiceOf({ text: "a", lang: "ko", gender: "male" }), [200, "ko-KR-InJoonNeural", "male"], "tiếng Hàn: giọng nam mặc định");
  eq(await voiceOf({ text: "a", lang: "ja" }), [200, "ja-JP-NanamiNeural", "female"], "tiếng Nhật: giọng nữ mặc định");
  // LỖI THẬT: TTS_VOICES={"vi":"vi-VN-NamMinhNeural"} (chuỗi) từng làm giọng NỮ đọc bằng giọng nam
  const legacy = az({ TTS_VOICES: JSON.stringify({ vi: "vi-VN-NamMinhNeural" }) });
  eq(await voiceOf({ text: "a", lang: "vi", gender: "female" }, legacy), [200, "vi-VN-HoaiMyNeural", "female"], "chuỗi TTS_VOICES là giọng NAM: giọng nữ vẫn là HoaiMy");
  eq(await voiceOf({ text: "a", lang: "vi", gender: "male" }, legacy), [200, "vi-VN-NamMinhNeural", "male"], "chuỗi TTS_VOICES là giọng NAM: dùng cho giọng nam");
  eq(await voiceOf({ text: "a", lang: "vi", gender: "female" }, az({ TTS_VOICES: JSON.stringify({ vi: { female: "vi-VN-Khac" } }) })), [200, "vi-VN-Khac", "female"], "object {female}: giọng nữ ghi đè");
  const cfgV = (await (await worker.fetch(new Request("https://a.dev/api/config"), legacy)).json()).ttsVoices.vi;
  eq(cfgV, { female: "vi-VN-HoaiMyNeural", male: "vi-VN-NamMinhNeural" }, "config: chuỗi NamMinh không đè giọng nữ");
  eq((await voiceOf({ text: "a", lang: "vi", gender: "robot" }))[0], 400, "gender: giá trị lạ bị từ chối");
  eq((await voiceOf({ text: "a", lang: "xx" }))[0], 400, "ngôn ngữ không có giọng -> 400 (app dùng giọng trình duyệt)");
  eq(await voiceOf({ text: "a", lang: "vi", gender: "male" }, az({ TTS_VOICES: JSON.stringify({ vi: { male: "vi-VN-Khac" } }) })), [200, "vi-VN-Khac", "male"], "TTS_VOICES dạng {female,male}: giọng nam ghi đè");
  eq((await voiceOf({ text: "a", lang: "vi", gender: "male" }, az({ TTS_VOICES: JSON.stringify({ vi: "vi-VN-ChiNu" }) })))[1], "vi-VN-NamMinhNeural", "TTS_VOICES dạng chuỗi chỉ ghi đè giọng NỮ, giọng nam vẫn mặc định");
  eq((await voiceOf({ text: "a", lang: "vi", gender: "male", voice: "vi-VN-AdminChon" }))[1], "vi-VN-AdminChon", "giọng admin chọn ưu tiên hơn mặc định");
  eq((await voiceOf({ text: "a", lang: "vi" }, az({ TTS_VOICES: "[1,2]" })))[0], 500, "TTS_VOICES không phải object -> 500");
  const g = env({ TTS_PROVIDER: "google", TTS_KEY: "k" });
  eq(await voiceOf({ text: "a", lang: "vi", gender: "male" }, g), [200, "vi-VN-Wavenet-B", "male"], "google: giọng nam tiếng Việt");
  eq((await voiceOf({ text: "a", lang: "ko" }, g))[0], 400, "google: ngôn ngữ chưa có giọng mặc định -> 400");
  const cfgOf = async (e) => (await (await worker.fetch(new Request("https://a.dev/api/config"), e)).json()).ttsVoices;
  eq(Object.keys(await cfgOf(az())).includes("ko") && Object.keys(await cfgOf(az())).includes("ja"), true, "config: liệt kê ngôn ngữ có TTS (có Hàn, Nhật)");
  eq((await cfgOf(env())), {}, "config: chưa cấu hình TTS -> không có ngôn ngữ nào");
  eq((await cfgOf(az({ TTS_VOICES: JSON.stringify({ xx: "xx-XX-Thu" }) }))).xx, { female: "xx-XX-Thu", male: "" }, "config: ngôn ngữ thêm bằng TTS_VOICES cũng được tính");
}

globalThis.fetch = realFetch;

process.exit(fail);
