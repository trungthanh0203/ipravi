// Chữ giao diện của khu admin (tiếng Việt). Chữ của phụ huynh/trẻ nằm ở ../strings.js.
export const A = {
  title: "Quản trị",
  tabs: { content: "Trẻ em", bb: "Bài Bản", record: "Thu âm", parents: "Phụ huynh", billing: "Học phí & thanh toán", settings: "Cài đặt" },
  teacherSoon: "Vai trò giáo viên hỗ trợ sẽ làm ở giai đoạn sau.",
  loading: "Đang tải…",
  loadError: "Không tải được dữ liệu: ",
  draft: "Nháp",
  approved: "Đã duyệt",
  save: "Lưu",
  delete: "Xoá",
  cancel: "Huỷ",
  confirm: "Xác nhận",
};

export const CSV_HELP =
  "Cột bắt buộc: unit (chủ đề), lesson (bài), vi (từ/câu tiếng Việt). Cột tuỳ chọn: unit_emoji, level (cấp 1–4, để trống = cấp 1), emoji, type " +
  "(word | phrase | sentence | story | song | letter | syllable), say (chữ để đọc thành tiếng khi khác chữ hiển thị, vd chữ “b” đọc là “bờ”), activities (bộ hoạt động cho bài mới, cách nhau bằng khoảng trắng: listen_pick match listen_pick_text listen_repeat listen_pick_tone build_syllable fill_letter read_pick order_words read_quiz fill_word write_check spell_word order_story spell_along match_case pick_case fix_capital trace), choices + answer (câu hỏi đọc hiểu: đáp án cách nhau bằng dấu |, answer = số thứ tự đáp án đúng), pic (literal = hình đúng nghĩa, dùng để chọn/ghép; decor = chỉ trang trí; trống = literal), min_age, max_age (0–12), mỗi ngôn ngữ 1 cột nghĩa (de, en…), và (tuỳ chọn) tên chủ đề/bài bằng ngôn ngữ gốc ở cột unit_de, lesson_de… để bé bấm 🔊 nghe tên. " +
  "Nhập lại file cũ sẽ cập nhật mục đã có (không tạo trùng); ô trống không xoá dữ liệu cũ. " +
  "Mục nhập vào luôn ở trạng thái NHÁP — bé chỉ thấy sau khi bạn bấm Duyệt.";

// Câu lệnh mẫu để dán vào AI (ChatGPT, Claude...) rồi tải kết quả dưới dạng CSV.
export function aiPrompt(langs) {
  const cols = ["unit", "unit_emoji", "level", "lesson", "vi", "emoji", "type", "min_age", "max_age", ...langs].join(",");
  return `Bạn là giáo viên tiếng Việt cho trẻ em gốc Việt 3–8 tuổi sống ở nước ngoài. Hãy soạn nội dung học về chủ đề: [ĐIỀN CHỦ ĐỀ, ví dụ: "Gia đình"].

Trả về DUY NHẤT một file CSV (UTF-8, phân cách bằng dấu phẩy, dòng đầu là tiêu đề) với đúng các cột:
${cols}

Quy tắc:
- unit: tên chủ đề (ngắn, tiếng Việt). unit_emoji: 1 emoji đại diện chủ đề.
- level: cấp của chủ đề — 1 (Trứng: nghe, nhận biết, nói từ), 2 (Gà con: nói câu ngắn), 3 (Gà choai: học vần, chữ cái), 4 (Gà trống: đọc hiểu, viết). Mọi dòng cùng chủ đề ghi cùng 1 số.
- lesson: tên bài, mỗi bài 5–10 mục từ. Chia chủ đề thành 1–3 bài từ dễ đến khó.
- vi: từ hoặc cụm từ tiếng Việt đầy đủ dấu thanh, dùng từ đời thường trẻ em hay nghe (ví dụ "con chó", "màu đỏ", "bà ngoại").
- emoji: đúng 1 emoji mô tả rõ nghĩa của từ. Nếu không có emoji phù hợp thì để trống.
- type: word (từ đơn/cụm ngắn), phrase (cụm từ), sentence (câu ngắn).
- min_age, max_age: độ tuổi phù hợp (số nguyên 3–8).
- ${langs.map((l) => `Cột "${l}": nghĩa của từ bằng ngôn ngữ mã "${l}", ngắn gọn, đúng nghĩa khi dạy trẻ em`).join("\n- ")}
- Với từ có khác biệt vùng miền (Bắc/Nam), chọn cách nói phổ biến nhất và không thêm chú thích trong ô.
- Ô có dấu phẩy phải đặt trong dấu ngoặc kép. Không thêm lời giải thích ngoài file CSV.`;
}

// Tên các loại hoạt động (khi chọn bộ hoạt động cho bài mới).
export const KIND_LABEL = {
  listen_pick: "Nghe – chọn hình", listen_pick_text: "Nghe – chọn chữ", match: "Nối hình với chữ", listen_repeat: "Nghe – nói theo", listen_pick_tone: "Nghe – chọn dấu thanh",
  build_syllable: "Ghép âm + vần", fill_letter: "Điền chữ còn thiếu", read_pick: "Đọc – chạm hình", order_words: "Xếp từ thành câu", read_quiz: "Đọc đoạn – trả lời câu hỏi",
  fill_word: "Điền từ vào câu", write_check: "Chọn câu viết đúng", spell_word: "Xếp chữ cái thành từ", order_story: "Xếp câu thành chuyện", spell_along: "Đánh vần theo phần",
  match_case: "Ghép chữ hoa – thường", pick_case: "Chọn chữ hoa/thường", fix_capital: "Chạm chữ cần viết hoa", trace: "Tô chữ",
  dialogue: "Bài giao tiếp (hỏi–đáp)",
};

// "Thêm nhanh": chỉ gõ chữ Việt, phần còn lại được điền sẵn bằng luật rồi admin xem lại.
export const Q = {
  addUnit: "➕ Thêm chủ đề",
  addLesson: "➕ Thêm bài",
  addItems: "➕ Thêm từ / câu",
  edit: "✎ Sửa",
  unitTitle: "Tên chủ đề (tiếng Việt)",
  lessonTitle: "Tên bài (tiếng Việt)",
  itemsHelp: "Gõ chữ tiếng Việt, mỗi dòng một từ hoặc một câu. Các thông tin còn lại (loại, emoji, nghĩa, cách đọc, độ tuổi) được điền sẵn — xem lại rồi bấm Lưu.",
  autoNote: "Điền sẵn bằng luật + dữ liệu đã có (KHÔNG dùng AI/dịch máy). Ô để trống là chưa có nguồn — bạn điền tay hoặc để trống.",
  srcDb: "từ mục đã có", srcDict: "từ điển", srcRule: "theo luật", srcGuess: (w) => `gợi ý từ “${w}”`,
  missing: "chưa có",
  saveDraft: "Lưu (nháp)",
  ttsAfter: "Sinh âm thanh (TTS) sau khi lưu",
};
