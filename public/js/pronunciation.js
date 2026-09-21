// Chấm phát âm — dùng Web Speech API của trình duyệt để nhận dạng lời nói thành chữ, rồi so chữ nhận được với câu mẫu THEO TỪNG TIẾNG
// (kể cả dấu thanh). KHÔNG phải chấm âm học thật (cao độ, độ dài, ngắt nghỉ) — xem "GIỚI HẠN" bên dưới. Hàm chấm là hàm thuần, tách khỏi
// phần nghe micro để sau này thay bằng dịch vụ chuyên dụng (mục 4.6 tài liệu yêu cầu). Test: tests/unit.test.mjs.
import { stripTone, splitSyllable } from "./viet.js";

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

// ---- Đánh giá việc đọc theo TỪNG TIẾNG ----
// Trình duyệt chỉ cho ta CHỮ nhận dạng được (không có âm thanh thô), nên so từng tiếng nhận dạng với tiếng mẫu:
//   ok       đúng hoàn toàn (kể cả dấu thanh)
//   tone     đúng tiếng nhưng SAI DẤU THANH (má ↔ mà)             → ghi 0,5 điểm
//   initial  đúng vần + thanh nhưng khác ÂM ĐẦU (chó ↔ tró)      → 0,4 điểm (cũng có thể là giọng vùng miền: ch/tr, s/x, d/gi/r, l/n…)
//   close    gần giống (lệch ≤ 1 chữ cái sau khi bỏ dấu thanh)  → 0,3 điểm
//   wrong    nói tiếng khác hẳn                                    → 0
//   missing  không nghe thấy tiếng này                             → 0
// Tiếng THỪA (nhận dạng có mà mẫu không có) không làm mất điểm từng tiếng nhưng làm tăng mẫu số.
// GIỚI HẠN: đây là ước lượng từ nhận dạng giọng nói (mô hình ngôn ngữ có thể "tự sửa" về từ quen thuộc; giọng trẻ nhỏ, tiếng ồn, giọng vùng miền
// làm lệch); KHÔNG đo âm thanh thật nên không chấm được thanh điệu ở mức âm học. Kết quả là GỢI Ý, không phải chẩn đoán.
export const CREDIT = { ok: 1, tone: 0.5, initial: 0.4, close: 0.3, wrong: 0, missing: 0 };

export function compareSyllable(t, h) {
  if (t === h) return "ok";
  if (stripTone(t) === stripTone(h)) return "tone";
  const a = splitSyllable(t), b = splitSyllable(h);
  if (a && b && a.rest === b.rest && a.initial !== b.initial) return "initial";
  if (stripTone(t).length >= 2 && editDistance(stripTone(t), stripTone(h)) <= 1) return "close";
  return "wrong";
}

// Xếp thẳng hàng các tiếng mẫu với tiếng nhận dạng (quy hoạch động; thay bằng tiếng gần đúng rẻ hơn xoá + thêm).
// Trả về danh sách bước theo thứ tự: { t, h, status } (h = null nếu thiếu) hoặc { extra: h }.
export function alignSyllables(target, heard) {
  const n = target.length, m = heard.length;
  const sub = (i, j) => 1 - CREDIT[compareSyllable(target[i], heard[j])];
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) dp[i][0] = i;
  for (let j = 1; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i][j] = Math.min(dp[i - 1][j - 1] + sub(i - 1, j - 1), dp[i - 1][j] + 1, dp[i][j - 1] + 1);
  const same = (a, b) => Math.abs(a - b) < 1e-9;
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && same(dp[i][j], dp[i - 1][j - 1] + sub(i - 1, j - 1))) {
      ops.push({ t: target[i - 1], h: heard[j - 1], status: compareSyllable(target[i - 1], heard[j - 1]) });
      i--; j--;
    } else if (i > 0 && same(dp[i][j], dp[i - 1][j] + 1)) {
      ops.push({ t: target[i - 1], h: null, status: "missing" });
      i--;
    } else {
      ops.push({ extra: heard[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

// Mức nhận xét cho PHỤ HUYNH (bé chỉ thấy sao + lời khen).
export const readingLevel = (score) => (score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fair" : "practice");

// Đánh giá 1 lượt đọc. heard: chữ nhận dạng được HOẶC danh sách phương án (trình duyệt trả vài phương án; lấy phương án GẦN mẫu nhất —
// cách làm thông dụng để không bất công với giọng trẻ; vẫn phải đúng từng tiếng mới được điểm cao).
// Trả { score 0–100, level, heard (phương án được chọn), syllables:[{text, heard, status}], extras:[…] }.
export function assessReading(targetText, heard) {
  const t = stripClassifier(tokenize(targetText));
  const alts = (Array.isArray(heard) ? heard : [heard]).map((x) => String(x?.text ?? x ?? "")).filter((x) => x.trim());
  const empty = { score: 0, level: "practice", heard: alts[0] ?? "", syllables: t.map((text) => ({ text, heard: null, status: "missing" })), extras: [] };
  if (!t.length || !alts.length) return empty;
  let best = null;
  for (const alt of alts) {
    const h = stripClassifier(tokenize(alt));
    const ops = alignSyllables(t, h);
    const credit = ops.reduce((a, o) => a + (o.status ? CREDIT[o.status] : 0), 0);
    const score = Math.max(0, Math.min(100, Math.round((100 * credit) / Math.max(t.length, h.length, 1))));
    if (!best || score > best.score) best = { score, alt, ops };
  }
  return {
    score: best.score, level: readingLevel(best.score), heard: best.alt,
    syllables: best.ops.filter((o) => o.t !== undefined).map((o) => ({ text: o.t, heard: o.h, status: o.status })),
    extras: best.ops.filter((o) => o.extra !== undefined).map((o) => o.extra),
  };
}

// 0–100: mức giống nhau giữa câu mẫu và chữ nhận dạng được (từng tiếng, có tính dấu thanh) — cùng nguồn với assessReading.
export const scorePronunciation = (targetText, transcript) => assessReading(targetText, transcript).score;

// Lời nhắc nhẹ cho bé: chỉ vào tiếng đầu tiên chưa đúng. Ưu tiên tiếng nói khác/thiếu, rồi âm đầu/gần giống, rồi dấu thanh.
export function tipOf(assessment) {
  const bad = assessment.syllables.filter((s) => s.status !== "ok");
  if (!bad.length) return null;
  const rank = { wrong: 0, missing: 0, initial: 1, close: 1, tone: 2 };
  const s = [...bad].sort((a, b) => rank[a.status] - rank[b.status])[0];
  return { kind: s.status === "tone" ? "tone" : s.status === "missing" ? "missing" : "sound", word: s.text };
}

// Mức phản hồi cho trẻ: ngưỡng DỄ, không có mức "sai" — chỉ "thử lại". Sẽ chỉnh sau khi thử với giọng trẻ thật.
export function tier(score) {
  if (score >= 80) return { stars: 3, key: "excellent" };
  if (score >= 55) return { stars: 2, key: "good" };
  if (score >= 30) return { stars: 1, key: "ok" };
  return { stars: 0, key: "retry" };
}

// Nghe 1 lượt, trả về Promise<{ text, alts:[{text, confidence}] }> (text rỗng nếu không nghe thấy). Lấy tối đa 5 phương án nhận dạng.
export function recognizeDetailed(lang = "vi-VN") {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognitionCtor) return reject(new Error("unsupported"));
    const rec = new SpeechRecognitionCtor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    let alts = [];
    rec.onresult = (e) => {
      alts = [...(e.results[0] ?? [])].map((a) => ({ text: a.transcript ?? "", confidence: a.confidence ?? null })).filter((a) => a.text);
    };
    rec.onerror = (e) => (e.error === "no-speech" ? resolve({ text: "", alts: [] }) : reject(new Error(e.error)));
    rec.onend = () => resolve({ text: alts[0]?.text ?? "", alts });
    rec.start();
  });
}

// Giữ cho nơi gọi cũ: chỉ lấy chữ nhận dạng tốt nhất.
export const recognizeOnce = async (lang = "vi-VN") => (await recognizeDetailed(lang)).text;

// detail để lưu vào pronunciation_attempts.detail (nhỏ gọn): { v:1, syl:[[chữ, trạng thái], …], level, extras }.
export const detailOf = (assessment) => ({ v: 1, syl: assessment.syllables.map((s) => [s.text, s.status]), level: assessment.level, extras: assessment.extras.length });

// ---- Báo cáo cho phụ huynh ----
// attempts: các dòng pronunciation_attempts (mới nhất trước) [{ item_id, score, detail }]; texts: Map item_id → chữ hiển thị.
// Dòng cũ không có detail vẫn được tính vào số lượt + điểm.
export function summarizePron(attempts = [], texts = new Map()) {
  const rows = attempts.filter((a) => a && a.score != null);
  const avg = (list) => (list.length ? Math.round(list.reduce((a, r) => a + Number(r.score), 0) / list.length) : null);
  const stat = { ok: 0, tone: 0, initial: 0, close: 0, wrong: 0, missing: 0 };
  let syllables = 0;
  for (const r of rows) for (const [, st] of r.detail?.syl ?? []) if (st in stat) { stat[st]++; syllables++; }
  const pct = (k) => (syllables ? Math.round((100 * stat[k]) / syllables) : 0);
  const byItem = new Map();
  for (const r of rows) {
    const e = byItem.get(r.item_id) ?? { item_id: r.item_id, n: 0, sum: 0 };
    e.n++; e.sum += Number(r.score);
    byItem.set(r.item_id, e);
  }
  const weakWords = [...byItem.values()].filter((e) => e.n >= 2 && e.sum / e.n < 60)
    .sort((a, b) => a.sum / a.n - b.sum / b.n).slice(0, 6)
    .map((e) => ({ item_id: e.item_id, text: texts.get(e.item_id) ?? "", avg: Math.round(e.sum / e.n), attempts: e.n }));
  const errKinds = ["tone", "initial", "close", "wrong", "missing"].filter((k) => stat[k] > 0).sort((a, b) => stat[b] - stat[a]);
  const recent = avg(rows.slice(0, 10)), before = avg(rows.slice(10, 20));
  const total = avg(rows);
  return {
    count: rows.length, avg: total, level: rows.length ? readingLevel(total) : null,
    trend: recent != null && before != null && Math.abs(recent - before) >= 5 ? (recent > before ? "up" : "down") : null,
    syllables, percent: { ok: pct("ok"), tone: pct("tone"), initial: pct("initial"), close: pct("close"), wrong: pct("wrong"), missing: pct("missing") },
    mainIssue: syllables >= 8 && errKinds.length ? errKinds[0] : null, weakWords,
  };
}
