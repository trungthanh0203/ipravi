// Kiểm thử các hàm thuần của giao diện + Worker. Chạy: node tests/unit.test.mjs (không cần cài gì).
import { scorePronunciation, tokenize, tier } from "../public/js/pronunciation.js";
import { pickAudio } from "../public/js/audio.js";
import worker from "../worker.js";
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

// Worker
const env = { CENTER_NAME: "Trung tâm A", SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k", LANGUAGES: "de:Deutsch,en:English", ASSETS: { fetch: async () => new Response("asset") } };
const cfg = await (await worker.fetch(new Request("https://a.dev/api/config"), env)).json();
eq(cfg.languages, [{ code: "de", label: "Deutsch" }, { code: "en", label: "English" }], "worker: parse ngôn ngữ");
eq(cfg.centerName, "Trung tâm A", "worker: tên trung tâm");
eq(await (await worker.fetch(new Request("https://a.dev/index.html"), env)).text(), "asset", "worker: file tĩnh qua ASSETS");
eq((await (await worker.fetch(new Request("https://a.dev/api/config"), { ASSETS: env.ASSETS })).json()).languages, [{ code: "de", label: "Deutsch" }], "worker: mặc định ngôn ngữ de");

process.exit(fail);
