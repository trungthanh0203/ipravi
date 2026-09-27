// Sinh giao-trinh/csv/bai-ban-a1-chao-hoi-gia-dinh.csv (giáo trình "Tiếng Việt Bài Bản", cấp A1, 2 chủ đề: Chào
// hỏi + Gia đình) — cùng cách các script sinh giáo trình khu trẻ em hoạt động (vd hinh-can-ve.mjs). Muốn sửa nội
// dung: sửa mảng `r({...})` bên dưới rồi chạy lại `node scripts/gen-bai-ban-a1.mjs`, đừng sửa tay file CSV đã sinh
// (dễ lệch cột/thiếu dấu ngoặc kép khi câu có dấu phẩy). Đã kiểm qua đúng `admin/bb-csv.js` validateRows/buildPlan
// (0 lỗi, 0 cảnh báo) + thử toàn bộ 2 bài + 2 bài Ôn tập (Boss cuối Unit) bằng mock-sb.js, không lỗi console.
import { writeFileSync } from "node:fs";

const q = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const HEAD = ["level", "level_name", "can_do", "unit", "unit_emoji", "lesson", "lesson_type", "step_type", "speaker", "vi", "vi2", "pos", "game", "question", "choices", "answer", "examples", "en", "de"];
const rows = [];
// r(obj): điền các cột có trong obj, cột còn lại để trống — tránh phải gõ lại toàn bộ 19 cột mỗi dòng.
const r = (obj) => rows.push(HEAD.map((h) => obj[h] ?? ""));

const LEVEL = "A1";

// ============================================================== Unit 1: Chào hỏi
const U1 = "Chào hỏi";
r({ level: LEVEL, level_name: "Sơ cấp 1", can_do: "Chào hỏi, giới thiệu bản thân, nói vài câu đơn giản hằng ngày.",
  unit: U1, unit_emoji: "👋", lesson: "Bài 1: Xin chào", lesson_type: "core", step_type: "dialogue", speaker: "A",
  vi: "Xin chào!", en: "Hello!", de: "Hallo!" });
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
  vi: "Bạn tên gì?", en: "What's your name?", de: "Wie heißt du?" });
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
  vi: "Xin chào! Bạn tên gì?", en: "Hello! What's your name?", de: "Hallo! Wie heißt du?" });
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
  vi: "Đây là gia đình tôi.", en: "This is my family.", de: "Das ist meine Familie." });
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
  vi: "Gia đình bạn có mấy người?", en: "How many people are in your family?", de: "Wie viele Personen sind in deiner Familie?" });
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
  de: "Das ist meine Familie: Vater, Mutter und mein jüngeres Geschwister." });
r({ level: LEVEL, unit: U2, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "B",
  vi: "Gia đình bạn có mấy người?", en: "How many people are in your family?", de: "Wie viele Personen sind in deiner Familie?" });
r({ level: LEVEL, unit: U2, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "A",
  vi: "Gia đình tôi có bốn người.", en: "My family has four people.", de: "Meine Familie hat vier Personen." });
r({ level: LEVEL, unit: U2, lesson: "Bài 3: Ôn tập", step_type: "dialogue", speaker: "B",
  vi: "Bạn có anh chị không?", en: "Do you have older siblings?", de: "Hast du ältere Geschwister?" });
r({ level: LEVEL, unit: U2, lesson: "Bài 3: Ôn tập", step_type: "minigame", game: "phonics_discrim" });

const text = [HEAD.join(","), ...rows.map((row) => row.map(q).join(","))].join("\n") + "\n";
writeFileSync("giao-trinh/csv/bai-ban-a1-chao-hoi-gia-dinh.csv", text, "utf8");
console.log(`Đã ghi ${rows.length} dòng.`);
