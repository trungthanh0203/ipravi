// Kiểm thử các hàm thuần của giao diện + Worker. Chạy: node tests/unit.test.mjs (không cần cài gì).
import { scorePronunciation, tokenize, tier } from "../public/js/pronunciation.js";
import { pickAudio } from "../public/js/audio.js";
import worker from "../worker.js";
import { LEVELS, levelOf, levelProgress, recommendedLevel, percent, numberUnits } from "../public/js/levels.js";
import { TONES, toneOf, stripTone, splitSyllable, words, bare, spoken, spellParts, caseParts, lookalikes, capitalIndexes, hasProperName, traceTexts } from "../public/js/viet.js";
import { dilate, labelParts, scoreTrace } from "../public/js/trace-score.js";
import { twemojiName, graphemes, isEmojiGrapheme, emojiUrl } from "../public/js/emoji.js";
import { fitSize, slugify, baseName, matchFiles, checkImageFile, MAX_SIDE } from "../public/js/admin/image-util.js";
import { isLiteral } from "../public/js/child/util.js";
import { TWEMOJI } from "../public/js/twemoji-index.js";
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

// Tô chữ
{
  eq([traceTexts("A a"), traceTexts("Ngh ngh"), traceTexts("bà"), traceTexts("trứng"), traceTexts("a")], [["A", "a"], ["Ngh", "ngh"], ["bà"], ["trứng"], ["a"]], "tô chữ: cặp hoa–thường → 2 chuỗi; từ/chữ → 1 chuỗi");
  eq([traceTexts("con mèo"), traceTexts("Con chào bà ạ."), traceTexts("chuyện kể"), traceTexts("nghiêngnghiêng"), traceTexts("")], [null, null, null, null, null], "tô chữ: cụm từ/câu/quá dài/rỗng → không tô");
  const W = 120, H = 40;
  const grid = () => new Uint8Array(W * H);
  const rect = (g, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * W + x] = 1; return g; };
  // Chữ mẫu: 1 nét ngang dài (thân chữ) + 1 chấm nhỏ phía trên (như dấu thanh)
  const glyph = rect(rect(grid(), 10, 24, 109, 26), 58, 6, 61, 9);
  const params = { glyph, w: W, h: H, tolIn: 3, tolOut: 5 };
  const score = (ink) => scoreTrace({ ...params, ink });
  eq(dilate(rect(grid(), 10, 10, 10, 10), W, H, 2).reduce((a, b) => a + b, 0), 25, "giãn nở: 1 điểm bán kính 2 → khối 5×5");
  eq(labelParts(glyph, W, H).parts.length, 2, "nhãn mảnh: thân + dấu = 2 mảnh");
  const both = rect(rect(grid(), 8, 22, 111, 28), 56, 4, 63, 11);
  const sBoth = score(both);
  eq([sBoth.ok, sBoth.stars, sBoth.coverage > 0.98, sBoth.excess < 0.05, sBoth.missed.length], [true, 3, true, true, 0], "tô chấm: tô đủ thân + dấu → đạt, 3 sao");
  const noMark = score(rect(grid(), 8, 22, 111, 28));
  eq([noMark.ok, noMark.coverage > 0.9, noMark.missed.length, noMark.minPart], [false, true, 1, 0], "tô chấm: tô thân mà BỎ dấu → KHÔNG đạt dù độ phủ chung cao (mảnh dấu = 0)");
  const half = score(rect(rect(grid(), 8, 22, 60, 28), 56, 4, 63, 11));
  eq([half.ok, half.coverage < 0.7], [false, true], "tô chấm: chỉ tô nửa chữ → chưa đạt");
  const scribble = grid();
  for (let y = 0; y < H; y += 3) rect(scribble, 0, y, W - 1, Math.min(H - 1, y + 1));
  const sc = score(scribble);
  eq([sc.ok, sc.excess > 0.5], [false, true], "tô chấm: vẽ nguệch ngoạc khắp nơi → không đạt (nét thừa nhiều)");
  const off = score(rect(rect(grid(), 8, 32, 111, 38), 56, 14, 63, 21));
  eq([off.ok, off.coverage < 0.3], [false, true], "tô chấm: tô lệch xa chữ mẫu → không đạt");
  const near = score(rect(rect(grid(), 8, 24, 111, 30), 56, 6, 63, 13));
  eq(near.ok, true, "tô chấm: lệch nhẹ (trong dung sai) vẫn đạt");
  eq(score(grid()).blank, true, "tô chấm: chưa tô gì → blank");
  eq(scoreTrace({ glyph: grid(), ink: both, w: W, h: H, tolIn: 3, tolOut: 5 }).ok, false, "tô chấm: chữ mẫu rỗng không làm lỗi");
}

// Twemoji
{
  eq([twemojiName("🐶"), twemojiName("☀️"), twemojiName("3️⃣"), twemojiName("👩‍🏫")], ["1f436", "2600", "33-20e3", "1f469-200d-1f3eb"], "twemoji: tên file (bỏ FE0F, giữ nguyên chuỗi ZWJ)");
  eq(twemojiName("👨‍⚕️"), "1f468-200d-2695-fe0f", "twemoji: chuỗi ZWJ giữ FE0F");
  eq(twemojiName("👨‍👩‍👧‍👦"), "1f468-200d-1f469-200d-1f467-200d-1f466", "twemoji: emoji gia đình (ZWJ)");
  eq(graphemes("🐉🌊").length, 2, "twemoji: cảnh 2 emoji = 2 hình");
  eq(graphemes("👨‍👩‍👧‍👦❤️").length, 2, "twemoji: emoji ZWJ dài vẫn là 1 hình");
  eq([isEmojiGrapheme("🐶"), isEmojiGrapheme("a"), isEmojiGrapheme("3️⃣")], [true, false, true], "twemoji: nhận diện emoji (kể cả keycap)");
  eq([emojiUrl("🐶")?.endsWith("/vendor/twemoji/1f436.svg"), emojiUrl("a")], [true, null], "twemoji: emojiUrl có file → đường dẫn, không có → null (rơi về phông máy)");
  eq(TWEMOJI.size > 300, true, "twemoji: chỉ mục có > 300 emoji");
}

// Ảnh minh hoạ + vai trò hình
{
  eq([fitSize(2000, 1000), fitSize(300, 200), fitSize(1000, 4000), fitSize(1, 1)], [{ w: 512, h: 256 }, { w: 300, h: 200 }, { w: 128, h: 512 }, { w: 1, h: 1 }], "ảnh: fitSize thu nhỏ cạnh dài ≤ 512, không phóng to, giữ tỉ lệ");
  eq(MAX_SIDE, 512, "ảnh: cạnh dài tối đa 512");
  eq([slugify("bánh chưng"), slugify("Đà Nẵng"), slugify("  Hà  Nội! "), slugify("")], ["banh-chung", "da-nang", "ha-noi", ""], "ảnh: slugify bỏ dấu, đ → d");
  eq(baseName("bánh chưng.final.png"), "bánh chưng.final", "ảnh: baseName bỏ đuôi cuối");
  const items = [{ id: 1, text_vi: "bánh chưng" }, { id: 2, text_vi: "ba" }, { id: 3, text_vi: "bà" }, { id: 4, text_vi: "Đà Nẵng" }];
  const f = (n) => ({ name: n });
  const m = matchFiles([f("bánh chưng.png"), f("banh-chung.webp"), f("bà.jpg"), f("ba.png"), f("da-nang.png"), f("la-lung.png")], items);
  eq(m.matched.map((x) => x.item.id + ":" + x.file.name), ["1:bánh chưng.png", "1:banh-chung.webp", "3:bà.jpg", "2:ba.png", "4:da-nang.png"], "ảnh: ghép file theo tên (đúng dấu trước, không dấu nếu duy nhất)");
  eq(m.unmatched, ["la-lung.png"], "ảnh: file không khớp mục nào");
  eq(matchFiles([f("Ba.png")], [{ id: 2, text_vi: "ba" }, { id: 3, text_vi: "bà" }]).matched[0].item.id, 2, "ảnh: khớp đúng chữ (không phân biệt hoa/thường) ưu tiên");
  eq(matchFiles([f("ma.png")], [{ id: 5, text_vi: "má" }, { id: 6, text_vi: "mạ" }]).ambiguous, ["ma.png"], "ảnh: tên không dấu mà ứng với ≥2 mục → báo mơ hồ, không ghép bừa");
  eq([checkImageFile({ type: "image/png", name: "a.png", size: 1000 }), checkImageFile({ type: "image/svg+xml", name: "a.svg", size: 10 })?.includes("SVG"), checkImageFile({ type: "text/plain", name: "a.txt", size: 1 })?.includes("ảnh"), checkImageFile({ type: "image/png", name: "a.png", size: 13e6 })?.includes("12 MB")], [null, true, true, true], "ảnh: từ chối SVG / không phải ảnh / quá lớn");
  eq([isLiteral({ emoji: "🐶" }), isLiteral({ emoji: "🐶", pic: "decor" }), isLiteral({ image_path: "img/x.webp" }), isLiteral({}), isLiteral({ emoji: "🐶", pic: "literal" })], [true, false, true, false, true], "vai trò hình: chỉ hình đúng nghĩa (có hình, không phải decor) được dùng làm đáp án");
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

// Số thứ tự chủ đề trong cấp
{
  const us = [{ id: 5, level: 3, sort_order: 30 }, { id: 1, level: 1, sort_order: 10 }, { id: 2, level: 3, sort_order: 20 }, { id: 3, level: 3, sort_order: 20 }, { id: 4, level: 1, sort_order: 5 }, { id: 6, sort_order: 1 }];
  const n = numberUnits(us);
  eq([n.get(6), n.get(4), n.get(1)], [1, 2, 3], "số thứ tự: theo sort_order trong từng cấp (thiếu level = cấp 1)");
  eq([n.get(2), n.get(3), n.get(5)], [1, 2, 3], "số thứ tự: cấp 3 — hoà sort_order thì theo id");
  eq(numberUnits([]).size, 0, "số thứ tự: rỗng");
  eq(numberUnits(us.filter((x) => x.id !== 2)).get(3), 1, "số thứ tự: bỏ chủ đề (chưa duyệt) thì số liền nhau, không bỏ cách");
}

// Worker
const env = { CENTER_NAME: "Trung tâm A", SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k", LANGUAGES: "de:Deutsch,en:English", ASSETS: { fetch: async () => new Response("asset") } };
const cfg = await (await worker.fetch(new Request("https://a.dev/api/config"), env)).json();
eq(cfg.languages, [{ code: "de", label: "Deutsch" }, { code: "en", label: "English" }], "worker: parse ngôn ngữ");
eq(cfg.centerName, "Trung tâm A", "worker: tên trung tâm");
eq(await (await worker.fetch(new Request("https://a.dev/index.html"), env)).text(), "asset", "worker: file tĩnh qua ASSETS");
eq((await (await worker.fetch(new Request("https://a.dev/api/config"), { ASSETS: env.ASSETS })).json()).languages, [{ code: "de", label: "Deutsch" }], "worker: mặc định ngôn ngữ de");

process.exit(fail);
