// Âm báo ngắn bằng WebAudio (không cần file). AudioContext chỉ tạo sau cú chạm đầu tiên của trẻ.
let ctx = null;

function tone(freq, start, dur, type = "sine", vol = 0.18) {
  try {
    ctx ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch {
    /* thiết bị không hỗ trợ: bỏ qua, không ảnh hưởng bài học */
  }
}

export const sfx = {
  good() { tone(660, 0, 0.12); tone(880, 0.1, 0.2); },
  oops() { tone(300, 0, 0.18, "triangle"); tone(240, 0.16, 0.22, "triangle"); },
  star() { tone(784, 0, 0.1); tone(988, 0.09, 0.1); tone(1319, 0.18, 0.25); },
};
