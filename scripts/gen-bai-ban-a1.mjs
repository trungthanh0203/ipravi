// Sinh giao-trinh/bai-ban/bai-ban-a1-chao-hoi-gia-dinh.csv (giáo trình "Tiếng Việt Bài Bản", cấp A1, 4 chủ đề:
// Chào hỏi · Gia đình · Số đếm · Màu sắc — 2 chủ đề đầu soạn lúc GĐ 7 bắt đầu (2026-09-27), 2 chủ đề sau thêm
// 2026-09-28 theo yêu cầu "làm tiếp các bài tiếp theo của các chủ đề cấp A1"). CSV Bài Bản để ở
// `giao-trinh/bai-ban/` (KHÔNG phải `giao-trinh/csv/`) vì `supabase/tests/seed.test.mjs` quét TOÀN BỘ file .csv
// trong `giao-trinh/csv/` coi là giáo trình khu TRẺ EM (khác schema hẳn) — để lẫn vào đó sẽ báo lỗi giả "thiếu tên
// dịch/diễn giải" cho unit/lesson của Bài Bản (đã gặp lúc làm, xem KE_HOACH_TIENG_VIET_BAI_BAN.md mục 19). Muốn sửa
// nội dung: sửa mảng `r({...})` bên dưới rồi chạy lại `node scripts/gen-bai-ban-a1.mjs`, đừng sửa tay file CSV đã
// sinh (dễ lệch cột/thiếu dấu ngoặc kép khi câu có dấu phẩy). Đã kiểm qua đúng `admin/bb-csv.js`
// validateRows/buildPlan (0 lỗi, 0 cảnh báo) + thử toàn bộ 4 chủ đề + 4 bài Ôn tập (Boss cuối Unit) bằng
// mock-sb.js, không lỗi console.
// Cột `unit_de`/`lesson_de`/`unit_en`/`lesson_en` (thêm 2026-09-28, cần migration 025 cho `bb_units.title_tr`) chỉ
// điền ở 1 dòng bất kỳ của mỗi chủ đề/bài (buildPlan gộp lại) — CHỈ áp dụng lúc TẠO MỚI, không cập nhật chủ đề/bài
// đã có trong CSDL. 2 chủ đề "Chào hỏi"/"Gia đình" đã được chủ dự án nhập vào Supabase TRƯỚC KHI cột này tồn tại —
// nếu bạn cũng đã nhập rồi, dùng `supabase/seed/005_bb_a1_title_translations.sql` để bù tên dịch cho 2 chủ đề đó
// (đừng nhập lại CSV — nhập lại không tạo trùng nhưng cũng KHÔNG cập nhật tên dịch cho chủ đề/bài đã có).
import { writeFileSync } from "node:fs";

const q = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const HEAD = ["level", "level_name", "can_do", "unit", "unit_emoji", "lesson", "lesson_type", "step_type", "speaker", "vi", "vi2", "pos", "game", "question", "choices", "answer", "examples", "en", "de", "unit_de", "lesson_de", "unit_en", "lesson_en"];
const rows = [];
// r(obj): điền các cột có trong obj, cột còn lại để trống — tránh phải gõ lại toàn bộ 19 cột mỗi dòng.
const r = (obj) => rows.push(HEAD.map((h) => obj[h] ?? ""));

const LEVEL = "A1";

// ============================================================== Unit 1: Chào hỏi
const U1 = "Chào hỏi";
r({ level: LEVEL, level_name: "Sơ cấp 1", can_do: "Chào hỏi, giới thiệu bản thân, nói vài câu đơn giản hằng ngày.",
  unit: U1, unit_emoji: "👋", lesson: "Bài 1: Xin chào", lesson_type: "core", step_type: "dialogue", speaker: "A",
  vi: "Xin chào!", en: "Hello!", de: "Hallo!",
  unit_de: "Begrüßung", unit_en: "Greetings", lesson_de: "Lektion 1: Hallo", lesson_en: "Lesson 1: Hello" });
r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "dialogue", speaker: "B",
  vi: "Xin chào! Bạn khoẻ không?", en: "Hello! How are you?", de: "Hallo! Wie geht es dir?" });
r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "dialogue", speaker: "A",
  vi: "Tôi khoẻ, cảm ơn. Bạn thì sao?", en: "I'm fine, thanks. And you?", de: "Mir geht es gut, danke. Und dir?" });
r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "dialogue", speaker: "B",
  vi: "Tôi cũng khoẻ. Cảm ơn bạn.", en: "I'm fine too. Thank you.", de: "Mir geht es auch gut. Danke." });

r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "vocab", vi: "xin chào", pos: "interj", en: "hello", de: "Hallo" });
r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "vocab", vi: "chào", pos: "interj", en: "hi", de: "Hallo" });
r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "vocab", vi: "bạn", pos: "pron", en: "you", de: "du" });
r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "vocab", vi: "tôi", pos: "pron", en: "I", de: "ich" });
r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "vocab", vi: "khoẻ", pos: "adj", en: "fine, healthy", de: "gut, gesund" });
r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "vocab", vi: "cảm ơn", pos: "interj", en: "thank you", de: "danke" });

r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "grammar", vi: "Chào + đại từ", en: "Hello + pronoun", de: "Hallo + Pronomen",
  examples: "Chào bạn.;Chào anh." });

r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "phonics", vi: "ch", vi2: "tr", examples: "cha - tra" });

r({ level: LEVEL, unit: U1, lesson: "Bài 1: Xin chào", step_type: "minigame", game: "meaning_pick" });

r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", lesson_type: "core", step_type: "dialogue", speaker: "A",
  vi: "Bạn tên gì?", en: "What's your name?", de: "Wie heißt du?",
  lesson_de: "Lektion 2: Wie heißt du?", lesson_en: "Lesson 2: What's Your Name?" });
r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "dialogue", speaker: "B",
  vi: "Tôi tên là Mai. Bạn tên gì?", en: "My name is Mai. What's your name?", de: "Ich heiße Mai. Wie heißt du?" });
r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "dialogue", speaker: "A",
  vi: "Tôi tên là Nam. Rất vui được gặp bạn.", en: "My name is Nam. Nice to meet you.", de: "Ich heiße Nam. Freut mich, dich kennenzulernen." });
r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "dialogue", speaker: "B",
  vi: "Tôi cũng rất vui được gặp bạn.", en: "Nice to meet you too.", de: "Mich auch, freut mich." });

r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "vocab", vi: "tên", pos: "n", en: "name", de: "der Name" });
r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "vocab", vi: "là", pos: "v", en: "to be, is", de: "sein, ist" });
r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "vocab", vi: "gì", pos: "pron", en: "what", de: "was" });
r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "vocab", vi: "rất", pos: "adv", en: "very", de: "sehr" });
r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "vocab", vi: "vui", pos: "adj", en: "happy, glad", de: "froh" });
r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "vocab", vi: "gặp", pos: "v", en: "to meet", de: "treffen" });

r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "grammar", vi: "Tôi tên là + tên", en: "My name is + name", de: "Ich heiße + Name",
  examples: "Tôi tên là Mai.;Tôi tên là Nam." });

r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "phonics", vi: "d", vi2: "r", examples: "da - ra" });

r({ level: LEVEL, unit: U1, lesson: "Bài 2: Bạn tên gì?", step_type: "minigame", game: "sentence_builder" });

r({ level: LEVEL, unit: U1, lesson: "Bài 3: Ôn tập", lesson_type: "review", step_type: "dialogue", speaker: "A",
  vi: "Xin chào! Bạn tên gì?", en: "Hello! What's your name?", de: "Hallo! Wie heißt du?",
  lesson_de: "Lektion 3: Wiederholung", lesson_en: "Lesson 3: Review" });
r({ level: LEVEL, unit: U1, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "B",
  vi: "Tôi tên là Hoa. Bạn khoẻ không?", en: "My name is Hoa. How are you?", de: "Ich heiße Hoa. Wie geht es dir?" });
r({ level: LEVEL, unit: U1, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "A",
  vi: "Tôi khoẻ, cảm ơn. Rất vui được gặp bạn.", en: "I'm fine, thanks. Nice to meet you.", de: "Mir geht es gut, danke. Freut mich, dich kennenzulernen." });
r({ level: LEVEL, unit: U1, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "B",
  vi: "Tôi cũng rất vui được gặp bạn.", en: "Nice to meet you too.", de: "Mich auch, freut mich." });
r({ level: LEVEL, unit: U1, lesson: "Bài 3: Ôn tập", step_type: "minigame", game: "meaning_pick" });

// ============================================================== Unit 2: Gia đình
const U2 = "Gia đình";
r({ level: LEVEL, unit: U2, unit_emoji: "👪", lesson: "Bài 1: Gia đình tôi", lesson_type: "core", step_type: "dialogue", speaker: "A",
  vi: "Đây là gia đình tôi.", en: "This is my family.", de: "Das ist meine Familie.",
  unit_de: "Familie", unit_en: "Family", lesson_de: "Lektion 1: Meine Familie", lesson_en: "Lesson 1: My Family" });
r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "dialogue", speaker: "B",
  vi: "Đây là ai?", en: "Who is this?", de: "Wer ist das?" });
r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "dialogue", speaker: "A",
  vi: "Đây là bố tôi, đây là mẹ tôi.", en: "This is my dad, this is my mom.", de: "Das ist mein Vater, das ist meine Mutter." });
r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "dialogue", speaker: "B",
  vi: "Gia đình bạn có mấy người?", en: "How many people are in your family?", de: "Wie viele Personen sind in deiner Familie?" });

r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "vocab", vi: "gia đình", pos: "n", en: "family", de: "die Familie" });
r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "vocab", vi: "bố", pos: "n", en: "dad", de: "der Vater" });
r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "vocab", vi: "mẹ", pos: "n", en: "mom", de: "die Mutter" });
r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "vocab", vi: "anh", pos: "n", en: "older brother", de: "der ältere Bruder" });
r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "vocab", vi: "chị", pos: "n", en: "older sister", de: "die ältere Schwester" });
r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "vocab", vi: "em", pos: "n", en: "younger sibling", de: "das jüngere Geschwister" });

r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "grammar", vi: "Đây là + danh từ", en: "This is + noun", de: "Das ist + Nomen",
  examples: "Đây là bố tôi.;Đây là mẹ tôi." });

r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "phonics", vi: "s", vi2: "x", examples: "sa - xa" });

r({ level: LEVEL, unit: U2, lesson: "Bài 1: Gia đình tôi", step_type: "minigame", game: "phonics_discrim" });

r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", lesson_type: "core", step_type: "dialogue", speaker: "A",
  vi: "Gia đình bạn có mấy người?", en: "How many people are in your family?", de: "Wie viele Personen sind in deiner Familie?",
  lesson_de: "Lektion 2: Wie viele Personen sind in deiner Familie?", lesson_en: "Lesson 2: How Many People Are in Your Family?" });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "dialogue", speaker: "B",
  vi: "Gia đình tôi có bốn người: bố, mẹ, tôi và em tôi.", en: "My family has four people: dad, mom, me, and my younger sibling.",
  de: "Meine Familie hat vier Personen: Vater, Mutter, ich und mein jüngeres Geschwister." });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "dialogue", speaker: "A",
  vi: "Bạn có anh chị không?", en: "Do you have older siblings?", de: "Hast du ältere Geschwister?" });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "dialogue", speaker: "B",
  vi: "Không, tôi không có anh chị.", en: "No, I don't have older siblings.", de: "Nein, ich habe keine älteren Geschwister." });

r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "vocab", vi: "mấy", pos: "pron", en: "how many", de: "wie viele" });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "vocab", vi: "người", pos: "n", en: "person", de: "die Person" });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "vocab", vi: "có", pos: "v", en: "to have", de: "haben" });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "vocab", vi: "bốn", pos: "num", en: "four", de: "vier" });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "vocab", vi: "và", pos: "conj", en: "and", de: "und" });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "vocab", vi: "không", pos: "adv", en: "no, not", de: "nein, nicht" });

r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "grammar", vi: "Gia đình + có + số + người",
  en: "Family + has + number + people", de: "Familie + hat + Zahl + Personen",
  examples: "Gia đình tôi có bốn người.;Gia đình bạn có mấy người?" });

r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "reading",
  vi: "Gia đình tôi có bốn người. Bố tôi là bác sĩ. Mẹ tôi là giáo viên. Em tôi còn nhỏ, chưa đi học.",
  en: "My family has four people. My dad is a doctor. My mom is a teacher. My younger sibling is still small and doesn't go to school yet.",
  de: "Meine Familie hat vier Personen. Mein Vater ist Arzt. Meine Mutter ist Lehrerin. Mein jüngeres Geschwister ist noch klein und geht noch nicht in die Schule." });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "reading",
  question: "Gia đình có mấy người?", choices: "Ba người|Bốn người|Năm người|Hai người", answer: 2 });
r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "reading",
  question: "Mẹ làm nghề gì?", choices: "Bác sĩ|Giáo viên|Kỹ sư|Ca sĩ", answer: 2 });

r({ level: LEVEL, unit: U2, lesson: "Bài 2: Gia đình bạn có mấy người?", step_type: "minigame", game: "sentence_builder" });

r({ level: LEVEL, unit: U2, lesson: "Bài 3: Ôn tập", lesson_type: "review", step_type: "dialogue", speaker: "A",
  vi: "Đây là gia đình tôi: bố, mẹ và em tôi.", en: "This is my family: dad, mom, and my younger sibling.",
  de: "Das ist meine Familie: Vater, Mutter und mein jüngeres Geschwister.",
  lesson_de: "Lektion 3: Wiederholung", lesson_en: "Lesson 3: Review" });
r({ level: LEVEL, unit: U2, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "B",
  vi: "Gia đình bạn có mấy người?", en: "How many people are in your family?", de: "Wie viele Personen sind in deiner Familie?" });
r({ level: LEVEL, unit: U2, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "A",
  vi: "Gia đình tôi có bốn người.", en: "My family has four people.", de: "Meine Familie hat vier Personen." });
r({ level: LEVEL, unit: U2, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "B",
  vi: "Bạn có anh chị không?", en: "Do you have older siblings?", de: "Hast du ältere Geschwister?" });
r({ level: LEVEL, unit: U2, lesson: "Bài 3: Ôn tập", step_type: "minigame", game: "phonics_discrim" });

// ============================================================== Unit 3: Số đếm
const U3 = "Số đếm";
r({ level: LEVEL, unit: U3, unit_emoji: "🔢", lesson: "Bài 1: Một đến năm", lesson_type: "core", step_type: "dialogue", speaker: "A",
  vi: "Bạn có mấy quyển sách?", en: "How many books do you have?", de: "Wie viele Bücher hast du?",
  unit_de: "Zahlen", unit_en: "Numbers", lesson_de: "Lektion 1: Eins bis fünf", lesson_en: "Lesson 1: One to Five" });
r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "dialogue", speaker: "B",
  vi: "Tôi có ba quyển sách.", en: "I have three books.", de: "Ich habe drei Bücher." });
r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "dialogue", speaker: "A",
  vi: "Còn bút thì sao?", en: "What about pens?", de: "Und wie viele Stifte?" });
r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "dialogue", speaker: "B",
  vi: "Tôi có năm cái bút.", en: "I have five pens.", de: "Ich habe fünf Stifte." });

r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "vocab", vi: "một", pos: "num", en: "one", de: "eins" });
r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "vocab", vi: "hai", pos: "num", en: "two", de: "zwei" });
r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "vocab", vi: "ba", pos: "num", en: "three", de: "drei" });
r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "vocab", vi: "bốn", pos: "num", en: "four", de: "vier" });
r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "vocab", vi: "năm", pos: "num", en: "five", de: "fünf" });
r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "vocab", vi: "quyển sách", pos: "n", en: "book", de: "das Buch" });
r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "vocab", vi: "cái bút", pos: "n", en: "pen", de: "der Stift" });

r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "grammar", vi: "Số + danh từ", en: "Number + noun", de: "Zahl + Nomen",
  examples: "ba quyển sách;năm cái bút" });

r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "phonics", vi: "l", vi2: "n", examples: "la - na" });

r({ level: LEVEL, unit: U3, lesson: "Bài 1: Một đến năm", step_type: "minigame", game: "meaning_pick" });

r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", lesson_type: "core", step_type: "dialogue", speaker: "A",
  vi: "Táo giá bao nhiêu?", en: "How much are the apples?", de: "Wie viel kosten die Äpfel?",
  lesson_de: "Lektion 2: Sechs bis zehn", lesson_en: "Lesson 2: Six to Ten" });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "dialogue", speaker: "B",
  vi: "Táo giá năm nghìn đồng một quả.", en: "Apples are five thousand dong each.", de: "Äpfel kosten fünftausend Dong pro Stück." });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "dialogue", speaker: "A",
  vi: "Còn cam thì sao?", en: "What about oranges?", de: "Und wie viel kosten die Orangen?" });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "dialogue", speaker: "B",
  vi: "Cam giá bảy nghìn đồng một quả.", en: "Oranges are seven thousand dong each.", de: "Orangen kosten siebentausend Dong pro Stück." });

r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "vocab", vi: "sáu", pos: "num", en: "six", de: "sechs" });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "vocab", vi: "bảy", pos: "num", en: "seven", de: "sieben" });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "vocab", vi: "tám", pos: "num", en: "eight", de: "acht" });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "vocab", vi: "chín", pos: "num", en: "nine", de: "neun" });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "vocab", vi: "mười", pos: "num", en: "ten", de: "zehn" });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "vocab", vi: "giá", pos: "n", en: "price", de: "der Preis" });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "vocab", vi: "bao nhiêu", pos: "pron", en: "how much", de: "wie viel" });

r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "grammar", vi: "... giá bao nhiêu?", en: "How much is ...?", de: "Wie viel kostet ...?",
  examples: "Táo giá bao nhiêu?;Táo giá năm nghìn đồng." });

r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "phonics", vi: "d", vi2: "gi", examples: "da - gia" });

r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "reading",
  vi: "Ở chợ có táo và cam. Táo giá năm nghìn đồng một quả. Cam giá bảy nghìn đồng một quả. Táo rẻ hơn cam.",
  en: "At the market there are apples and oranges. Apples cost five thousand dong each. Oranges cost seven thousand dong each. Apples are cheaper than oranges.",
  de: "Auf dem Markt gibt es Äpfel und Orangen. Äpfel kosten fünftausend Dong pro Stück. Orangen kosten siebentausend Dong pro Stück. Äpfel sind billiger als Orangen." });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "reading",
  question: "Táo giá bao nhiêu?", choices: "Năm nghìn đồng|Sáu nghìn đồng|Bảy nghìn đồng|Tám nghìn đồng", answer: 1 });
r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "reading",
  question: "Quả nào rẻ hơn?", choices: "Cam|Táo|Cả hai bằng nhau|Không quả nào", answer: 2 });

r({ level: LEVEL, unit: U3, lesson: "Bài 2: Sáu đến mười", step_type: "minigame", game: "sentence_builder" });

r({ level: LEVEL, unit: U3, lesson: "Bài 3: Ôn tập", lesson_type: "review", step_type: "dialogue", speaker: "A",
  vi: "Bạn có mấy quyển sách?", en: "How many books do you have?", de: "Wie viele Bücher hast du?",
  lesson_de: "Lektion 3: Wiederholung", lesson_en: "Lesson 3: Review" });
r({ level: LEVEL, unit: U3, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "B",
  vi: "Tôi có năm quyển sách. Táo giá bao nhiêu?", en: "I have five books. How much are the apples?", de: "Ich habe fünf Bücher. Wie viel kosten die Äpfel?" });
r({ level: LEVEL, unit: U3, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "A",
  vi: "Táo giá bảy nghìn đồng một quả.", en: "Apples are seven thousand dong each.", de: "Äpfel kosten siebentausend Dong pro Stück." });
r({ level: LEVEL, unit: U3, lesson: "Bài 3: Ôn tập", step_type: "minigame", game: "meaning_pick" });

// ============================================================== Unit 4: Màu sắc
const U4 = "Màu sắc";
r({ level: LEVEL, unit: U4, unit_emoji: "🎨", lesson: "Bài 1: Màu cơ bản", lesson_type: "core", step_type: "dialogue", speaker: "A",
  vi: "Bạn thích màu gì?", en: "What color do you like?", de: "Welche Farbe magst du?",
  unit_de: "Farben", unit_en: "Colors", lesson_de: "Lektion 1: Die Grundfarben", lesson_en: "Lesson 1: Basic Colors" });
r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "dialogue", speaker: "B",
  vi: "Tôi thích màu đỏ. Bạn thích màu gì?", en: "I like red. What color do you like?", de: "Ich mag Rot. Welche Farbe magst du?" });
r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "dialogue", speaker: "A",
  vi: "Tôi thích màu xanh.", en: "I like blue.", de: "Ich mag Blau." });
r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "dialogue", speaker: "B",
  vi: "Màu xanh rất đẹp.", en: "Blue is very pretty.", de: "Blau ist sehr schön." });

r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "vocab", vi: "đỏ", pos: "adj", en: "red", de: "rot" });
r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "vocab", vi: "xanh", pos: "adj", en: "blue, green", de: "blau, grün" });
r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "vocab", vi: "vàng", pos: "adj", en: "yellow", de: "gelb" });
r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "vocab", vi: "trắng", pos: "adj", en: "white", de: "weiß" });
r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "vocab", vi: "đen", pos: "adj", en: "black", de: "schwarz" });
r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "vocab", vi: "thích", pos: "v", en: "to like", de: "mögen" });

r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "grammar", vi: "Tôi thích + màu", en: "I like + color", de: "Ich mag + Farbe",
  examples: "Tôi thích màu đỏ.;Tôi thích màu xanh." });

r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "phonics", vi: "ch", vi2: "tr", examples: "cha - tra" });

r({ level: LEVEL, unit: U4, lesson: "Bài 1: Màu cơ bản", step_type: "minigame", game: "phonics_discrim" });

r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", lesson_type: "core", step_type: "dialogue", speaker: "A",
  vi: "Đây là hình gì?", en: "What shape is this?", de: "Was für eine Form ist das?",
  lesson_de: "Lektion 2: Formen", lesson_en: "Lesson 2: Shapes" });
r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "dialogue", speaker: "B",
  vi: "Đây là hình vuông màu đỏ.", en: "This is a red square.", de: "Das ist ein rotes Quadrat." });
r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "dialogue", speaker: "A",
  vi: "Còn đây?", en: "And this one?", de: "Und das hier?" });
r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "dialogue", speaker: "B",
  vi: "Đây là hình tròn màu vàng.", en: "This is a yellow circle.", de: "Das ist ein gelber Kreis." });

r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "vocab", vi: "hình vuông", pos: "n", en: "square", de: "das Quadrat" });
r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "vocab", vi: "hình tròn", pos: "n", en: "circle", de: "der Kreis" });
r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "vocab", vi: "hình tam giác", pos: "n", en: "triangle", de: "das Dreieck" });
r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "vocab", vi: "to", pos: "adj", en: "big", de: "groß" });
r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "vocab", vi: "nhỏ", pos: "adj", en: "small", de: "klein" });

r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "grammar", vi: "Đây là + hình + màu", en: "This is a + shape + color", de: "Das ist ein/e + Form + Farbe",
  examples: "Đây là hình vuông màu đỏ.;Đây là hình tròn màu vàng." });

r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "phonics", vi: "s", vi2: "x", examples: "sa - xa" });

r({ level: LEVEL, unit: U4, lesson: "Bài 2: Hình dạng", step_type: "minigame", game: "meaning_pick" });

r({ level: LEVEL, unit: U4, lesson: "Bài 3: Ôn tập", lesson_type: "review", step_type: "dialogue", speaker: "A",
  vi: "Bạn thích màu gì?", en: "What color do you like?", de: "Welche Farbe magst du?",
  lesson_de: "Lektion 3: Wiederholung", lesson_en: "Lesson 3: Review" });
r({ level: LEVEL, unit: U4, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "B",
  vi: "Tôi thích màu đỏ. Đây là hình vuông màu đỏ.", en: "I like red. This is a red square.", de: "Ich mag Rot. Das ist ein rotes Quadrat." });
r({ level: LEVEL, unit: U4, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "A",
  vi: "Còn đây là hình tròn màu vàng.", en: "And this is a yellow circle.", de: "Und das ist ein gelber Kreis." });
r({ level: LEVEL, unit: U4, lesson: "Bài 3: Ôn tập", step_type: "minigame", game: "phonics_discrim" });

const text = [HEAD.join(","), ...rows.map((row) => row.map(q).join(","))].join("\n") + "\n";
writeFileSync("giao-trinh/bai-ban/bai-ban-a1-chao-hoi-gia-dinh.csv", text, "utf8");
console.log(`Đã ghi ${rows.length} dòng.`);
