// Danh mục "kỹ năng" cho màn Luyện tập của "Tiếng Việt Bài Bản" — đơn giản hơn 12 kỹ năng bên khu trẻ em
// (xem KE_HOACH_TIENG_VIET_BAI_BAN.md GĐ 4: "SRS từ vựng kiểu Leitner, ôn hội thoại, ôn ngữ pháp/ngữ âm").
// `graded: true` (chỉ 'vocab') = có tự đánh giá Nhớ/Quên + box Leitner thật; còn lại chỉ "xem lại", không chấm.
// GROUPS: khớp cách khu trẻ em nhóm kỹ năng theo màu (child/skills.js) — chỉ 2 nhóm vì Bài Bản mới có 4 kỹ năng,
// màu lấy lại ĐÚNG 2 màu đã dùng bên khu trẻ em (cam = xây dựng/cấu trúc câu, xanh = nghe–nói) để nhất quán màu
// trong toàn app, không tự đặt bảng màu riêng.
export const GROUPS = [
  { id: "words", name: "Từ vựng – Ngữ pháp", color: "#e8590c", soft: "#fff1e6" },
  { id: "listen", name: "Hội thoại – Ngữ âm", color: "#3b82f6", soft: "#e7f0ff" },
];
export const SKILLS = [
  { id: "vocab", group: "words", itemType: "vocab", emoji: "🔤", name: "Từ vựng", graded: true },
  { id: "grammar", group: "words", itemType: "grammar", emoji: "📐", name: "Ngữ pháp", graded: false },
  { id: "dialogue", group: "listen", itemType: "dialogue", emoji: "💬", name: "Hội thoại", graded: false },
  { id: "phonics", group: "listen", itemType: "phonics", emoji: "🎧", name: "Ngữ âm", graded: false },
];
export const groupById = (id) => GROUPS.find((g) => g.id === id);
