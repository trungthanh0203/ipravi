// Xử lý âm thanh thu từ micro: hàm THUẦN (không đụng DOM) để kiểm thử được. Mẫu là Float32Array trong khoảng -1..1.

export const peakOf = (x) => { let p = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > p) p = a; } return p; };
export const rmsOf = (x) => { if (!x.length) return 0; let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / x.length); };
export const durationMs = (x, sampleRate) => Math.round((x.length / sampleRate) * 1000);

// Cắt khoảng lặng đầu/cuối, chừa padMs mỗi đầu. Ngưỡng = lớn hơn của (2% đỉnh, -50 dB) để không cắt nhầm tiếng nhỏ mà cũng không giữ tiếng ồn nền.
// Trả về mẫu đã cắt; nếu toàn im lặng thì trả nguyên.
export function trimSilence(x, sampleRate, { padMs = 120, minDb = -50 } = {}) {
  const peak = peakOf(x);
  const thr = Math.max(peak * 0.02, 10 ** (minDb / 20));
  let a = 0, b = x.length - 1;
  while (a < x.length && Math.abs(x[a]) < thr) a++;
  while (b > a && Math.abs(x[b]) < thr) b--;
  if (a >= x.length) return x;
  const pad = Math.round((padMs / 1000) * sampleRate);
  return x.slice(Math.max(0, a - pad), Math.min(x.length, b + 1 + pad));
}

// Kéo đỉnh về targetDb (mặc định -1 dBFS) để mọi file cùng độ to. Không khuếch đại quá maxGainDb (tránh phóng đại tiếng ồn khi thu quá nhỏ).
export function normalizePeak(x, { targetDb = -1, maxGainDb = 24 } = {}) {
  const peak = peakOf(x);
  if (peak === 0) return x;
  const gain = Math.min(10 ** (targetDb / 20) / peak, 10 ** (maxGainDb / 20));
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * gain;
  return out;
}

// Đổi tần số lấy mẫu. Hạ tần số: lấy trung bình trong cửa sổ (lọc thô chống răng cưa); nâng: nội suy tuyến tính.
export function resample(x, from, to) {
  if (from === to) return x;
  const n = Math.max(1, Math.round((x.length * to) / from));
  const out = new Float32Array(n);
  const ratio = from / to;
  for (let i = 0; i < n; i++) {
    const start = i * ratio;
    if (ratio > 1) {
      const end = Math.min(x.length, Math.ceil(start + ratio));
      let s = 0, c = 0;
      for (let k = Math.floor(start); k < end; k++) { s += x[k]; c++; }
      out[i] = c ? s / c : 0;
    } else {
      const k = Math.floor(start), f = start - k;
      out[i] = x[k] * (1 - f) + (x[Math.min(k + 1, x.length - 1)] ?? 0) * f;
    }
  }
  return out;
}

// WAV mono 16-bit PCM (phát được ở mọi trình duyệt).
export function encodeWav(x, sampleRate) {
  const buf = new ArrayBuffer(44 + x.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + x.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) {
    const s = Math.max(-1, Math.min(1, x[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

// Toàn bộ chuỗi xử lý cho 1 lần thu: cắt lặng → chuẩn hoá → 24 kHz → WAV. Trả { wav, ms, peakBefore }.
export function processTake(samples, sampleRate, { targetRate = 24000 } = {}) {
  const peakBefore = peakOf(samples);
  const trimmed = trimSilence(samples, sampleRate);
  const out = resample(normalizePeak(trimmed), sampleRate, targetRate);
  return { wav: encodeWav(out, targetRate), ms: durationMs(out, targetRate), peakBefore };
}
