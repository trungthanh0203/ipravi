// Thu âm từ micro bằng Web Audio (mẫu thô Float32) — KHÔNG dùng MediaRecorder vì mỗi trình duyệt ra một định dạng khác nhau (webm/mp4)
// và không phải máy nào cũng phát được. Mẫu thô được cắt/chuẩn hoá/mã hoá WAV ở wav.js. Chỉ kiểm được bằng tay trên máy thật.
//
// Dùng:  const mic = await openMic();  mic.onLevel = (rms) => …;  mic.start();  …  const { samples, sampleRate } = mic.stop();  mic.close();
// openMic() phải được gọi từ 1 cú chạm/nhấn (iOS chỉ cho bật micro và AudioContext sau cử chỉ người dùng).

export async function openMic() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Trình duyệt này không hỗ trợ thu âm (cần HTTPS và trình duyệt mới).");
  let stream;
  try {
    // Tắt xử lý tự động: khử ồn/tự chỉnh âm lượng của trình duyệt làm méo tiếng và nuốt phụ âm nhẹ.
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    throw new Error(e?.name === "NotAllowedError" ? "Chưa được phép dùng micro — bấm vào biểu tượng ổ khoá cạnh địa chỉ web, cho phép micro rồi thử lại." : "Không mở được micro: " + (e?.message ?? e));
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  if (ctx.state === "suspended") await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1); // cũ nhưng chạy được ở mọi trình duyệt kể cả iOS
  const mute = ctx.createGain();
  mute.gain.value = 0; // nối tới đích để bộ xử lý chạy, nhưng không phát lại tiếng thu ra loa
  let chunks = [];
  let recording = false;
  const mic = {
    sampleRate: ctx.sampleRate,
    onLevel: null,
    start() { chunks = []; recording = true; },
    stop() {
      recording = false;
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const samples = new Float32Array(total);
      let o = 0;
      for (const c of chunks) { samples.set(c, o); o += c.length; }
      chunks = [];
      return { samples, sampleRate: ctx.sampleRate };
    },
    close() {
      try { proc.disconnect(); source.disconnect(); } catch { /* đã đóng */ }
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    let s = 0;
    for (let i = 0; i < data.length; i++) s += data[i] * data[i];
    mic.onLevel?.(Math.sqrt(s / data.length));
    if (recording) chunks.push(new Float32Array(data));
  };
  source.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);
  return mic;
}
