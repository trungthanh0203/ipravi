// Đoán giới (nữ/nam) từ TÊN giọng — nguồn duy nhất, dùng chung cho Worker (tts.js) và trình duyệt (admin).
// Chỉ để CHỐNG NHẦM khi cấu hình (vd nhập giọng nam vào ô giọng nữ); tên lạ trả về null (không đoán).
// Danh sách chỉ gồm giọng đã biết (mặc định trong tts.js và vài giọng phổ biến khác của Azure).

const MALE = new Set(["NamMinh", "InJoon", "Keita", "Conrad", "Guy", "Davis", "Henri", "Alvaro", "Diego", "Yunxi", "Antonio", "Maarten", "Marek", "Dmitry", "Niwat", "Antonin"]);
const FEMALE = new Set(["HoaiMy", "Katja", "Jenny", "Ana", "Aria", "SunHi", "Nanami", "Denise", "Elvira", "Elsa", "Xiaoxiao", "Francisca", "Colette", "Zofia", "Svetlana", "Premwadee", "Vlasta"]);
// Google đặt tên theo chữ cái, chỉ liệt kê các giọng mặc định đã dùng trong tts.js.
const MALE_FULL = new Set(["vi-VN-Wavenet-B", "de-DE-Wavenet-B", "en-US-Neural2-A"]);
const FEMALE_FULL = new Set(["vi-VN-Wavenet-A", "de-DE-Wavenet-A", "en-US-Neural2-C"]);

export function guessGender(voiceName) {
  const name = String(voiceName ?? "").trim();
  if (!name) return null;
  if (MALE_FULL.has(name)) return "male";
  if (FEMALE_FULL.has(name)) return "female";
  const tail = name.split("-").slice(2).join("-").replace(/Neural$/i, "");
  if (MALE.has(tail)) return "male";
  if (FEMALE.has(tail)) return "female";
  return null;
}
