// /api/suggest (Gemini): kiểm quyền admin, kiểm tra đầu vào, dựng yêu cầu, làm sạch kết quả, ánh xạ lỗi — dùng fetch GIẢ (không gọi Gemini thật).
// Chạy: node tests/suggest.test.mjs
import worker from "../worker.js";
import { buildGeminiRequest, sanitize, modelChain, MAX_ENTRIES } from "../suggest.js";

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
  if (url.includes("generativelanguage.googleapis.com") || url.includes("gateway.ai.cloudflare.com")) { calls.push({ url, init }); return gemini(url, init); }
  throw new Error("fetch bất ngờ: " + url);
};

const env = (o = {}) => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", LANGUAGES: "de:Deutsch,en:English,ko:한국어,ja:日本語", AI_KEY: "secret-key", AI_RETRY_MS: "0", ASSETS: { fetch: async () => new Response("asset") }, ...o });
const post = (body, e = env(), headers = { authorization: "Bearer tok" }) =>
  worker.fetch(new Request("https://a.dev/api/suggest", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), e);
const geminiOk = (items) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] }, finishReason: "STOP" }] }), { status: 200 });

// ---- Cấu hình + quyền ----
{
  const cfg = await (await worker.fetch(new Request("https://a.dev/api/config"), env())).json();
  eq([cfg.aiEnabled, JSON.stringify(cfg).includes("secret-key")], [true, false], "config: aiEnabled = true và KHÔNG lộ khoá");
  eq((await (await worker.fetch(new Request("https://a.dev/api/config"), env({ AI_KEY: "" }))).json()).aiEnabled, false, "config: chưa có AI_KEY → aiEnabled = false");
  eq((await worker.fetch(new Request("https://a.dev/api/suggest", { method: "PUT" }), env())).status, 405, "suggest: PUT bị từ chối (405)");
  admin = false;
  eq((await post({ entries: ["a"] })).status, 403, "suggest: không phải admin → 403");
  admin = true;
  const r = await post({ entries: ["con chó"] }, env({ AI_KEY: "" }));
  eq([r.status, (await r.json()).error.includes("AI_KEY")], [501, true], "suggest: chưa cấu hình AI_KEY → 501 kèm hướng dẫn");
  eq((await post({ entries: ["con chó"] }, env({ AI_MODEL: "../../evil" }))).status, 500, "suggest: AI_MODEL chứa ký tự lạ bị chặn");
}

// ---- Kiểm tra cấu hình (GET) ----
{
  const get = (e = env(), h = { authorization: "Bearer tok" }) => worker.fetch(new Request("https://a.dev/api/suggest", { headers: h }), e);
  admin = false;
  eq((await get()).status, 403, "check: không phải admin → 403");
  admin = true;
  eq((await get(env({ AI_KEY: "" }))).status, 501, "check: chưa có AI_KEY → 501");
  gemini = () => new Response(JSON.stringify({ models: [
    { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
    { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] },
    { name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] },
  ] }), { status: 200 });
  const ok1 = await (await get()).json();
  eq([ok1.ok, ok1.model, ok1.modelUsable, ok1.usingDefault, ok1.available], [true, "gemini-2.5-flash", true, true, ["gemini-2.5-flash", "gemini-2.5-pro"]], "check: mô hình mặc định dùng được; chỉ liệt kê gemini có generateContent");
  const bad = await (await get(env({ AI_MODEL: "gemini-3.6-flash" }))).json();
  eq([bad.model, bad.modelUsable, bad.usingDefault, bad.available.length], ["gemini-3.6-flash", false, false, 2], "check: AI_MODEL không có trong danh sách → modelUsable=false kèm danh sách để chọn");
  eq(calls.at(-1).init.headers["x-goog-api-key"], "secret-key", "check: khoá đi trong header");
  gemini = () => new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 });
  const r400 = await get();
  eq([r400.status, (await r400.json()).error.includes("AI_KEY")], [502, true], "check: khoá sai → 502 nói rõ AI_KEY");
  calls.length = 0;
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

// ---- Thử lại + mô hình dự phòng (503 "high demand") ----
{
  const overloaded = () => new Response(JSON.stringify({ error: { code: 503, message: "This model is currently experiencing high demand." } }), { status: 503 });
  const good = () => geminiOk([{ i: 0, emoji: "", tr: { de: "Hund", en: "dog" } }]);
  const run = async (e = env()) => { const r = await post({ entries: ["con chó"], langs: ["de", "en"] }, e); return { status: r.status, body: await r.json() }; };

  let n = 0;
  gemini = () => (++n < 3 ? overloaded() : good());
  calls.length = 0;
  let r = await run();
  eq([r.status, r.body.items[0].tr.de, r.body.fellBack, r.body.attempts, calls.length], [200, "Hund", false, 3, 3], "retry: 503 hai lần rồi thành công ở lần 3 (cùng mô hình)");

  calls.length = 0;
  gemini = (url) => (url.includes("gemini-x-preview") ? overloaded() : good());
  r = await run(env({ AI_MODEL: "gemini-x-preview" }));
  eq([r.status, r.body.model, r.body.fellBack, calls.map((c) => c.url.match(/models\/([^:]+):/)[1])], [200, "gemini-2.5-flash", true, ["gemini-x-preview", "gemini-x-preview", "gemini-x-preview", "gemini-2.5-flash"]], "retry: mô hình chính quá tải 3 lần → tự chuyển sang mô hình dự phòng (mặc định) và báo fellBack");

  calls.length = 0;
  r = await run(env({ AI_MODEL: "gemini-x-preview", AI_FALLBACK_MODEL: "gemini-y-stable" }));
  eq([r.body.model, calls.at(-1).url.includes("gemini-y-stable")], ["gemini-y-stable", true], "retry: AI_FALLBACK_MODEL chọn được mô hình dự phòng riêng");

  calls.length = 0;
  gemini = overloaded;
  r = await run(env({ AI_MODEL: "gemini-x-preview" }));
  ok(r.status === 503 && /quá tải/.test(r.body.error) && /dự phòng/.test(r.body.error) && calls.length === 5, "retry: cả hai mô hình đều quá tải → 503 nói rõ đã thử 5 lần", `${r.status} ${r.body.error} ${calls.length}`);

  calls.length = 0;
  gemini = () => new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 });
  r = await run(env({ AI_MODEL: "gemini-x-preview" }));
  eq([r.status, calls.length], [502, 1], "retry: lỗi thật (khoá sai) KHÔNG thử lại, không đổi mô hình");

  calls.length = 0;
  gemini = () => new Response("{}", { status: 404 });
  r = await run();
  eq([r.status, calls.length], [502, 1], "retry: sai tên mô hình (404) không thử lại");

  calls.length = 0;
  n = 0;
  gemini = () => { if (++n < 2) throw new TypeError("network down"); return good(); };
  r = await run();
  eq([r.status, calls.length], [200, 2], "retry: mất mạng thoáng qua cũng được thử lại");

  eq((await post({ entries: ["a"] }, env({ AI_FALLBACK_MODEL: "../x" }))).status, 500, "AI_FALLBACK_MODEL chứa ký tự lạ bị chặn");
  eq(JSON.stringify(modelChain(env())) + JSON.stringify(modelChain(env({ AI_MODEL: "gemini-2.5-flash" }))) + JSON.stringify(modelChain(env({ AI_MODEL: "m-1", AI_FALLBACK_MODEL: "m-1" }))), '["gemini-2.5-flash"]["gemini-2.5-flash"]["m-1"]', "modelChain: không trùng, không dự phòng khi đã là mô hình mặc định");
  calls.length = 0;
}

// ---- Lỗi vùng (User location is not supported) + AI_BASE_URL ----
{
  const loc = () => new Response(JSON.stringify({ error: { code: 400, message: "User location is not supported for the API use.", status: "FAILED_PRECONDITION" } }), { status: 400 });
  calls.length = 0;
  gemini = loc;
  let r = await post({ entries: ["con chó"] }, env({ AI_MODEL: "gemini-x-preview" }));
  let j = await r.json();
  ok(r.status === 502 && /placement/.test(j.error) && /wrangler\.jsonc/.test(j.error) && /Hồng Kông/.test(j.error), "vùng: 400 'location is not supported' → hướng dẫn thêm placement vào wrangler.jsonc", `${r.status} ${j.error}`);
  eq(calls.length, 1, "vùng: lỗi vùng không thử lại, không đổi mô hình (đổi mô hình không giúp được)");
  r = await worker.fetch(new Request("https://a.dev/api/suggest", { headers: { authorization: "Bearer tok" } }), env());
  j = await r.json();
  ok(r.status === 502 && /placement/.test(j.error), "vùng: 'Kiểm tra AI' cũng báo đúng nguyên nhân + cách sửa");

  calls.length = 0;
  gemini = () => geminiOk([{ i: 0, emoji: "", tr: { de: "Hund" } }]);
  r = await post({ entries: ["con chó"], langs: ["de"] }, env({ AI_BASE_URL: "https://gateway.ai.cloudflare.com/v1/ACC/GW/google-ai-studio/v1beta/" }));
  eq([r.status, calls[0].url], [200, "https://gateway.ai.cloudflare.com/v1/ACC/GW/google-ai-studio/v1beta/models/gemini-2.5-flash:generateContent"], "AI_BASE_URL: đổi đường dẫn gốc (bỏ dấu / cuối), vẫn kèm khoá trong header");
  eq(calls[0].init.headers["x-goog-api-key"], "secret-key", "AI_BASE_URL: khoá vẫn nằm trong header");
  for (const bad of ["http://insecure.example.com", "https://a b.com", "javascript:alert(1)"]) {
    eq((await post({ entries: ["a"] }, env({ AI_BASE_URL: bad }))).status, 500, `AI_BASE_URL không hợp lệ bị chặn: ${bad}`);
  }
  calls.length = 0;
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
  await err(() => new Response("{}", { status: 404 }), 502, /"gemini-2\.5-flash".*AI_MODEL/, "sai tên mô hình → nêu đúng tên mô hình + nhắc AI_MODEL / Kiểm tra AI");
  await err(() => new Response("{}", { status: 403 }), 502, /quyền/, "khoá không có quyền → 502");
  await err(() => new Response("boom", { status: 500 }), 503, /quá tải/, "lỗi máy chủ Gemini (tạm thời) → thử lại hết lượt rồi báo 503 quá tải");
  await err(() => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 }), 422, /SAFETY/, "bị chặn nội dung → 422");
  await err(() => new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS" }] }), { status: 200 }), 502, /MAX_TOKENS/, "không có kết quả → 502 kèm lý do");
  await err(() => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{không phải json" }] } }] }), { status: 200 }), 502, /JSON hỏng/, "JSON hỏng → 502");
  await err(() => { throw new TypeError("network down"); }, 502, /Không gọi được Gemini/, "mất mạng → 502");
  gemini = () => new Response(JSON.stringify({ error: { message: "x".repeat(500) } }), { status: 400 });
  const long = await (await post({ entries: ["con chó"] })).json();
  ok(long.error.length < 260, "lỗi: thông điệp của Gemini bị cắt còn ≤ 200 ký tự", String(long.error.length));
}

globalThis.fetch = realFetch;
console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
