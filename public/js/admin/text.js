// Chữ giao diện của khu admin (tiếng Việt). Chữ của phụ huynh/trẻ nằm ở ../strings.js.
export const A = {
  title: "Quản trị",
  tabs: { content: "Nội dung", record: "Thu âm", import: "Nhập CSV", parents: "Phụ huynh", billing: "Học phí & thanh toán", settings: "Cài đặt" },
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
  "(word | phrase | sentence | story | song | letter | syllable), say (chữ để đọc thành tiếng khi khác chữ hiển thị, vd chữ “b” đọc là “bờ”), activities (bộ hoạt động cho bài mới, cách nhau bằng khoảng trắng: listen_pick match listen_pick_text listen_repeat listen_pick_tone build_syllable fill_letter read_pick order_words read_quiz fill_word write_check spell_word order_story spell_along), choices + answer (câu hỏi đọc hiểu: đáp án cách nhau bằng dấu |, answer = số thứ tự đáp án đúng), min_age, max_age (0–12), và mỗi ngôn ngữ 1 cột nghĩa (de, en…). " +
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
