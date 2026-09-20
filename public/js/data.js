// Bộ hình đại diện (tạm bằng emoji). Màn hình chọn avatar hiện TẤT CẢ hình này — chỉ những hình
// đã gán cho hồ sơ con mới cho vào học, nên việc nhớ đúng hình đóng vai "mật khẩu bằng hình".
export const AVATARS = [
  { id: "dog", emoji: "🐶" },
  { id: "cat", emoji: "🐱" },
  { id: "rabbit", emoji: "🐰" },
  { id: "bear", emoji: "🐻" },
  { id: "panda", emoji: "🐼" },
  { id: "frog", emoji: "🐸" },
  { id: "monkey", emoji: "🐵" },
  { id: "lion", emoji: "🦁" },
  { id: "tiger", emoji: "🐯" },
  { id: "pig", emoji: "🐷" },
  { id: "cow", emoji: "🐮" },
  { id: "koala", emoji: "🐨" },
];

export function avatarEmoji(id) {
  return AVATARS.find((a) => a.id === id)?.emoji ?? "❓";
}
