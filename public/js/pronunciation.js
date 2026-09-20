// Chấm phát âm MVP — cùng cách iLapra: dùng Web Speech API của trình duyệt để nhận dạng lời nói
// thành chữ, rồi so chữ nhận được với câu mẫu. KHÔNG phải chấm âm vị/thanh điệu thật (xem mục
// 4.6 tài liệu yêu cầu). Hàm chấm tách riêng để sau này thay bằng dịch vụ chuyên dụng.

const SpeechRecognitionCtor = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const pronunciationSupported = () => Boolean(SpeechRecognitionCtor);

// Giữ nguyên dấu thanh khi so khớp (chỉ hạ chữ thường, chuẩn hoá NFC, bỏ dấu câu).
export function tokenize(text) {
  return String(text || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,!?;:"“”'‘’()\-–—…]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Từ loại đứng đầu ("con gà", "màu đỏ", "quả táo"...) KHÔNG được tính điểm: nếu tính thì nói sai hẳn
// "con vịt" thay vì "con gà" vẫn trùng 1/2 từ và được ~50 điểm. Bỏ ở cả 2 phía (trẻ chỉ nói "gà" vẫn đủ điểm).
const CLASSIFIERS = new Set(["con", "cái", "chiếc", "quả", "trái", "cây", "bông", "hoa", "màu"]);
const stripClassifier = (tokens) => (tokens.length > 1 && CLASSIFIERS.has(tokens[0]) ? tokens.slice(1) : tokens);

// 0–100: mức giống nhau giữa câu mẫu và chữ nhận dạng được (theo từ).
export function scorePronunciation(targetText, transcript) {
  const t = stripClassifier(tokenize(targetText));
  const h = stripClassifier(tokenize(transcript));
  if (t.length === 0) return 0;
  const dist = editDistance(t, h);
  return Math.max(0, Math.round((1 - dist / Math.max(t.length, h.length || 1)) * 100));
}

// Mức phản hồi cho trẻ: ngưỡng DỄ, không có mức "sai" — chỉ "thử lại". Sẽ chỉnh sau khi thử với giọng trẻ thật.
export function tier(score) {
  if (score >= 80) return { stars: 3, key: "excellent" };
  if (score >= 55) return { stars: 2, key: "good" };
  if (score >= 30) return { stars: 1, key: "ok" };
  return { stars: 0, key: "retry" };
}

// Nghe 1 lượt, trả về Promise<chữ nhận dạng được> (rỗng nếu không nghe thấy).
export function recognizeOnce(lang = "vi-VN") {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognitionCtor) return reject(new Error("unsupported"));
    const rec = new SpeechRecognitionCtor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let text = "";
    rec.onresult = (e) => {
      text = e.results[0]?.[0]?.transcript ?? "";
    };
    rec.onerror = (e) => (e.error === "no-speech" ? resolve("") : reject(new Error(e.error)));
    rec.onend = () => resolve(text);
    rec.start();
  });
}
