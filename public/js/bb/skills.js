// Danh mục "kỹ năng" cho màn Luyện tập của "Tiếng Việt Bài Bản" — đơn giản hơn 12 kỹ năng bên khu trẻ em
// (xem KE_HOACH_TIENG_VIET_BAI_BAN.md GĐ 4: "SRS từ vựng kiểu Leitner, ôn hội thoại, ôn ngữ pháp/ngữ âm").
// `graded: true` (chỉ 'vocab') = có tự đánh giá Nhớ/Quên + box Leitner thật; còn lại chỉ "xem lại", không chấm.
export const SKILLS = [
  { id: "vocab", itemType: "vocab", emoji: "🔤", name: "Từ vựng", graded: true },
  { id: "dialogue", itemType: "dialogue", emoji: "💬", name: "Hội thoại", graded: false },
  { id: "grammar", itemType: "grammar", emoji: "📐", name: "Ngữ pháp", graded: false },
  { id: "phonics", itemType: "phonics", emoji: "🎧", name: "Ngữ âm", graded: false },
];
