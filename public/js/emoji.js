import { TWEMOJI } from "./twemoji-index.js";

// Hình emoji ĐỒNG NHẤT trên mọi máy: dùng bộ Twemoji (jdecked/twemoji, CC-BY 4.0) tự lưu ở /vendor/twemoji/ thay vì phông emoji của hệ điều hành
// (mỗi hệ vẽ một kiểu; máy cũ hiện ô vuông với emoji mới). Mỗi emoji là 1 file SVG nhỏ (~1 KB) tải KHI CẦN + Service Worker cache-trước
// → không tải trước cả bộ. Emoji chưa có trong bộ (twemoji-index.js do scripts/vendor-twemoji.mjs sinh) → rơi về phông của máy, không lỗi.
// Hàm thuần (twemojiName, graphemes) có test trong tests/unit.test.mjs.

// Tên file Twemoji: các điểm mã viết thường nối bằng "-"; bỏ FE0F (dạng emoji) trừ khi là chuỗi ZWJ (đúng quy ước của Twemoji).
export function twemojiName(g) {
  const cps = [...g].map((c) => c.codePointAt(0).toString(16));
  return (g.includes("‍") ? cps : cps.filter((c) => c !== "fe0f")).join("-");
}
export const graphemes = (s) => [...new Intl.Segmenter().segment(String(s ?? ""))].map((x) => x.segment);
export const isEmojiGrapheme = (g) => /\p{Extended_Pictographic}|⃣/u.test(g);

const BASE = new URL("../vendor/twemoji/", import.meta.url).pathname;
export function emojiUrl(g) {
  const n = twemojiName(g);
  return TWEMOJI.has(n) ? `${BASE}${n}.svg` : null;
}

// Nút DOM cho 1 chuỗi emoji (1 hoặc "cảnh" 2–3 emoji): mỗi emoji có file → <img>, không thì chữ emoji của máy.
export function emojiNodes(text) {
  return graphemes(text).map((g) => {
    const url = isEmojiGrapheme(g) ? emojiUrl(g) : null;
    if (!url) return document.createTextNode(g);
    const img = document.createElement("img");
    img.className = "emo";
    img.src = url;
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    img.onerror = () => img.replaceWith(document.createTextNode(g)); // file lỗi → dùng emoji của máy
    return img;
  });
}

// Hình linh vật gà trống thật (không phụ thuộc phông emoji của máy, đã quay đầu sang phải sẵn trong file) —
// DÙNG CHUNG mọi chỗ hiện "chú gà trống" làm logo/biểu tượng, thay vì emoji 🐓 (Twemoji trông nhạt, giống gà mái).
export const MASCOT_URL = new URL("../vendor/mascot/rooster.png", import.meta.url).pathname;
export function mascotIcon(className) {
  const img = document.createElement("img");
  img.className = className ?? "mascot-icon";
  img.src = MASCOT_URL;
  img.alt = "";
  img.draggable = false;
  img.decoding = "async";
  return img;
}
// Gà trống lớn đứng một mình — bắt đầu bài, đăng nhập, kết quả Luyện tập, "Con là ai nào?"...
export function mascotHero() {
  const hero = document.createElement("div");
  hero.className = "mascot-hero";
  hero.append(mascotIcon("mascot-img"));
  return hero;
}

// Tải trước (nền) hình của nhiều emoji — dùng khi mở bài để các màn hình sau hiện tức thì (SW sẽ cache).
export function prefetchEmoji(texts) {
  for (const g of new Set(texts.flatMap((t) => graphemes(t)))) {
    const url = isEmojiGrapheme(g) ? emojiUrl(g) : null;
    if (url) new Image().src = url;
  }
}
