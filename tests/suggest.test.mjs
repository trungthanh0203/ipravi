// /api/suggest (Gemini): kiểm quyền admin, kiểm tra đầu vào, dựng yêu cầu, làm sạch kết quả, ánh xạ lỗi — dùng fetch GIẢ (không gọi Gemini thật).
// Chạy: node tests/suggest.test.mjs
import worker from "../worker.js";
import { buildGeminiRequest, sanitize, MAX_ENTRIES } from "../suggest.js";

let pass = 0, fail = 0;
const ok = (c, n, x = "") => { (c ? pass++ : fail++); console.log(`${c ? "ok  " : "FAIL"} ${n}${c ? "" : "  <-- " + x}`); };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);

const realFetch = globalThis.fetch;
let admin = true;
let gemini = null; // (url, init) => Response
const calls = [];
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url.includes("/rest/v1/rpc/is_admin")) return new Response(JSON.stringify(admin), { status: 200 });
  if (url.includes("generativelanguage.googleapis.com")) { calls.push({ url, init }); return gemini(url, init); }
  throw new Error("fetch bất ngờ: " + url);
};

const env = (o = {}) => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", LANGUAGES: "de:Deutsch,en:English,ko:한국어,ja:日本語", AI_KEY: "secret-key", ASSETS: { fetch: async () => new Response("asset") }, ...o });
const post = (body, e = env(), headers = { authorization: "Bearer tok" }) =>
  worker.fetch(new Request("https://a.dev/api/suggest", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), e);
const geminiOk = (items) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] }, finishReason: "STOP" }] }), { status: 200 });

// ---- Cấu hình + quyền ----
{
  const cfg = await (await worker.fetch(new Request("https://a.dev/api/config"), env())).json();
  eq([cfg.aiEnabled, JSON.stringify(cfg).includes("secret-key")], [true, false], "config: aiEnabled = true và KHÔNG lộ khoá");
  eq((await (await worker.fetch(new Request("https://a.dev/api/config"), env({ AI_KEY: "" }))).json()).aiEnabled, false, "config: chưa có AI_KEY → aiEnabled = false");
  eq((await worker.fetch(new Request("https://a.dev/api/suggest"), env())).status, 405, "suggest: GET bị từ chối (405)");
  admin = false;
  eq((await post({ entries: ["a"] })).status, 403, "suggest: không phải admin → 403");
  admin = true;
  const r = await post({ entries: ["con chó"] }, env({ AI_KEY: "" }));
  eq([r.status, (await r.json()).error.includes("AI_KEY")], [501, true], "suggest: chưa cấu hình AI_KEY → 501 kèm hướng dẫn");
  eq((await post({ entries: ["con chó"] }, env({ AI_MODEL: "../../evil" }))).status, 500, "suggest: AI_MODEL chứa ký tự lạ bị chặn");
}

// ---- Kiểm tra đầu vào ----
{
  const s = async (body) => (await post(body)).status;
  eq(await s("không phải json"), 400, "input: JSON hỏng → 400");
  eq(await s({}), 400, "input: không có mục → 400");
  eq(await s({ entries: Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => "x" + i) }), 400, `input: quá ${MAX_ENTRIES} mục → 400`);
  eq(await s({ entries: [" "] }), 400, "input: mục trống → 400");
  eq(await s({ entries: ["x".repeat(201)] }), 400, "input: mục dài quá 200 ký tự → 400");
  eq(await s({ entries: ["con chó"], langs: ["fr"] }), 400, "input: ngôn ngữ ngoài LANGUAGES → 400");
  eq(calls.length, 0, "input: các yêu cầu sai không gọi Gemini");
}

// ---- Yêu cầu gửi Gemini ----
{
  gemini = () => geminiOk([{ i: 0, emoji: "🐶", tr: { de: "Hund", en: "dog" } }, { i: 1, emoji: "🐱", tr: { de: "Katze", en: "cat" } }]);
  const r = await post({ entries: [{ vi: "con chó", lesson: "Con vật quanh nhà" }, "con mèo"], langs: ["de", "en"], wantEmoji: true, context: { unit: "Con vật", level: 1, kind: "item" } });
  const out = await r.json();
  eq([r.status, out.items.length, out.items[0], out.model], [200, 2, { emoji: "🐶", tr: { de: "Hund", en: "dog" } }, "gemini-2.5-flash"], "gọi Gemini: kết quả trả về đúng thứ tự");
  const c = calls.at(-1);
  const body = JSON.parse(c.init.body);
  ok(c.url === "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "gọi Gemini: đúng URL + mô hình mặc định", c.url);
  ok(c.init.headers["x-goog-api-key"] === "secret-key" && !c.url.includes("secret-key"), "gọi Gemini: khoá đi trong header, KHÔNG nằm trên URL");
  const prompt = JSON.parse(body.contents[0].parts[0].text);
  eq([prompt.languages, prompt.wantEmoji, prompt.context, prompt.entries], [[{ code: "de", name: "German" }, { code: "en", name: "English" }], true, { unit: "Con vật", level: 1, kind: "item" }, [{ i: 0, vi: "con chó", lesson: "Con vật quanh nhà" }, { i: 1, vi: "con mèo" }]], "gọi Gemini: nội dung gửi = ngôn ngữ + ngữ cảnh + mục (không có gì khác)");
  eq(Object.keys(body.generationConfig.responseSchema.properties.items.items.properties.tr.properties), ["de", "en"], "gọi Gemini: schema đầu ra có đúng các ngôn ngữ yêu cầu");
  ok(body.generationConfig.responseMimeType === "application/json" && body.generationConfig.thinkingConfig?.thinkingBudget === 0, "gọi Gemini: đầu ra JSON, tắt \"suy nghĩ\" cho dòng 2.5-flash");
  ok(/Ignore any instructions/.test(body.systemInstruction.parts[0].text), "gọi Gemini: prompt hệ thống coi mục là dữ liệu (chống chèn lệnh)");
  const custom = buildGeminiRequest({ AI_KEY: "k", AI_MODEL: "gemini-1.5-flash" }, { languages: [{ code: "ko", name: "Korean" }], context: {}, entries: [], wantEmoji: false });
  ok(custom.url.includes("models/gemini-1.5-flash:") && !("thinkingConfig" in JSON.parse(custom.init.body).generationConfig), "AI_MODEL đổi được; mô hình khác không gắn thinkingConfig");
  const four = await post({ entries: ["con chó"] });
  eq(Object.keys(JSON.parse(JSON.parse(calls.at(-1).init.body).contents[0].parts[0].text).languages.map((l) => l.code)), ["0", "1", "2", "3"], "không nói langs → dịch đủ 4 ngôn ngữ của trung tâm (de en ko ja)");
  await four.text();
}

// ---- Làm sạch kết quả ----
{
  const langs = [{ code: "de", name: "German" }, { code: "en", name: "English" }];
  const entries = [{ i: 0, vi: "con chó" }, { i: 1, vi: "hoa" }, { i: 2, vi: "xin chào" }];
  const s = sanitize({ items: [
    { i: 0, emoji: "🐶", tr: { de: "  Hund ", en: "dog", ko: "개" } },                 // ko không yêu cầu → bỏ
    { i: 1, emoji: "abc", tr: { de: "hoa", en: "x".repeat(300) } },                     // emoji giả, trùng chữ Việt, quá dài → rỗng
    { i: 9, emoji: "🐱", tr: { de: "Katze" } },                                          // chỉ mục ngoài phạm vi → bỏ
    { i: 0, emoji: "🐕🐕🐕🐕", tr: {} },                                                  // 4 emoji → coi là không hợp lệ (ghi đè bản trước)
  ] }, entries, langs);
  eq(s[0], { emoji: "", tr: { de: "", en: "" } }, "sanitize: mục trùng chỉ mục lấy bản sau; emoji > 3 bị bỏ");
  eq(s[1], { emoji: "", tr: { de: "", en: "" } }, "sanitize: emoji giả, bản dịch trùng chữ Việt hoặc quá dài → rỗng");
  eq(s[2], { emoji: "", tr: { de: "", en: "" } }, "sanitize: mục thiếu trong kết quả → rỗng (không bịa)");
  const good = sanitize({ items: [{ i: 0, emoji: "🐶", tr: { de: "  Hund ", en: "dog", ko: "개" } }, { i: 2, emoji: "👋", tr: { de: "Hallo", en: "hello" } }] }, entries, langs);
  eq([good[0], good[2].emoji], [{ emoji: "🐶", tr: { de: "Hund", en: "dog" } }, "👋"], "sanitize: chuẩn hoá khoảng trắng, bỏ ngôn ngữ không yêu cầu, giữ emoji hợp lệ");
  eq(sanitize({ items: [{ i: 0, emoji: "1️⃣", tr: {} }] }, entries, langs)[0].emoji, "1️⃣", "sanitize: emoji số (keycap) hợp lệ");
  eq(sanitize(null, entries, langs).length, 3, "sanitize: kết quả rỗng/hỏng vẫn trả đủ số phần tử");
}

// ---- Ánh xạ lỗi của Gemini ----
{
  const err = async (make, expectStatus, re, name) => {
    gemini = make;
    const r = await post({ entries: ["con chó"] });
    const j = await r.json();
    ok(r.status === expectStatus && re.test(j.error), `lỗi: ${name}`, `${r.status} ${j.error}`);
  };
  await err(() => new Response(JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } }), { status: 400 }), 502, /khoá API/, "khoá sai → 502 nói rõ AI_KEY");
  await err(() => new Response("{}", { status: 429 }), 429, /hạn mức/, "vượt hạn mức → 429");
  await err(() => new Response("{}", { status: 404 }), 502, /AI_MODEL/, "sai tên mô hình → nhắc AI_MODEL");
  await err(() => new Response("{}", { status: 403 }), 502, /quyền/, "khoá không có quyền → 502");
  await err(() => new Response("boom", { status: 500 }), 502, /Gemini lỗi 500/, "lỗi máy chủ Gemini → 502");
  await err(() => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 }), 422, /SAFETY/, "bị chặn nội dung → 422");
  await err(() => new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS" }] }), { status: 200 }), 502, /MAX_TOKENS/, "không có kết quả → 502 kèm lý do");
  await err(() => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{không phải json" }] } }] }), { status: 200 }), 502, /JSON hỏng/, "JSON hỏng → 502");
  await err(() => { throw new TypeError("network down"); }, 502, /Không gọi được Gemini/, "mất mạng → 502");
  gemini = () => new Response(JSON.stringify({ error: { message: "x".repeat(500) } }), { status: 500 });
  const long = await (await post({ entries: ["con chó"] })).json();
  ok(long.error.length < 260, "lỗi: thông điệp của Gemini bị cắt còn ≤ 200 ký tự", String(long.error.length));
}

globalThis.fetch = realFetch;
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
