// Chấm "tô chữ": so nét bé tô (ink) với hình chữ mẫu (glyph). Hàm THUẦN trên lưới 0/1 (Uint8Array w×h) — có test trong tests/unit.test.mjs.
// Ý tưởng: chữ mẫu MẢNH (nét thật của phông) chia thành các "mảnh" liền nhau (thân chữ, mỗi dấu thanh, dấu mũ, chấm i…). Bé phải tô phủ
// đủ từng mảnh — nếu chỉ tô thân chữ mà bỏ dấu thanh thì độ phủ chung vẫn cao nhưng mảnh dấu thanh = 0 → không đạt (tiếng Việt: dấu là bắt buộc).
// Không kiểm tra thứ tự/hướng nét (cần dữ liệu nét — giai đoạn 2).

// Giãn nở nhị phân theo ô vuông bán kính r (2 lượt tách dòng/cột bằng tổng cộng dồn).
export function dilate(bin, w, h, r) {
  if (r <= 0) return bin.slice();
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const prefix = new Int32Array(Math.max(w, h) + 1);
  for (let y = 0; y < h; y++) {
    prefix[0] = 0;
    for (let x = 0; x < w; x++) prefix[x + 1] = prefix[x] + bin[y * w + x];
    for (let x = 0; x < w; x++) tmp[y * w + x] = prefix[Math.min(w, x + r + 1)] - prefix[Math.max(0, x - r)] > 0 ? 1 : 0;
  }
  for (let x = 0; x < w; x++) {
    prefix[0] = 0;
    for (let y = 0; y < h; y++) prefix[y + 1] = prefix[y] + tmp[y * w + x];
    for (let y = 0; y < h; y++) out[y * w + x] = prefix[Math.min(h, y + r + 1)] - prefix[Math.max(0, y - r)] > 0 ? 1 : 0;
  }
  return out;
}

// Gán nhãn thành phần liên thông (8 hướng). Trả { labels: Int32Array (0 = nền), parts: [{ id, area, x0, y0, x1, y1 }] }.
export function labelParts(bin, w, h) {
  const labels = new Int32Array(w * h);
  const parts = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!bin[s] || labels[s]) continue;
    const id = parts.length + 1;
    const part = { id, area: 0, x0: w, y0: h, x1: 0, y1: 0 };
    labels[s] = id;
    stack.push(s);
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p - x) / w;
      part.area++;
      if (x < part.x0) part.x0 = x; if (x > part.x1) part.x1 = x;
      if (y < part.y0) part.y0 = y; if (y > part.y1) part.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (bin[q] && !labels[q]) { labels[q] = id; stack.push(q); }
      }
    }
    parts.push(part);
  }
  return { labels, parts };
}

// glyph: chữ mẫu mảnh; ink: nét bé tô (đã gồm bề rộng cọ). tolIn = độ dung sai (ô lưới) khi xét "đã tô phủ"; tolOut = độ lấn ra ngoài được phép.
// minPartFrac: mảnh nhỏ hơn tỉ lệ này của tổng diện tích chữ coi là nhiễu răng cưa (không tính mảnh riêng).
export function scoreTrace({ glyph, ink, w, h, tolIn, tolOut, minPartFrac = 0.006 }) {
  let glyphArea = 0, inkArea = 0;
  for (let i = 0; i < glyph.length; i++) { glyphArea += glyph[i]; inkArea += ink[i]; }
  if (!glyphArea) return { coverage: 0, excess: 0, inkArea, parts: [], missed: [], minPart: 0, quality: 0, ok: false, stars: 1, blank: true };
  const inkNear = dilate(ink, w, h, tolIn);
  const glyphNear = dilate(glyph, w, h, tolOut);
  const { labels, parts } = labelParts(glyph, w, h);
  const covered = new Int32Array(parts.length + 1);
  let coveredAll = 0;
  for (let i = 0; i < glyph.length; i++) if (glyph[i] && inkNear[i]) { coveredAll++; covered[labels[i]]++; }
  let outside = 0;
  for (let i = 0; i < ink.length; i++) if (ink[i] && !glyphNear[i]) outside++;
  const coverage = coveredAll / glyphArea;
  const excess = inkArea ? outside / inkArea : 0;
  const partScores = parts.map((p) => ({ ...p, coverage: covered[p.id] / p.area, significant: p.area >= minPartFrac * glyphArea }));
  const sig = partScores.filter((p) => p.significant);
  const minPart = sig.length ? Math.min(...sig.map((p) => p.coverage)) : coverage;
  const quality = Math.max(0, Math.min(1, coverage - 0.6 * Math.max(0, excess - 0.12)));
  const ok = quality >= 0.7 && minPart >= 0.5;
  return {
    coverage, excess, inkArea, parts: partScores, missed: sig.filter((p) => p.coverage < 0.6), minPart, quality, ok,
    stars: ok ? (quality >= 0.88 && minPart >= 0.75 ? 3 : 2) : 1, blank: inkArea < 0.05 * glyphArea,
  };
}
