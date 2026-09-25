import { sb, contentUrl } from "../supabase.js";
import { el, msg } from "../ui.js";
import { A } from "./text.js";
import * as audio from "./audio.js";
import * as bb from "./bb-ops.js";
import { openMic } from "./mic.js";
import { processTake } from "./wav.js";
import { ensureBank } from "./bank.js";
import { BANK_UNIT } from "../sounds.js";
import { spoken } from "../viet.js";
import { beginLoad } from "./view.js";

// Tab "Thu âm": thu GIỌNG NGƯỜI THẬT ngay trong trình duyệt, dùng chung cho CẢ 2 giáo trình (chọn ở nút 👶/🎓 đầu
// trang) — khác cấu trúc dữ liệu nên 2 "bộ nạp mục" riêng (loadChildItems/loadBbItems) nhưng CÙNG 1 giao diện thu
// (Thu → Nghe lại → Giữ, tự sang mục kế) qua khuôn `item` chung {text, sub, hasAudio, playCurrent, upload, remove}.
// "Ngân hàng âm" (chủ đề ẩn dùng chung, xem sounds.js) LUÔN hiện ở CẢ 2 bên vì không thuộc riêng giáo trình nào.
// Khu trẻ em: bản thu vào content_audio (source=human, phân biệt giọng/loại/vùng — `audio.uploadHuman`). Khu Bài
// Bản: bản thu ghi thẳng vào cột audio_path phẳng của bảng chặng tương ứng (`bb-ops.setAudioPath`, GHI ĐÈ khi thu
// lại — bảng bb_* không có cột giới/vùng nên không có bộ lọc giọng ở đây).

const check = ({ error, data }) => { if (error) throw error; return data; };
const S = { curriculum: "child", lessonId: null, gender: "male", kind: "adult", region: "", speed: "normal", idx: 0 };
const REGIONS = [["", "Không phân vùng"], ["bac", "Miền Bắc"], ["trung", "Miền Trung"], ["nam", "Miền Nam"]];
const MAX_SECONDS = 8;
const MAX_SECONDS_LONG = 90; // đoạn văn đọc hiểu (Bài Bản) dài hơn nhiều so với 1 từ/câu

let mic = null;
let keyHandler = null;

export async function mount(box) {
  const done = beginLoad(box);
  try {
    const [units, lessons, bbLevels, bbUnits, bbLessons, bbSteps] = await Promise.all([
      sb.from("units").select("id, title_vi, emoji, hidden, sort_order").order("sort_order").then(check),
      sb.from("lessons").select("id, unit_id, title_vi, sort_order").order("sort_order").then(check),
      sb.from("bb_levels").select("*").order("sort_order").then(check),
      sb.from("bb_units").select("*").order("sort_order").then(check),
      sb.from("bb_lessons").select("*").order("sort_order").then(check),
      sb.from("bb_lesson_steps").select("*").order("sort_order").then(check),
    ]);
    render(box, { units, lessons, bbLevels, bbUnits, bbLessons, bbSteps });
  } catch (e) {
    box.replaceChildren(msg("err", A.loadError + e.message));
  }
  done();
}

// ---------------------------------------------------------------------------- nạp mục cần thu, khu trẻ em
function childItem(r) {
  const slotNow = () => ({ lang: "vi", speed: S.speed, gender: S.gender });
  const have = () => audio.findAudio(r, slotNow()).filter((a) => a.source === "human" && a.voice_kind === S.kind && (a.region ?? "") === S.region);
  return {
    key: String(r.id), group: null, text: r.text_vi, sub: r.say_vi ? `Đọc là: “${r.say_vi}”` : null,
    sampleText: spoken(r), maxSeconds: MAX_SECONDS,
    get hasAudio() { return have().length > 0; },
    playCurrent: () => { const h = have(); if (h.length) audio.play(h[0]); },
    upload: (file) => audio.uploadHuman(r, slotNow(), file, S.kind, S.region || null),
    remove: async () => { for (const row of have()) await audio.deleteAudioRow(row); },
  };
}
async function loadChildItems(lessonId) {
  const rows = check(await sb.from("content_items").select("id, text_vi, say_vi, item_type, sort_order, content_audio(*)").eq("lesson_id", lessonId).order("sort_order").range(0, 999));
  return rows.map(childItem);
}

// ---------------------------------------------------------------------------- nạp mục cần thu, khu Bài Bản
// Chỉ 4/7 chặng có cột âm thanh: Hội thoại, Từ vựng, Ngữ âm (2 slot/dòng: sound_a + sound_b), Đọc hiểu (1 file/cả
// đoạn văn). Ngữ pháp/Luyện viết/Mini-game không có cột audio_path nào — không hiện trong danh sách thu.
function bbItem(table, row, col, group, text, sub, maxSeconds) {
  return {
    key: `${table}:${row.id}:${col}`, group, text, sub, sampleText: text, maxSeconds,
    get hasAudio() { return Boolean(row[col]); },
    playCurrent: () => { if (row[col]) new Audio(contentUrl(row[col])).play().catch(() => {}); },
    upload: (file) => bb.setAudioPath(table, row, col, file),
    remove: () => bb.clearAudioPath(table, row, col),
  };
}
async function loadBbItems(lessonId, allSteps) {
  const steps = allSteps.filter((s) => String(s.lesson_id) === String(lessonId));
  const byType = Object.fromEntries(steps.map((s) => [s.step_type, s]));
  const items = [];
  if (byType.dialogue) {
    const rows = check(await sb.from("bb_dialogue_lines").select("*").eq("step_id", byType.dialogue.id).order("sort_order"));
    for (const r of rows) items.push(bbItem("bb_dialogue_lines", r, "audio_path", "💬 Hội thoại", r.line_vi, `Vai ${r.speaker}`, MAX_SECONDS));
  }
  if (byType.vocab) {
    const rows = check(await sb.from("bb_vocab").select("*").eq("step_id", byType.vocab.id).order("sort_order"));
    for (const r of rows) items.push(bbItem("bb_vocab", r, "audio_path", "🔤 Từ vựng", r.word_vi, r.pos ? `Loại từ: ${r.pos}` : null, MAX_SECONDS));
  }
  if (byType.phonics) {
    const rows = check(await sb.from("bb_phonics_pairs").select("*").eq("step_id", byType.phonics.id).order("sort_order"));
    for (const r of rows) {
      items.push(bbItem("bb_phonics_pairs", r, "audio_a_path", "🎧 Ngữ âm", r.sound_a, `Cặp âm dễ nhầm với “${r.sound_b}”`, MAX_SECONDS));
      items.push(bbItem("bb_phonics_pairs", r, "audio_b_path", "🎧 Ngữ âm", r.sound_b, `Cặp âm dễ nhầm với “${r.sound_a}”`, MAX_SECONDS));
    }
  }
  if (byType.reading) {
    const rows = check(await sb.from("bb_reading_passages").select("*").eq("step_id", byType.reading.id).order("id"));
    for (const r of rows) items.push(bbItem("bb_reading_passages", r, "audio_path", "📖 Đọc hiểu (đọc cả đoạn)", r.passage_vi, null, MAX_SECONDS_LONG));
  }
  return items;
}

// ---------------------------------------------------------------------------- danh sách bài để chọn (2 giáo trình)
// id giữ NGUYÊN DẠNG CHUỖI (không ép Number()) — khớp kiểu bất kể lesson_id/bb_lesson_steps.lesson_id trả về là số
// hay chuỗi (PostgREST luôn nhận đúng qua .eq() dù truyền số hay chuỗi số); loadBbItems so bằng String() cho chắc.
function parseLessonKey(key) {
  if (!key) return null;
  const i = key.indexOf(":");
  return { kind: key.slice(0, i), id: key.slice(i + 1) };
}
function buildOptions(data) {
  const bank = data.units.find((u) => u.title_vi === BANK_UNIT);
  const bankOptions = bank
    ? [...data.lessons].filter((l) => l.unit_id === bank.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((l) => ({ id: `child:${l.id}`, kind: "child", label: `🎙️ ${bank.title_vi} › ${l.title_vi}` }))
    : [];
  const childOptions = [...data.units].filter((u) => !u.hidden).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .flatMap((u) => data.lessons.filter((l) => l.unit_id === u.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((l) => ({ id: `child:${l.id}`, kind: "child", label: `${u.title_vi} › ${l.title_vi}` })));
  const bbOptions = [...data.bbLevels].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).flatMap((lv) =>
    [...data.bbUnits].filter((u) => u.level_id === lv.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).flatMap((u) =>
      [...data.bbLessons].filter((l) => l.unit_id === u.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((l) => ({ id: `bb:${l.id}`, kind: "bb", label: `${lv.code} · ${u.title_vi} › ${l.title_vi}` }))));
  return { bank, bankOptions, childOptions, bbOptions };
}

function render(box, data) {
  const flash = el("div");
  const say = (kind, text) => flash.replaceChildren(msg(kind, text));
  const { bank, bankOptions, childOptions, bbOptions } = buildOptions(data);
  const options = S.curriculum === "bb" ? [...bankOptions, ...bbOptions] : [...bankOptions, ...childOptions];
  if (!options.some((o) => o.id === S.lessonId)) S.lessonId = options[0]?.id ?? null;
  const showChildSettings = (options.find((o) => o.id === S.lessonId)?.kind ?? S.curriculum) === "child";

  const work = el("div");
  const curTabs = el("div", { class: "row-btns", style: "justify-content:flex-start" },
    el("button", { class: S.curriculum === "child" ? "btn small" : "btn small ghost", onclick: () => { S.curriculum = "child"; S.idx = 0; render(box, data); } }, "👶 Trẻ em"),
    el("button", { class: S.curriculum === "bb" ? "btn small" : "btn small ghost", onclick: () => { S.curriculum = "bb"; S.idx = 0; render(box, data); } }, "🎓 Bài Bản"));

  const sel = (label, key, opts, onChange) => {
    const s = el("select", { class: "cell", onchange: () => { S[key] = s.value; S.idx = 0; onChange?.(); } },
      opts.map(([v, t]) => el("option", { value: v, selected: String(S[key]) === String(v) }, t)));
    return el("label", { class: "rec-field" }, el("span", { class: "muted" }, label), s);
  };
  const lessonSel = el("select", { class: "cell", style: "min-width:260px", onchange: () => { S.lessonId = lessonSel.value; S.idx = 0; render(box, data); } },
    options.map((o) => el("option", { value: o.id, selected: o.id === S.lessonId }, o.label)));

  const settings = el("div", { class: "card rec-settings" },
    el("h2", null, "Thu giọng người thật"),
    curTabs,
    el("p", { class: "muted" }, showChildSettings
      ? "Chọn bài rồi thu từng mục. Cài đặt bên dưới áp dụng cho MỌI bản thu trong phiên này (mặc định: giọng nam, người lớn). Phòng yên tĩnh, miệng cách micro khoảng 15–20 cm, giữ khoảng cách đều."
      : "Chọn bài rồi thu từng mục (Hội thoại, Từ vựng, Ngữ âm, Đoạn đọc hiểu — Ngữ pháp/Luyện viết/Mini-game không cần giọng thu). Bài Bản chỉ giữ 1 bản ghi/mục (không phân biệt giọng nam/nữ như khu trẻ em) — thu lại sẽ THAY bản cũ."),
    el("div", { class: "rec-row" },
      el("label", { class: "rec-field" }, el("span", { class: "muted" }, "Bài"), lessonSel),
      showChildSettings ? sel("Giọng", "gender", [["male", "♂ Nam"], ["female", "♀ Nữ"]], () => loadAndDraw()) : null,
      showChildSettings ? sel("Loại giọng", "kind", [["adult", "Người lớn"], ["child", "Trẻ em"]], () => render(box, data)) : null,
      showChildSettings ? sel("Vùng", "region", REGIONS, () => loadAndDraw()) : null,
      showChildSettings ? sel("Tốc độ", "speed", [["normal", "Thường"], ["slow", "Chậm 🐢"]], () => loadAndDraw()) : null),
    showChildSettings && S.kind === "child" ? msg("err", "Giọng TRẺ EM là dữ liệu cá nhân của trẻ: chỉ thu khi có đồng ý bằng văn bản của phụ huynh trẻ đó.") : null);

  const bankBox = bank ? null : el("div", { class: "card" },
    el("h2", null, "Ngân hàng âm"),
    el("p", { class: "muted" }, "Chưa có. Ngân hàng âm là chủ đề ẨN (bé không thấy) gồm âm chữ cái (bờ, cờ…), nguyên âm, tên 6 dấu thanh và ~80 vần — cần giọng thu để sau này đánh vần theo từng phần. Dùng chung được cho cả 2 giáo trình. Bấm để tạo (chạy lại an toàn, chỉ thêm cái còn thiếu)."),
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

  async function reloadItems() {
    const k = parseLessonKey(S.lessonId);
    items = k.kind === "bb" ? await loadBbItems(k.id, data.bbSteps) : await loadChildItems(k.id);
  }

  async function loadAndDraw() {
    if (!S.lessonId) return;
    stopTimer();
    take = null; phase = "idle";
    work.replaceChildren(el("p", { class: "muted" }, A.loading));
    try { await reloadItems(); } catch (e) { return work.replaceChildren(msg("err", A.loadError + e.message)); }
    S.idx = Math.min(S.idx, Math.max(0, items.length - 1));
    draw();
  }

  const stopTimer = () => { clearInterval(timer); timer = null; };

  function draw() {
    const item = items[S.idx];
    const doneCount = items.filter((i) => i.hasAudio).length;
    if (!item) return work.replaceChildren(el("p", { class: "muted" }, S.curriculum === "bb"
      ? "Bài này chưa có chặng nào cần thu âm (Ngữ pháp/Luyện viết/Mini-game không cần giọng thu)."
      : "Bài này chưa có mục nào."));
    const have = item.hasAudio;
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
      el("div", { class: "muted" }, `Mục ${S.idx + 1}/${items.length} · đã thu ${doneCount}/${items.length}` +
        (showChildSettings ? ` (giọng ${S.gender === "male" ? "nam" : "nữ"}, ${S.kind === "child" ? "trẻ em" : "người lớn"}, ${S.speed === "slow" ? "chậm" : "thường"})` : "")),
      el("div", { class: "meter" }, el("div", { class: "meter-fill", style: `width:${items.length ? Math.round((100 * doneCount) / items.length) : 0}%` })),
      item.group ? el("div", { class: "muted" }, item.group) : null,
      el("div", { class: "rec-text" }, item.text),
      item.sub ? el("div", { class: "muted" }, item.sub) : null,
      el("div", { class: "row-btns", style: "justify-content:center" },
        btn("🔈 Nghe mẫu TTS", () => sample(item), "btn small ghost"),
        have ? btn("▶ Bản đã thu", item.playCurrent, "btn small ghost") : null,
        have ? btn("🗑 Xoá bản đã thu", async () => {
          if (!confirm(`Xoá bản thu của “${item.text}”?`)) return;
          try { await item.remove(); await loadAndDraw(); } catch (e) { say("err", e.message); }
        }, "btn small ghost danger") : null),
      have && phase === "idle" ? el("p", { class: "muted" }, "✓ Mục này đã có giọng thu. Thu lại sẽ thay bản cũ.") : null,
      controls,
      el("div", { class: "row-btns", style: "justify-content:space-between" },
        btn("◀ Trước", () => go(-1), "btn small ghost"), btn("Bỏ qua ▶", () => go(1), "btn small ghost")));

    const chips = el("div", { class: "rec-chips" }, items.map((it, i) =>
      el("button", { class: "chip" + (i === S.idx ? " now" : "") + (it.hasAudio ? " ok" : ""), title: it.group ?? "", onclick: () => { if (phase === "rec") return; S.idx = i; take = null; phase = "idle"; draw(); } },
        (it.hasAudio ? "✓ " : "") + it.text)));

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
    try { await audio.previewVoice("vi", undefined, item.sampleText, S.gender); }
    catch { // chưa cấu hình TTS → giọng của trình duyệt
      const u = new SpeechSynthesisUtterance(item.sampleText); u.lang = "vi-VN"; speechSynthesis.speak(u);
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
    const cap = items[S.idx]?.maxSeconds ?? MAX_SECONDS;
    draw();
    timer = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      if (work._clock) work._clock.textContent = `${s.toFixed(1)} s`;
      if (s >= cap) stopRec();
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
      await item.upload(new File([take.wav], "rec.wav", { type: "audio/wav" }));
      URL.revokeObjectURL(take.url); take = null; phase = "idle";
      // nạp lại âm thanh của bài rồi sang mục kế tiếp CHƯA thu (nếu còn), không thì mục kế
      await reloadItems();
      const nextTodo = items.findIndex((it, i) => i > S.idx && !it.hasAudio);
      S.idx = nextTodo >= 0 ? nextTodo : Math.min(S.idx + 1, items.length - 1);
      draw();
    } catch (e) { phase = "review"; draw(); say("err", "Chưa lưu được: " + e.message); }
  }

  async function batch(files) {
    if (!files.length) return;
    const norm = (s) => s.normalize("NFC").toLowerCase().trim();
    const byText = new Map(items.map((it) => [norm(it.text), it]));
    let ok = 0;
    const missed = [];
    for (const f of files) {
      const base = norm(f.name.replace(/\.[^.]+$/, ""));
      const it = byText.get(base);
      if (!it) { missed.push(f.name); continue; }
      try { await it.upload(f); ok++; } catch (e) { missed.push(`${f.name} (${e.message})`); }
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
  else work.replaceChildren(el("p", { class: "muted" }, S.curriculum === "bb"
    ? "Chưa có bài Bài Bản nào. Vào tab “Bài Bản” để thêm Cấp/Chủ đề/Bài trước (hoặc nhập CSV hàng loạt ở đó)."
    : "Chưa có bài nào. Nhập nội dung ở tab “Trẻ em” (mục Nhập CSV hàng loạt) hoặc tạo ngân hàng âm."));
}
