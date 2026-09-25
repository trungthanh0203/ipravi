import { sb } from "../supabase.js";
import { el, msg } from "../ui.js";
import { A } from "./text.js";
import * as audio from "./audio.js";
import { openMic } from "./mic.js";
import { processTake } from "./wav.js";
import { ensureBank } from "./bank.js";
import { BANK_UNIT } from "../sounds.js";
import { spoken } from "../viet.js";
import { beginLoad } from "./view.js";

// Tab "Thu âm": thu GIỌNG NGƯỜI THẬT cho từng mục (mặc định: giọng nam, người lớn) ngay trong trình duyệt.
// Mỗi mục 1 màn hình lớn: Thu → Nghe lại → Giữ (tự sang mục kế). Bản thu được cắt khoảng lặng, chuẩn hoá âm lượng, lưu WAV 24 kHz
// vào Storage + bảng content_audio (source=human). Khu bé tự ưu tiên giọng người thật cùng giới bé chọn (pickAudio).
// Đường thay thế: thả nhiều file có TÊN = chữ của mục (vd "bà.wav") để tải hàng loạt.

const check = ({ error, data }) => { if (error) throw error; return data; };
const S = { lessonId: null, gender: "male", kind: "adult", region: "", speed: "normal", idx: 0 };
const REGIONS = [["", "Không phân vùng"], ["bac", "Miền Bắc"], ["trung", "Miền Trung"], ["nam", "Miền Nam"]];
const MAX_SECONDS = 8;

let mic = null;
let keyHandler = null;

export async function mount(box) {
  const done = beginLoad(box);
  try {
    const [units, lessons] = await Promise.all([
      sb.from("units").select("id, title_vi, emoji, hidden, sort_order").order("sort_order").then(check),
      sb.from("lessons").select("id, unit_id, title_vi, sort_order").order("sort_order").then(check),
    ]);
    render(box, units, lessons);
  } catch (e) {
    box.replaceChildren(msg("err", A.loadError + e.message));
  }
  done();
}

function render(box, units, lessons) {
  const flash = el("div");
  const say = (kind, text) => flash.replaceChildren(msg(kind, text));
  const bank = units.find((u) => u.title_vi === BANK_UNIT);

  // Danh sách bài: ngân hàng âm trước, rồi các chủ đề khác
  const ordered = [...units].sort((a, b) => Number(Boolean(b.hidden)) - Number(Boolean(a.hidden)) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const options = ordered.flatMap((u) => lessons.filter((l) => l.unit_id === u.id).map((l) => ({ id: l.id, label: `${u.hidden ? "🎙️ " : ""}${u.title_vi} › ${l.title_vi}` })));
  if (!options.some((o) => o.id === S.lessonId)) S.lessonId = options[0]?.id ?? null;

  const work = el("div");
  const sel = (label, key, opts, onChange) => {
    const s = el("select", { class: "cell", onchange: () => { S[key] = s.value; S.idx = 0; onChange?.(); } },
      opts.map(([v, t]) => el("option", { value: v, selected: String(S[key]) === String(v) }, t)));
    return el("label", { class: "rec-field" }, el("span", { class: "muted" }, label), s);
  };
  const lessonSel = el("select", { class: "cell", style: "min-width:260px", onchange: () => { S.lessonId = Number(lessonSel.value); S.idx = 0; loadAndDraw(); } },
    options.map((o) => el("option", { value: o.id, selected: o.id === S.lessonId }, o.label)));

  const settings = el("div", { class: "card rec-settings" },
    el("h2", null, "Thu giọng người thật"),
    el("p", { class: "muted" }, "Chọn bài rồi thu từng mục. Cài đặt bên dưới áp dụng cho MỌI bản thu trong phiên này (mặc định: giọng nam, người lớn). Phòng yên tĩnh, miệng cách micro khoảng 15–20 cm, giữ khoảng cách đều."),
    el("div", { class: "rec-row" },
      el("label", { class: "rec-field" }, el("span", { class: "muted" }, "Bài"), lessonSel),
      sel("Giọng", "gender", [["male", "♂ Nam"], ["female", "♀ Nữ"]], () => loadAndDraw()),
      sel("Loại giọng", "kind", [["adult", "Người lớn"], ["child", "Trẻ em"]], () => mount(box)), // vẽ lại để hiện/ẩn cảnh báo giọng trẻ em
      sel("Vùng", "region", REGIONS, () => loadAndDraw()),
      sel("Tốc độ", "speed", [["normal", "Thường"], ["slow", "Chậm 🐢"]], () => loadAndDraw())),
    S.kind === "child" ? msg("err", "Giọng TRẺ EM là dữ liệu cá nhân của trẻ: chỉ thu khi có đồng ý bằng văn bản của phụ huynh trẻ đó.") : null);

  const bankBox = bank ? null : el("div", { class: "card" },
    el("h2", null, "Ngân hàng âm"),
    el("p", { class: "muted" }, "Chưa có. Ngân hàng âm là chủ đề ẨN (bé không thấy) gồm âm chữ cái (bờ, cờ…), nguyên âm, tên 6 dấu thanh và ~80 vần — cần giọng thu để sau này đánh vần theo từng phần. Bấm để tạo (chạy lại an toàn, chỉ thêm cái còn thiếu)."),
    el("button", { class: "btn", onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { const r = await ensureBank(); notice(`Đã tạo ngân hàng âm: ${r.lessons} bài, ${r.items} âm.`); mount(box); } catch (err) { e.currentTarget.disabled = false; say("err", err.message); }
    } }, "Tạo ngân hàng âm"));
  const notice = (t) => sessionStorage.setItem("tltv-rec-notice", t);

  box.replaceChildren(flash, ...(bankBox ? [bankBox] : []), settings, work);
  const saved = sessionStorage.getItem("tltv-rec-notice");
  if (saved) { sessionStorage.removeItem("tltv-rec-notice"); say("ok", saved); }

  // ---------------- danh sách mục + bảng thu ----------------
  let items = [];
  let take = null; // { wav, url, ms, peak }  — bản vừa thu, chưa giữ
  let phase = "idle"; // idle | rec | review | saving
  let timer = null;

  async function loadAndDraw() {
    if (!S.lessonId) return;
    stopTimer();
    take = null; phase = "idle";
    work.replaceChildren(el("p", { class: "muted" }, A.loading));
    try {
      items = check(await sb.from("content_items").select("id, text_vi, say_vi, item_type, sort_order, content_audio(*)").eq("lesson_id", S.lessonId).order("sort_order").range(0, 999));
    } catch (e) { return work.replaceChildren(msg("err", A.loadError + e.message)); }
    S.idx = Math.min(S.idx, Math.max(0, items.length - 1));
    draw();
  }

  const slot = () => ({ lang: "vi", speed: S.speed, gender: S.gender });
  const mine = (it) => audio.findAudio(it, slot()).filter((a) => a.source === "human" && a.voice_kind === S.kind && (a.region ?? "") === S.region);
  const stopTimer = () => { clearInterval(timer); timer = null; };

  function draw() {
    const item = items[S.idx];
    const doneCount = items.filter((i) => mine(i).length).length;
    if (!item) return work.replaceChildren(el("p", { class: "muted" }, "Bài này chưa có mục nào."));
    const have = mine(item);
    const meter = el("div", { class: "meter rec-meter" }, el("div", { class: "meter-fill", style: "width:0%" }));
    const clock = el("span", { class: "muted" }, "");

    const controls = el("div", { class: "rec-controls" });
    const btn = (label, onclick, cls = "btn") => el("button", { class: cls, onclick }, label);
    if (phase === "idle") controls.append(btn("● Thu  (Space)", startRec, "btn big rec-btn"));
    if (phase === "rec") controls.append(meter, clock, btn("■ Dừng  (Space)", stopRec, "btn big rec-btn recording"));
    if (phase === "review" && take) {
      controls.append(
        el("p", { class: "muted" }, `Độ dài ${(take.ms / 1000).toFixed(1)} giây · đã cắt khoảng lặng và chuẩn hoá âm lượng`),
        btn("▶ Nghe lại", () => new Audio(take.url).play().catch(() => {}), "btn ghost"),
        btn("✓ Giữ  (Enter)", keep, "btn big"),
        btn("↻ Thu lại  (R)", redo, "btn ghost"));
    }
    if (phase === "saving") controls.append(el("p", { class: "muted" }, "Đang lưu…"));

    const card = el("div", { class: "card rec-card" },
      el("div", { class: "muted" }, `Mục ${S.idx + 1}/${items.length} · đã thu ${doneCount}/${items.length} (giọng ${S.gender === "male" ? "nam" : "nữ"}, ${S.kind === "child" ? "trẻ em" : "người lớn"}, ${S.speed === "slow" ? "chậm" : "thường"})`),
      el("div", { class: "meter" }, el("div", { class: "meter-fill", style: `width:${items.length ? Math.round((100 * doneCount) / items.length) : 0}%` })),
      el("div", { class: "rec-text" }, item.text_vi),
      item.say_vi ? el("div", { class: "muted" }, `Đọc là: “${item.say_vi}”`) : null,
      el("div", { class: "row-btns", style: "justify-content:center" },
        btn("🔈 Nghe mẫu TTS", () => sample(item), "btn small ghost"),
        have.length ? btn("▶ Bản đã thu", () => audio.play(have[0]), "btn small ghost") : null,
        have.length ? btn("🗑 Xoá bản đã thu", async () => {
          if (!confirm(`Xoá bản thu của “${item.text_vi}”?`)) return;
          try { for (const r of have) await audio.deleteAudioRow(r); await loadAndDraw(); } catch (e) { say("err", e.message); }
        }, "btn small ghost danger") : null),
      have.length && phase === "idle" ? el("p", { class: "muted" }, "✓ Mục này đã có giọng thu. Thu lại sẽ thay bản cũ.") : null,
      controls,
      el("div", { class: "row-btns", style: "justify-content:space-between" },
        btn("◀ Trước", () => go(-1), "btn small ghost"), btn("Bỏ qua ▶", () => go(1), "btn small ghost")));

    const chips = el("div", { class: "rec-chips" }, items.map((it, i) =>
      el("button", { class: "chip" + (i === S.idx ? " now" : "") + (mine(it).length ? " ok" : ""), onclick: () => { if (phase === "rec") return; S.idx = i; take = null; phase = "idle"; draw(); } },
        (mine(it).length ? "✓ " : "") + it.text_vi)));

    const drop = el("div", { class: "card" }, el("h3", null, "Tải hàng loạt"),
      el("p", { class: "muted" }, "Đã thu bằng phần mềm khác? Chọn nhiều file (wav/mp3/m4a) có TÊN = chữ của mục (vd “bà.wav”, “bờ.mp3”). Chỉ ghép với các mục của bài đang chọn."),
      el("input", { type: "file", multiple: true, accept: "audio/*", onchange: (e) => batch([...e.target.files]) }));

    work.replaceChildren(card, chips, drop);
    if (phase === "rec") { work._meter = meter.firstChild; work._clock = clock; } else { work._meter = null; work._clock = null; }
  }

  const go = (d) => {
    if (phase === "rec" || phase === "saving") return;
    S.idx = (S.idx + d + items.length) % items.length;
    take = null; phase = "idle"; draw();
  };

  async function sample(item) {
    try { await audio.previewVoice("vi", undefined, spoken(item), S.gender); }
    catch { // chưa cấu hình TTS → giọng của trình duyệt
      const u = new SpeechSynthesisUtterance(spoken(item)); u.lang = "vi-VN"; speechSynthesis.speak(u);
    }
  }

  async function startRec() {
    if (phase !== "idle") return;
    try {
      if (!mic) { mic = await openMic(); mic.onLevel = onLevel; }
    } catch (e) { return say("err", e.message); }
    flash.replaceChildren();
    mic.start();
    phase = "rec";
    const t0 = Date.now();
    draw();
    timer = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      if (work._clock) work._clock.textContent = `${s.toFixed(1)} s`;
      if (s >= MAX_SECONDS) stopRec();
    }, 100);
  }

  function onLevel(rms) {
    if (!box.isConnected) { mic?.close(); mic = null; return; } // rời tab → tắt micro
    if (phase === "rec" && work._meter) work._meter.style.width = Math.min(100, Math.round(rms * 400)) + "%";
  }

  function stopRec() {
    if (phase !== "rec") return;
    stopTimer();
    const { samples, sampleRate } = mic.stop();
    const r = processTake(samples, sampleRate);
    if (r.peakBefore < 0.02 || r.ms < 150) {
      phase = "idle"; draw();
      return say("err", "Không nghe thấy tiếng (hoặc quá ngắn/quá nhỏ). Kiểm tra micro, nói to hơn hoặc gần micro hơn rồi thu lại.");
    }
    if (take?.url) URL.revokeObjectURL(take.url);
    take = { ...r, url: URL.createObjectURL(new Blob([r.wav], { type: "audio/wav" })) };
    phase = "review";
    draw();
    new Audio(take.url).play().catch(() => {}); // nghe lại ngay
  }

  function redo() { if (take?.url) URL.revokeObjectURL(take.url); take = null; phase = "idle"; draw(); }

  async function keep() {
    if (phase !== "review" || !take) return;
    const item = items[S.idx];
    phase = "saving"; draw();
    try {
      await audio.uploadHuman(item, slot(), new File([take.wav], "rec.wav", { type: "audio/wav" }), S.kind, S.region || null);
      URL.revokeObjectURL(take.url); take = null; phase = "idle";
      // nạp lại âm thanh của bài rồi sang mục kế tiếp CHƯA thu (nếu còn), không thì mục kế
      items = check(await sb.from("content_items").select("id, text_vi, say_vi, item_type, sort_order, content_audio(*)").eq("lesson_id", S.lessonId).order("sort_order").range(0, 999));
      const nextTodo = items.findIndex((it, i) => i > S.idx && !mine(it).length);
      S.idx = nextTodo >= 0 ? nextTodo : Math.min(S.idx + 1, items.length - 1);
      draw();
    } catch (e) { phase = "review"; draw(); say("err", "Chưa lưu được: " + e.message); }
  }

  async function batch(files) {
    if (!files.length) return;
    const norm = (s) => s.normalize("NFC").toLowerCase().trim();
    const byText = new Map(items.map((it) => [norm(it.text_vi), it]));
    let ok = 0;
    const missed = [];
    for (const f of files) {
      const base = norm(f.name.replace(/\.[^.]+$/, ""));
      const it = byText.get(base);
      if (!it) { missed.push(f.name); continue; }
      try { await audio.uploadHuman(it, slot(), f, S.kind, S.region || null); ok++; } catch (e) { missed.push(`${f.name} (${e.message})`); }
    }
    await loadAndDraw();
    say(missed.length ? "err" : "ok", `Đã tải ${ok}/${files.length} file.${missed.length ? " Không ghép được: " + missed.slice(0, 8).join(", ") + (missed.length > 8 ? "…" : "") : ""}`);
  }

  // Phím tắt (chỉ khi tab còn hiện và không đang gõ vào ô nhập)
  if (keyHandler) document.removeEventListener("keydown", keyHandler);
  keyHandler = (e) => {
    if (!box.isConnected) { document.removeEventListener("keydown", keyHandler); return; }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? "")) return;
    if (e.code === "Space") { e.preventDefault(); phase === "idle" ? startRec() : phase === "rec" ? stopRec() : null; }
    else if (e.key === "Enter" && phase === "review") keep();
    else if ((e.key === "r" || e.key === "R") && phase === "review") redo();
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  };
  document.addEventListener("keydown", keyHandler);

  // Gọi CUỐI CÙNG: loadAndDraw dùng các biến khai báo bằng let ở trên (gọi sớm hơn sẽ lỗi "chưa khởi tạo")
  if (options.length) loadAndDraw();
  else work.replaceChildren(el("p", { class: "muted" }, "Chưa có bài nào. Nhập nội dung ở tab “Trẻ em” (mục Nhập CSV hàng loạt) hoặc tạo ngân hàng âm."));
}
