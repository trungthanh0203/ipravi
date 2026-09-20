// Kiểm thử các hàm thuần của giao diện + Worker. Chạy: node tests/unit.test.mjs (không cần cài gì).
import { scorePronunciation, tokenize, tier } from "../public/js/pronunciation.js";
import { pickAudio } from "../public/js/audio.js";
import worker from "../worker.js";
import { LEVELS, levelOf, levelProgress, recommendedLevel, percent } from "../public/js/levels.js";
import { TONES, toneOf, stripTone, splitSyllable, words, bare, spoken } from "../public/js/viet.js";
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

// Worker
const env = { CENTER_NAME: "Trung tâm A", SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k", LANGUAGES: "de:Deutsch,en:English", ASSETS: { fetch: async () => new Response("asset") } };
const cfg = await (await worker.fetch(new Request("https://a.dev/api/config"), env)).json();
eq(cfg.languages, [{ code: "de", label: "Deutsch" }, { code: "en", label: "English" }], "worker: parse ngôn ngữ");
eq(cfg.centerName, "Trung tâm A", "worker: tên trung tâm");
eq(await (await worker.fetch(new Request("https://a.dev/index.html"), env)).text(), "asset", "worker: file tĩnh qua ASSETS");
eq((await (await worker.fetch(new Request("https://a.dev/api/config"), { ASSETS: env.ASSETS })).json()).languages, [{ code: "de", label: "Deutsch" }], "worker: mặc định ngôn ngữ de");

process.exit(fail);
