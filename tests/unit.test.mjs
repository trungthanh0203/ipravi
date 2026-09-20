// Kiểm thử các hàm thuần của giao diện + Worker. Chạy: node tests/unit.test.mjs (không cần cài gì).
import { scorePronunciation, tokenize, tier } from "../public/js/pronunciation.js";
import { pickAudio } from "../public/js/audio.js";
import worker from "../worker.js";
import { LEVELS, levelOf, levelProgress, recommendedLevel, percent } from "../public/js/levels.js";
import { TONES, toneOf, stripTone, splitSyllable, words, bare, spoken, spellParts, caseParts, lookalikes, capitalIndexes, hasProperName } from "../public/js/viet.js";
import { INITIAL_SOUND, initialSound, VOWELS, VAN_GROUPS, TONE_NAMES, bankPlan, sayOfPart } from "../public/js/sounds.js";
import { peakOf, rmsOf, trimSilence, normalizePeak, resample, encodeWav, processTake, durationMs } from "../public/js/admin/wav.js";
import { guessGender } from "../public/js/voice-names.js";

let fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.log("FAIL", m, a, b); fail = 1; } else console.log("ok  ", m); };

// Chấm phát âm
eq(scorePronunciation("con gà", "con gà"), 100, "giống hệt = 100");
eq(scorePronunciation("Con gà!", "con gà"), 100, "bỏ qua hoa/thường + dấu câu");
eq(scorePronunciation("con gà", "gà"), 100, "chỉ nói 'gà' (bỏ từ loại) vẫn đủ điểm");
eq(scorePronunciation("con gà", "con vịt"), 0, "nói nhầm con vật khác = 0 (không được điểm nhờ từ 'con')");
eq(scorePronunciation("màu xanh dương", "màu xanh lá") < 100, true, "nhầm màu bị trừ điểm");
eq(scorePronunciation("màu đỏ", "màu vàng"), 0, "nhầm màu 1 từ = 0");
eq(scorePronunciation("con gà", "con ga") < 100, true, "thiếu dấu thanh bị trừ điểm");
eq(scorePronunciation("con gà", ""), 0, "không nghe thấy = 0");
eq(scorePronunciation("", "abc"), 0, "mẫu rỗng = 0");
eq(scorePronunciation("mẹ", "mẹ"), 100, "từ đơn không bị bỏ");
eq(scorePronunciation("con mèo đang ngủ", "mèo đang ngủ"), 100, "câu: bỏ từ loại đầu câu ở cả 2 phía");
eq(scorePronunciation("con mèo đang ngủ", "con mèo đang chạy") < 100, true, "câu: sai 1 từ bị trừ");
eq(tier(100).stars, 3, "tier 3 sao"); eq(tier(10).key, "retry", "tier retry");
eq(tokenize("Con  gà, trống!"), ["con", "gà", "trống"], "tách từ");

// Chọn giọng
const rows = [
  { id: 1, lang: "vi", speed: "normal", source: "tts", voice_kind: "adult", region: null },
  { id: 2, lang: "vi", speed: "normal", source: "human", voice_kind: "adult", region: "bac" },
  { id: 3, lang: "vi", speed: "normal", source: "human", voice_kind: "child", region: "nam" },
  { id: 4, lang: "vi", speed: "slow", source: "tts", voice_kind: "adult", region: null },
  { id: 5, lang: "de", speed: "normal", source: "tts", voice_kind: "adult", region: null },
];
eq(pickAudio(rows, { lang: "vi" }).id, 2, "ưu tiên giọng người thật hơn TTS");
eq(pickAudio(rows, { lang: "vi", voiceKind: "child", region: "nam" }).id, 3, "khớp giọng trẻ em + vùng miền");
eq(pickAudio(rows.filter((r) => r.source === "tts"), { lang: "vi" }).id, 1, "chỉ có TTS thì dùng TTS");
eq(pickAudio(rows, { lang: "vi", speed: "slow" }).id, 4, "nghe chậm");
eq(pickAudio(rows, { lang: "en" }), null, "không có audio => null");
eq(pickAudio(rows, { lang: "de" }).id, 5, "audio nghĩa tiếng Đức");

// Chọn giọng theo giới bé chọn
{
  const row = (id, source, gender, speed = "normal", extra = {}) => ({ id, lang: "vi", speed, source, gender, voice_kind: "adult", region: null, ...extra });
  const rs = [row(1, "tts", "female"), row(2, "tts", "male"), row(3, "human", "female")];
  eq(pickAudio(rs, { lang: "vi", gender: "male" }).id, 2, "giới: bé chọn nam -> giọng TTS nam thắng cả giọng người thật nữ");
  eq(pickAudio(rs, { lang: "vi", gender: "female" }).id, 3, "giới: bé chọn nữ -> giọng người thật nữ thắng TTS nữ");
  eq(pickAudio(rs, { lang: "vi" }).id, 3, "giới: không chọn -> người thật thắng như cũ");
  eq(pickAudio([row(1, "tts", "female")], { lang: "vi", gender: "male" }).id, 1, "giới: chưa có giọng nam -> vẫn dùng giọng nữ (không im lặng)");
  eq(pickAudio([row(1, "tts", "female"), row(2, "tts", "male", "slow")], { lang: "vi", gender: "male", speed: "normal" }).id, 1, "giới: tốc độ khác không lẫn (nam chậm không dùng cho nam thường)");
  eq(pickAudio([row(1, "tts", null), row(2, "tts", "male")], { lang: "vi", gender: "female" }).id, 1, "giới: dòng cũ chưa có gender vẫn dùng được");
  eq(pickAudio([], { lang: "vi", gender: "male" }), null, "giới: không có file nào -> null (khu trẻ dùng giọng trình duyệt)");
}

// Đoán giới từ tên giọng (lỗi thật: giọng nam bị coi là nữ)
eq(guessGender("vi-VN-NamMinhNeural"), "male", "giới: NamMinh = nam");
eq(guessGender("vi-VN-HoaiMyNeural"), "female", "giới: HoaiMy = nữ");
eq(guessGender("vi-VN-Wavenet-B"), "male", "giới: Google Wavenet-B = nam");
eq(guessGender("xx-XX-LaLam"), null, "giới: tên lạ = không đoán");
eq(guessGender(""), null, "giới: rỗng = null");

// Cấp học
{
  const st = (levels) => ({ levels });
  const L = (level, items_total, items_mastered, lessons_total = 1, lessons_done = 0) => ({ level, items_total, items_mastered, lessons_total, lessons_done });
  eq(LEVELS.map((l) => l.n), [1, 2, 3, 4], "cấp: có đúng 4 cấp");
  eq([levelOf({ level: 3 }), levelOf({}), levelOf({ level: 9 }), levelOf(null)], [3, 1, 4, 1], "cấp: levelOf kẹp 1–4, mặc định 1");
  eq([percent(1, 3), percent(0, 0)], [33, 0], "cấp: percent");
  const p = levelProgress(st([L(1, 10, 8), L(2, 10, 3)]));
  eq(p.map((x) => [x.hasContent, x.passed, x.percent]), [[true, true, 80], [true, false, 30], [false, false, 0], [false, false, 0]], "cấp: đạt cấp khi ≥80% từ đã thuộc; cấp chưa có nội dung = 'sắp có'");
  eq(recommendedLevel(p), 2, "cấp: gợi ý = cấp đầu tiên chưa qua");
  eq(recommendedLevel(levelProgress(st([L(1, 10, 9), L(2, 10, 10)]))), 2, "cấp: qua hết thì gợi ý cấp cuối có nội dung");
  eq(recommendedLevel(levelProgress(st([L(1, 10, 0)]))), 1, "cấp: chưa học gì → cấp 1");
  eq(recommendedLevel(levelProgress(null)), null, "cấp: chưa có nội dung/thống kê → null");
  eq(levelProgress(st([L(1, 0, 0)]))[0].passed, false, "cấp: 0 từ không được coi là đạt");
}

// Ngữ âm tiếng Việt
eq(TONES.map((t) => t.key), ["ngang", "sac", "huyen", "hoi", "nga", "nang"], "viet: 6 thanh");
eq(["ma", "má", "mà", "mả", "mã", "mạ"].map(toneOf), ["ngang", "sac", "huyen", "hoi", "nga", "nang"], "viet: toneOf 6 thanh");
eq([toneOf("ơ"), toneOf("â"), toneOf("ă"), toneOf("ê"), toneOf("ư")], ["ngang", "ngang", "ngang", "ngang", "ngang"], "viet: dấu mũ/móc/trăng KHÔNG phải thanh");
eq([toneOf("ấ"), toneOf("ầ"), toneOf("ở"), toneOf("ữ"), toneOf("ợ")], ["sac", "huyen", "hoi", "nga", "nang"], "viet: thanh trên nguyên âm có dấu mũ/móc");
eq(["ngang", "sắc", "huyền", "hỏi", "ngã", "nặng"].map(toneOf), ["ngang", "sac", "huyen", "hoi", "nga", "nang"], "viet: tên 6 thanh mang đúng thanh của nó");
eq([stripTone("bà"), stripTone("nghiêng"), stripTone("mượn"), stripTone("đạo")], ["ba", "nghiêng", "mươn", "đao"], "viet: stripTone giữ dấu mũ/móc/đ");
for (const [w, i, r] of [["bà", "b", "à"], ["nghé", "ngh", "é"], ["ăn", "", "ăn"], ["ba", "b", "a"], ["gì", "g", "ì"], ["gìn", "g", "ìn"], ["giá", "gi", "á"], ["giữ", "gi", "ữ"],
  ["quả", "qu", "ả"], ["nhà", "nh", "à"], ["ngô", "ng", "ô"], ["thuyền", "th", "uyền"], ["trăng", "tr", "ăng"], ["kem", "k", "em"], ["đèn", "đ", "èn"], ["chuối", "ch", "uối"], ["ô", "", "ô"], ["Bà", "b", "à"]])
  eq(splitSyllable(w), { initial: i, rest: r }, `viet: tách "${w}" = ${i || "∅"} + ${r}`);
eq([splitSyllable("con mèo"), splitSyllable(""), splitSyllable(null)], [null, null, null], "viet: không phải 1 tiếng → null");
eq(words("Con chào bà ạ.").map(bare), ["Con", "chào", "bà", "ạ"], "viet: tách tiếng trong câu + bỏ dấu câu");
eq([spoken({ text_vi: "b", say_vi: "bờ" }), spoken({ text_vi: "bà" }), spoken(null)], ["bờ", "bà", ""], "viet: spoken ưu tiên chữ đọc riêng (say)");

// Ngân hàng âm
{
  const plan = bankPlan();
  const all = plan.flatMap((p) => p.items.map((i) => i.text));
  eq(new Set(all).size, all.length, "ngân hàng âm: không có âm trùng");
  eq(plan.every((p) => p.items.length >= 1 && p.items.length <= 24), true, "ngân hàng âm: mỗi bài 1–24 âm (thu từng đợt ngắn)");
  eq(initialSound("b"), "bờ", "âm đầu: b → bờ");
  eq([initialSound("k"), initialSound("q"), initialSound("gh"), initialSound("ngh")], ["cờ", "cờ", "gờ", "ngờ"], "âm đầu: k/q/gh/ngh đọc như c/c/g/ng");
  eq(initialSound("zz"), "", "âm đầu lạ → rỗng");
  eq(VOWELS.length, 12, "nguyên âm đơn: 12");
  eq(VOWELS.find((v) => v[0] === "ă")[1], "á", "ă đọc là á");
  eq(TONE_NAMES.length, 6, "6 tên thanh");
  // mọi âm đầu mà splitSyllable có thể trả ra đều có cách đọc
  const inits = ["b", "c", "ch", "d", "đ", "g", "gh", "gi", "h", "k", "kh", "l", "m", "n", "ng", "ngh", "nh", "p", "ph", "qu", "r", "s", "t", "th", "tr", "v", "x"];
  eq(inits.filter((i) => !initialSound(i)), [], "mọi âm đầu tiếng Việt đều có cách đọc");
  eq(VAN_GROUPS.flatMap((g) => g[1]).every((v) => /^[a-zăâêôơưiyeuo]+$/.test(v)), true, "vần: chỉ gồm chữ cái tiếng Việt");
  eq(VAN_GROUPS.flatMap((g) => g[1]).length >= 70, true, "vần: ≥ 70 vần");
}

// Đánh vần theo phần
{
  const flat = (w) => spellParts(w)?.map((p) => p.text).join("–");
  eq(flat("bà"), "bờ–a–ba–huyền–bà", "đánh vần: bà = bờ–a–ba–huyền–bà");
  eq(flat("ba"), "bờ–a–ba", "đánh vần: thanh ngang bỏ 'tiếng chưa dấu' và 'dấu'");
  eq(flat("nghé"), "ngờ–e–nghe–sắc–nghé", "đánh vần: nghé (ngh → ngờ)");
  eq(flat("quả"), "quờ–a–qua–hỏi–quả", "đánh vần: quả");
  eq(flat("gì"), "gờ–i–gi–huyền–gì", "đánh vần: gì (g + ì)");
  eq(flat("trứng"), "trờ–ưng–trưng–sắc–trứng", "đánh vần: trứng (vần ưng)");
  eq(flat("kem"), "cờ–em–kem", "đánh vần: kem (k → cờ)");
  eq(flat("bàn"), "bờ–an–ban–huyền–bàn", "đánh vần: bàn (vần an)");
  eq(flat("ăn"), "ăn", "đánh vần: ăn (không âm đầu, thanh ngang) chỉ còn 1 phần");
  eq(flat("ấm"), "âm–sắc–ấm", "đánh vần: ấm (không âm đầu) = vần – dấu – tiếng");
  eq([spellParts("con mèo"), spellParts("")], [null, null], "đánh vần: không phải 1 tiếng → null");
  eq(spellParts("bà").map((p) => p.role), ["initial", "van", "base", "tone", "whole"], "đánh vần: vai trò từng phần");
  eq(spellParts("Bà").at(-1).text, "bà", "đánh vần: chữ hoa được chuẩn về chữ thường");
  eq([sayOfPart("ă"), sayOfPart("â"), sayOfPart("b")], ["á", "ớ", "b"], "sayOfPart: ă → á, â → ớ, còn lại giữ nguyên");
  // mọi phần của các từ dùng trong Cấp 3 có thể tra trong ngân hàng âm (phần chưa có sẽ rơi về TTS — chỉ đếm để biết mức phủ)
  const bank = new Set(bankPlan().flatMap((p) => p.items.map((i) => i.text)));
  const sample = ["bà", "cá", "nghé", "quả", "trứng", "kem", "bàn", "chuối", "mèo", "đèn"];
  const missing = sample.flatMap((w) => spellParts(w).filter((p) => ["initial", "van", "tone"].includes(p.role) && !bank.has(p.text)).map((p) => w + ":" + p.text));
  eq(missing.filter((m) => !/chuối:uôi|mèo:eo/.test(m)), [], "ngân hàng âm phủ âm đầu/vần/dấu của các từ mẫu");
}

// Chữ hoa
{
  eq(caseParts("A a"), { upper: "A", lower: "a" }, "chữ hoa: tách 'A a'");
  eq(caseParts("Ngh ngh"), { upper: "Ngh", lower: "ngh" }, "chữ hoa: tách chữ ghép 'Ngh ngh'");
  eq(caseParts("Đ đ"), { upper: "Đ", lower: "đ" }, "chữ hoa: Đ đ");
  eq([caseParts("A b"), caseParts("a A"), caseParts("Aa"), caseParts(""), caseParts(null), caseParts("A a b")], [null, null, null, null, null, null], "chữ hoa: dạng sai → null (thường ≠ hoa viết thường / đảo chỗ / thiếu dấu cách)");
  eq(lookalikes("B").includes("D") && lookalikes("B").includes("P") && !lookalikes("B").includes("B"), true, "chữ hoa: B lẫn với D, P (không tự lẫn với mình)");
  eq(lookalikes("Q").includes("O") && lookalikes("Ă").includes("A"), true, "chữ hoa: Q~O, Ă~A");
  eq(lookalikes("Ch").includes("C") || lookalikes("Ch").length >= 0, true, "chữ hoa: chữ ghép không lỗi");
  eq(capitalIndexes("An và Mai đi học."), [0, 2], "viết hoa: từ đầu câu + tên riêng giữa câu");
  eq(capitalIndexes("Bà ở Hà Nội."), [0, 2, 3], "viết hoa: địa danh 2 tiếng đều hoa");
  eq(capitalIndexes("trời mưa rồi."), [], "viết hoa: câu toàn chữ thường → không có (dữ liệu sai)");
  eq([hasProperName("Bà ở Hà Nội."), hasProperName("Con mèo ngủ."), hasProperName("Ăn cơm đi con.")], [true, false, false], "viết hoa: chỉ tính tên riêng ngoài từ đầu câu");
}

// Xử lý âm thanh thu
{
  const sr = 8000;
  const tone = (n, amp) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / sr));
  const sil = (n) => new Float32Array(n);
  const cat = (...a) => { const o = new Float32Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
  const x = cat(sil(4000), tone(4000, 0.3), sil(4000));
  const t = trimSilence(x, sr);
  eq(t.length < x.length && t.length >= 4000, true, "cắt lặng: bỏ khoảng lặng, giữ tiếng");
  eq(t.length <= 4000 + 2 * Math.round(0.12 * sr) + 2, true, "cắt lặng: chừa ≤ 120 ms mỗi đầu");
  eq(trimSilence(sil(100), sr).length, 100, "cắt lặng: toàn im lặng → trả nguyên");
  const n = normalizePeak(tone(1000, 0.1));
  eq(Math.abs(peakOf(n) - 10 ** (-1 / 20)) < 0.01, true, "chuẩn hoá: đỉnh về -1 dBFS");
  eq(peakOf(normalizePeak(tone(1000, 1e-6))) < 0.5, true, "chuẩn hoá: không khuếch đại vô hạn tiếng cực nhỏ");
  eq(peakOf(normalizePeak(sil(50))), 0, "chuẩn hoá: im lặng giữ nguyên");
  eq(resample(tone(48000, 0.5), 48000, 24000).length, 24000, "đổi tần số: 48k → 24k còn một nửa số mẫu");
  eq(resample(tone(100, 0.5), 8000, 8000).length, 100, "đổi tần số: cùng tần số giữ nguyên");
  const wav = encodeWav(Float32Array.from([0, 1, -1, 2, -2]), 24000);
  const dv = new DataView(wav.buffer);
  const str = (o, l) => String.fromCharCode(...wav.slice(o, o + l));
  eq([str(0, 4), str(8, 4), str(12, 4), str(36, 4)], ["RIFF", "WAVE", "fmt ", "data"], "WAV: tiêu đề RIFF/WAVE/fmt/data");
  eq([dv.getUint16(22, true), dv.getUint32(24, true), dv.getUint16(34, true)], [1, 24000, 16], "WAV: mono, 24 kHz, 16-bit");
  eq([dv.getInt16(44, true), dv.getInt16(46, true), dv.getInt16(48, true), dv.getInt16(50, true), dv.getInt16(52, true)], [0, 32767, -32768, 32767, -32768], "WAV: mẫu 16-bit, vượt ±1 được kẹp");
  eq(dv.getUint32(40, true), 10, "WAV: kích thước dữ liệu = 2 byte/mẫu");
  const take = processTake(cat(sil(24000), tone(24000, 0.05), sil(24000)), 48000);
  eq([take.ms > 400 && take.ms < 1000, take.wav.length > 44, Math.abs(rmsOf(Float32Array.from([1, -1, 1, -1])) - 1) < 1e-9, durationMs(sil(8000), 8000)], [true, true, true, 1000], "processTake: cắt lặng + 24 kHz + WAV (tiếng ~0,5 s + đệm)");
}

// Worker
const env = { CENTER_NAME: "Trung tâm A", SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k", LANGUAGES: "de:Deutsch,en:English", ASSETS: { fetch: async () => new Response("asset") } };
const cfg = await (await worker.fetch(new Request("https://a.dev/api/config"), env)).json();
eq(cfg.languages, [{ code: "de", label: "Deutsch" }, { code: "en", label: "English" }], "worker: parse ngôn ngữ");
eq(cfg.centerName, "Trung tâm A", "worker: tên trung tâm");
eq(await (await worker.fetch(new Request("https://a.dev/index.html"), env)).text(), "asset", "worker: file tĩnh qua ASSETS");
eq((await (await worker.fetch(new Request("https://a.dev/api/config"), { ASSETS: env.ASSETS })).json()).languages, [{ code: "de", label: "Deutsch" }], "worker: mặc định ngôn ngữ de");

process.exit(fail);
