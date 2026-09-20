import { sb } from "../supabase.js";
import { CONFIG } from "../config.js";
import { el, msg } from "../ui.js";
import { A } from "./text.js";
import * as audio from "./audio.js";
import * as ops from "./ops.js";
import { notice } from "./notice.js";
import { guessGender } from "../voice-names.js";
import { LEVELS, levelOf } from "../levels.js";
import { beginLoad } from "./view.js";
import * as images from "./images.js";
import { matchFiles } from "./image-util.js";
import { emojiNodes } from "../emoji.js";
import { contentUrl } from "../supabase.js";

const langs = () => CONFIG.languages.map((l) => l.code);
const pill = (status) => el("span", { class: `pill ${status === "approved" ? "good" : ""}` }, status === "approved" ? A.approved : A.draft);
const btn = (label, onclick, cls = "btn small ghost", title) => el("button", { class: cls, onclick, title }, label);
const check = ({ error, data }) => { if (error) throw error; return data; };

let openUnits = new Set();
let openLesson = null;

// Trả vị trí cuộn sau khi vẽ xong. Nếu có bài đang mở thì danh sách từ được tải thêm (bất đồng bộ) → đợi itemsPanel gọi.
// ---- Hình của mục/chủ đề: xem trước + vai trò (đúng nghĩa/trang trí) + tải/gỡ ảnh riêng ----
const thumb = (thing, cls = "") => thing.image_path
  ? el("img", { class: `thumb ${cls}`, src: contentUrl(thing.image_path), alt: "", loading: "lazy" })
  : el("span", { class: `thumb emoji ${cls}` }, ...emojiNodes(thing.emoji || "❓"));

// Nút tải/gỡ ảnh cho 1 mục hoặc chủ đề (table: "content_items" | "units"). Xong thì gọi after().
function imageButtons(table, row, say, after) {
  const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp", style: "display:none" });
  file.addEventListener("change", async () => {
    if (!file.files[0]) return;
    try {
      const r = await images.setImage(table, row, file.files[0]);
      say("ok", `Đã lưu ảnh (${Math.round(r.bytes / 1024)} KB, đã thu nhỏ). Bé sẽ thấy ảnh này thay cho emoji.`);
      after();
    } catch (e) { say("err", e.message); }
  });
  return el("span", { class: "img-btns" },
    btn("🖼", () => file.click(), "btn tiny", row.image_path ? "Thay ảnh riêng" : "Tải ảnh riêng (thay emoji)"),
    row.image_path ? btn("✕", async () => {
      if (!confirm("Gỡ ảnh riêng? Bé sẽ thấy lại emoji.")) return;
      try { await images.clearImage(table, row); say("ok", "Đã gỡ ảnh."); after(); } catch (e) { say("err", e.message); }
    }, "btn tiny ghost", "Gỡ ảnh riêng, dùng lại emoji") : null,
    file);
}

// Ô chọn vai trò hình: ✓ đúng nghĩa (được dùng để chọn/ghép/đoán) | ✦ trang trí (chỉ để nhìn).
function picRole(item, say) {
  const s = el("select", { class: "cell", title: "Vai trò của hình. Hoạt động chọn/ghép theo hình chỉ dùng mục 'đúng nghĩa'.", onchange: async () => {
    try { check(await sb.from("content_items").update({ pic: s.value || null }).eq("id", item.id)); item.pic = s.value || null; say("ok", "Đã lưu vai trò hình."); }
    catch (e) { say("err", e.message); }
  } },
  el("option", { value: "", selected: item.pic !== "decor" }, "✓ Đúng nghĩa"), el("option", { value: "decor", selected: item.pic === "decor" }, "✦ Trang trí"));
  return s;
}

let pendingDone = null;
let cardView = false; // duyệt hình theo thẻ lớn
const flushDone = () => { const d = pendingDone; pendingDone = null; d?.(); };

export async function mount(box) {
  const done = beginLoad(box);
  try {
    const [units, lessons] = await Promise.all([
      sb.from("units").select("*").order("sort_order").then(check),
      sb.from("lessons").select("*, content_items(count)").order("sort_order").then(check),
    ]);
    flushDone(); // lượt tải trước (nếu còn treo) không được giữ chiều cao mãi
    if (openLesson) { pendingDone = done; setTimeout(flushDone, 4000); } // an toàn: bài đang mở đã bị xoá thì không đợi mãi
    render(box, units, lessons);
    if (!openLesson) done();
  } catch (e) {
    box.replaceChildren(msg("err", A.loadError + e.message));
    done();
  }
}

function render(box, units, lessons) {
  const reload = () => mount(box);
  const flash = el("div");
  const say = (kind, text) => flash.replaceChildren(msg(kind, text));
  const carried = notice.take();
  if (carried) say(carried.kind, carried.text);
  // Bọc thao tác: báo lỗi thân thiện + tải lại (thông báo thành công giữ qua lần tải lại)
  const act = (fn, okText) => async () => {
    try { await fn(); if (okText) notice.set("ok", okText); await reload(); } catch (e) { say("err", e.message); }
  };

  if (units.length === 0) {
    return box.replaceChildren(el("div", { class: "card" }, el("p", null, "Chưa có nội dung. Sang tab “Nhập CSV” để thêm chủ đề, bài và từ vựng.")));
  }

  const unitCard = (u) => {
    const ls = lessons.filter((l) => l.unit_id === u.id);
    const open = openUnits.has(u.id);
    const levelSel = el("select", { title: "Cấp của chủ đề", "aria-label": "Cấp của chủ đề", onchange: act(() => ops.setUnitLevel(u.id, levelSel.value), "Đã đổi cấp của chủ đề.") },
      LEVELS.map((L) => el("option", { value: String(L.n), selected: L.n === levelOf(u) }, `${L.emoji} Cấp ${L.n}`)));
    return el("div", { class: "card" },
      el("div", { class: "row" },
        el("h2", { style: "margin:0" }, `${u.emoji ?? ""} ${u.title_vi} `, pill(u.status), el("span", { class: "muted" }, ` · ${ls.length} bài`)),
        el("div", { class: "row-btns", style: "margin:0" },
          thumb(u, "tiny"), imageButtons("units", u, say, reload),
          btn("▲", act(() => ops.moveUnit(units, u, -1, levelOf), "Đã đổi thứ tự chủ đề."), "btn small ghost", "Đưa chủ đề lên trước"),
          btn("▼", act(() => ops.moveUnit(units, u, 1, levelOf), "Đã đổi thứ tự chủ đề."), "btn small ghost", "Đưa chủ đề xuống sau"),
          levelSel,
          btn(open ? "Thu gọn ▲" : "Mở ▼", () => { open ? openUnits.delete(u.id) : openUnits.add(u.id); reload(); }),
          u.status === "approved"
            ? btn("Ẩn cả chủ đề", act(() => ops.setUnitStatus(u.id, "draft"), "Đã ẩn chủ đề (bé không còn thấy)."))
            : btn("Duyệt cả chủ đề", act(async () => { if (!confirm(`Duyệt "${u.title_vi}" và mọi bài, mục từ bên trong? Bé sẽ thấy ngay.`)) return; await ops.setUnitStatus(u.id, "approved"); }, "Đã duyệt chủ đề."), "btn small"),
          btn("Xoá", act(async () => { if (!confirm(`Xoá chủ đề "${u.title_vi}" cùng ${ls.length} bài, mọi mục từ và âm thanh? Không hoàn tác được.`)) return; await ops.deleteUnit(u.id); }, "Đã xoá chủ đề."), "btn small ghost danger"))),
      open ? el("div", null, ls.map((l) => lessonBlock(l, reload, say))) : null);
  };

  // Nhóm theo cấp: tiêu đề mỗi cấp cho biết số chủ đề/bài/mục và bao nhiêu đã duyệt (cấp trống hiện "chưa có nội dung").
  const groups = LEVELS.map((L) => {
    const us = units.filter((u) => !u.hidden && levelOf(u) === L.n);
    const ls = lessons.filter((l) => us.some((u) => u.id === l.unit_id));
    const items = ls.reduce((a, l) => a + (l.content_items?.[0]?.count ?? 0), 0);
    const approved = us.filter((u) => u.status === "approved").length;
    return el("section", { class: "level-group" },
      el("div", { class: "level-head" },
        el("h2", null, `${L.emoji} Cấp ${L.n} · ${L.name}`),
        el("span", { class: "muted" }, us.length
          ? `${us.length} chủ đề (${approved} đã duyệt) · ${ls.length} bài · ${items} mục · ${L.focus}`
          : `Chưa có nội dung — ${L.focus}`)),
      us.map(unitCard));
  });
  // Chủ đề ẨN (ngân hàng âm): bé không thấy; ở đây để sinh TTS / xem — thu giọng người thật ở tab "Thu âm".
  const hidden = units.filter((u) => u.hidden);
  if (hidden.length) {
    groups.push(el("section", { class: "level-group" },
      el("div", { class: "level-head" }, el("h2", null, "🎙️ Ngân hàng âm (ẩn với bé)"), el("span", { class: "muted" }, "Âm chữ cái, vần, tên dấu thanh — thu giọng người thật ở tab “Thu âm”.")),
      hidden.map(unitCard)));
  }
  box.replaceChildren(flash, ...groups);
}

function lessonBlock(lesson, reload, say) {
  const n = lesson.content_items?.[0]?.count ?? 0;
  const panel = el("div");
  const isOpen = openLesson === lesson.id;
  const act = (fn, okText) => async () => {
    try { await fn(); if (okText) notice.set("ok", okText); await reload(); } catch (e) { say("err", e.message); }
  };
  const head = el("div", { class: "row lesson-row" },
    el("div", null, el("b", null, lesson.title_vi), " ", pill(lesson.status), el("span", { class: "muted" }, ` · ${n} mục`)),
    el("div", { class: "row-btns", style: "margin:0" },
      btn(isOpen ? "Đóng danh sách" : "Xem / sửa từ", () => { openLesson = isOpen ? null : lesson.id; reload(); }),
      lesson.status === "approved"
        ? btn("Ẩn bài", act(() => ops.setLessonStatus(lesson, "draft"), "Đã ẩn bài."))
        : btn("Duyệt bài", () => approveLesson(lesson, reload, say), "btn small"),
      btn("Xoá bài", act(async () => { if (!confirm(`Xoá bài "${lesson.title_vi}" cùng ${n} mục từ và âm thanh?`)) return; await ops.deleteLesson(lesson.id); }, "Đã xoá bài."), "btn small ghost danger")));
  if (isOpen) itemsPanel(panel, lesson, say);
  return el("div", { class: "lesson-block" }, head, panel);
}

async function loadItems(lessonId) {
  return sb.from("content_items").select("*, translations(lang, meaning), content_audio(*)")
    .eq("lesson_id", lessonId).order("sort_order").range(0, 999).then(check);
}

// Duyệt bài: cảnh báo nếu còn mục thiếu âm thanh / emoji / nghĩa (vẫn cho duyệt nếu admin đồng ý)
async function approveLesson(lesson, reload, say) {
  try {
    const items = await loadItems(lesson.id);
    const slots = audio.audioSlots(langs(), await audio.getVoices());
    const noAudio = items.filter((i) => slots.some((s) => audio.textFor(i, s.lang) && !audio.findAudio(i, s).length)).length;
    const noEmoji = items.filter((i) => !i.emoji && !i.image_path && i.item_type !== "question").length; // câu hỏi đọc hiểu không hiển thị hình
    const noMeaning = items.filter((i) => langs().some((l) => !audio.textFor(i, l))).length;
    const issues = [noAudio && `${noAudio} mục thiếu âm thanh (bé sẽ nghe giọng máy của trình duyệt)`, noEmoji && `${noEmoji} mục chưa có hình/emoji`, noMeaning && `${noMeaning} mục thiếu nghĩa`].filter(Boolean);
    if (issues.length && !confirm(`Bài "${lesson.title_vi}" còn:\n- ${issues.join("\n- ")}\n\nVẫn duyệt cho bé học?`)) return;
    await ops.setLessonStatus(lesson, "approved");
    notice.set("ok", "Đã duyệt bài (chủ đề chứa bài cũng được hiện).");
    await reload();
  } catch (e) { say("err", e.message); }
}

async function itemsPanel(panel, lesson, say) {
  const done = beginLoad(panel); // vùng đã có nội dung → giữ nguyên trong lúc tải lại (không nhảy trang)
  let items;
  try { items = await loadItems(lesson.id); } catch (e) { panel.replaceChildren(msg("err", A.loadError + e.message)); done(); return flushDone(); }
  const L = langs();
  const slots = audio.audioSlots(L, await audio.getVoices());
  const refresh = () => itemsPanel(panel, lesson, say);
  const progress = el("span", { class: "muted" });

  const runGen = async (replaceTts) => {
    genAll.disabled = regenAll.disabled = true;
    const r = await audio.generateMissing(items, L, (d, n) => { progress.textContent = ` Đang sinh ${d}/${n}…`; }, { replaceTts });
    progress.textContent = "";
    genAll.disabled = regenAll.disabled = false;
    const skip = r.skipped.length ? ` Bỏ qua ${r.skipped.join(", ")} (nhà cung cấp chưa có giọng → bé nghe giọng trình duyệt).` : "";
    if (r.total === 0) say("ok", "Không còn âm thanh nào thiếu.");
    else if (r.failed.length === 0) say("ok", `Đã sinh ${r.ok}/${r.total} âm thanh.${skip}`);
    else say("err", `Đã sinh ${r.ok}/${r.total} âm thanh. ${r.fatal ? `Dừng vì: ${r.fatal.message}` : `Lỗi: ${r.failed.slice(0, 3).map((f) => `${f.text} (${f.slot}): ${f.message}`).join("; ")}`}`);
    refresh();
  };
  const genAll = btn("🔊 Sinh âm thanh còn thiếu (TTS)", () => runGen(false), "btn small");
  const regenAll = btn("🔄 Sinh lại TTS bằng giọng hiện tại", () => {
    if (confirm("Sinh lại TOÀN BỘ âm thanh TTS của bài này bằng giọng đang chọn ở tab Cài đặt? (Âm thanh giọng người thật được giữ nguyên. Việc này tốn thêm ký tự TTS.)")) runGen(true);
  }, "btn small ghost");

  // Tải nhiều ảnh: tên file = chữ của mục ("bánh chưng.png"; không dấu "banh-chung.png" cũng được nếu không mơ hồ)
  const batchInput = el("input", { type: "file", multiple: true, accept: "image/png,image/jpeg,image/webp", style: "display:none" });
  batchInput.addEventListener("change", async () => {
    const { matched, unmatched, ambiguous } = matchFiles([...batchInput.files], items);
    let ok = 0;
    const failed = [];
    for (const [k, m] of matched.entries()) {
      progress.textContent = ` Đang tải ảnh ${k + 1}/${matched.length}…`;
      try { await images.setImage("content_items", m.item, m.file); ok++; } catch (e) { failed.push(`${m.file.name} (${e.message})`); }
    }
    progress.textContent = "";
    const bad = [...unmatched.map((n) => n + " (không khớp mục nào)"), ...ambiguous.map((n) => n + " (mơ hồ: hãy đặt tên đúng chữ có dấu)"), ...failed];
    say(bad.length ? "err" : "ok", `Đã tải ${ok}/${batchInput.files.length} ảnh.${bad.length ? " Không tải được: " + bad.slice(0, 6).join("; ") + (bad.length > 6 ? "…" : "") : ""}`);
    refresh();
  });
  const toggle = btn(cardView ? "📋 Xem dạng bảng" : "🖼 Xem dạng thẻ (duyệt hình)", () => { cardView = !cardView; refresh(); }, "btn small ghost");
  const batchBtn = btn("🖼 Tải nhiều ảnh", () => batchInput.click(), "btn small ghost", "Chọn nhiều file ảnh; tên file = chữ của mục, vd bánh chưng.png");

  const cardOf = (item) => {
    const emoji = el("input", { type: "text", value: item.emoji ?? "", class: "cell cell-sm", maxlength: "16", title: "Emoji (dùng khi chưa có ảnh riêng)" });
    emoji.addEventListener("change", async () => {
      try { check(await sb.from("content_items").update({ emoji: emoji.value.trim() || null }).eq("id", item.id)); say("ok", "Đã lưu emoji."); refresh(); }
      catch (e) { say("err", e.message); }
    });
    return el("div", { class: "item-card" + (item.pic === "decor" ? " decor" : "") },
      el("div", { class: "item-pic" }, thumb(item, "big")),
      el("b", null, item.text_vi),
      el("div", { class: "muted" }, audio.textFor(item, L[0]) || "\u00a0"),
      el("label", { class: "rec-field" }, el("span", { class: "muted" }, "Vai trò hình"), picRole(item, say)),
      el("div", { class: "row-btns", style: "margin:0;justify-content:flex-start" }, emoji, imageButtons("content_items", item, say, refresh)));
  };

  const rows = cardView ? [] : items.map((item) => itemRow(item, L, slots, say, refresh));
  panel.replaceChildren(
    el("div", { class: "row-btns", style: "justify-content:flex-start" }, genAll, regenAll, toggle, batchBtn, progress, batchInput),
    el("p", { class: "muted" }, cardView
      ? "Duyệt hình: xem cả bài dạng thẻ lớn để kiểm tra hình có đúng nghĩa/hợp lý không. Hình ✦ trang trí (thẻ mờ) không được dùng để chọn/ghép trong các trò chơi."
      : "Ô âm thanh: ♀ giọng nữ · ♂ giọng nam · 🐢 đọc chậm. Ngôn ngữ không có ô nào = dùng giọng trình duyệt của thiết bị. Cột Hình: ✓ đúng nghĩa (dùng để chọn/ghép) hoặc ✦ trang trí; 🖼 tải ảnh riêng thay emoji."),
    cardView
      ? el("div", { class: "item-grid" }, items.map(cardOf))
      : el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
        el("thead", null, el("tr", null, ["Emoji", "Hình", "Tiếng Việt", ...L.map((l) => l.toUpperCase()), "Tuổi", "Âm thanh", ""].map((h) => el("th", null, h)))),
        el("tbody", null, rows))));
  done();
  flushDone();
}

function itemRow(item, L, slots, say, refresh) {
  const inp = (value, cls = "", attrs = {}) => el("input", { type: "text", value: value ?? "", class: `cell ${cls}`, ...attrs });
  const emoji = inp(item.emoji, "cell-sm");
  const vi = inp(item.text_vi);
  const trs = L.map((l) => inp(audio.textFor(item, l)));
  const minA = inp(item.min_age, "cell-xs", { inputmode: "numeric" });
  const maxA = inp(item.max_age, "cell-xs", { inputmode: "numeric" });
  const save = btn("Lưu", null, "btn small");
  save.style.display = "none";
  const dirty = () => { save.style.display = ""; };
  [emoji, vi, ...trs, minA, maxA].forEach((i) => i.addEventListener("input", dirty));

  save.addEventListener("click", async () => {
    try {
      save.disabled = true;
      const patch = {};
      const num = (v) => (v.trim() === "" ? null : Number(v));
      const min = num(minA.value), max = num(maxA.value);
      if ([min, max].some((v) => v != null && (!Number.isInteger(v) || v < 0 || v > 12))) throw new Error("Tuổi phải là số nguyên 0–12");
      if (min != null && max != null && min > max) throw new Error("Tuổi nhỏ nhất lớn hơn tuổi lớn nhất");
      if (!vi.value.trim()) throw new Error("Tiếng Việt không được để trống");
      if (emoji.value.trim() !== (item.emoji ?? "")) patch.emoji = emoji.value.trim() || null;
      if (min !== item.min_age) patch.min_age = min;
      if (max !== item.max_age) patch.max_age = max;
      if (vi.value.trim() !== item.text_vi) { patch.text_vi = vi.value.trim(); await audio.dropAudio(item.id, "vi"); } // âm thanh cũ không còn đúng chữ
      if (Object.keys(patch).length) check(await sb.from("content_items").update(patch).eq("id", item.id));
      for (const [i, l] of L.entries()) {
        const now = trs[i].value.trim();
        const was = audio.textFor(item, l);
        if (now === was) continue;
        if (now) check(await sb.from("translations").upsert({ item_id: item.id, lang: l, meaning: now }, { onConflict: "item_id,lang" }));
        else check(await sb.from("translations").delete().eq("item_id", item.id).eq("lang", l));
        await audio.dropAudio(item.id, l);
      }
      say("ok", "Đã lưu. Nếu đổi chữ, âm thanh cũ đã bị xoá — hãy sinh lại.");
      refresh();
    } catch (e) {
      save.disabled = false;
      say("err", e.message);
    }
  });

  const audioCell = el("td", { class: "audio-cell" }, slots.map((slot) => slotCell(item, slot, say, refresh)));
  return el("tr", null,
    el("td", null, emoji), el("td", { class: "pic-cell" }, thumb(item), picRole(item, say), imageButtons("content_items", item, say, refresh)), el("td", null, vi, item.say_vi ? el("div", { class: "muted", title: "Chữ đọc thành tiếng (cột say trong CSV)" }, "đọc: " + item.say_vi) : null,
      item.item_type === "question" && item.extra?.choices ? el("div", { class: "muted", title: "Câu hỏi đọc hiểu — đáp án đúng có dấu ✓" }, item.extra.choices.map((c, i) => (i + 1 === item.extra.answer ? "✓ " : "") + c).join(" · ")) : null), ...trs.map((t) => el("td", null, t)),
    el("td", { class: "nowrap" }, minA, "–", maxA), audioCell,
    el("td", { class: "nowrap" }, save, " ",
      btn("✕", async () => {
        if (!confirm(`Xoá "${item.text_vi}"?`)) return;
        try { await ops.deleteItem(item.id); refresh(); } catch (e) { say("err", e.message); }
      }, "btn small ghost danger", "Xoá mục này")));
}

function slotCell(item, slot, say, refresh) {
  const rows = audio.findAudio(item, slot);
  const has = rows.length > 0;
  const missingText = !audio.textFor(item, slot.lang);
  const file = el("input", { type: "file", accept: "audio/*", style: "display:none" });
  const run = (fn) => async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try { await fn(); refresh(); } catch (err) { b.disabled = false; say("err", `${slot.label}: ${err.message}`); }
  };
  file.addEventListener("change", async () => {
    if (!file.files[0]) return;
    const kind = (prompt("Loại giọng: adult (người lớn) hay child (trẻ em)?", "adult") || "adult").trim().toLowerCase();
    try { await audio.uploadHuman(item, slot, file.files[0], kind === "child" ? "child" : "adult"); refresh(); }
    catch (err) { say("err", `${slot.label}: ${err.message}`); }
  });
  const tag = has ? rows.some((r) => r.source === "human") ? "người" : "TTS" : "";
  // ⚠ = file TTS đọc bằng giọng có giới KHÁC nhãn ô (dữ liệu cũ gán sai) → cần sinh lại
  const wrong = rows.find((r) => r.source === "tts" && guessGender(r.voice_name) && guessGender(r.voice_name) !== slot.gender);
  return el("span", { class: `slot ${has ? "ok" : missingText ? "na" : "miss"}` },
    el("span", { class: "slot-label" }, slot.label, tag && el("small", null, ` ${tag}`), wrong && el("span", { title: `Giọng ${wrong.voice_name} không đúng giới của ô này — bấm ⟳ để sinh lại` }, " ⚠")),
    has ? btn("▶", () => audio.play(rows[0]), "btn tiny", rows[0].voice_name ? `Nghe thử — giọng ${rows[0].voice_name}` : "Nghe thử") : el("span", { class: "slot-x" }, missingText ? "–" : "✗"),
    missingText ? null : btn("⟳", run(() => audio.generate(item, slot)), "btn tiny", "Sinh lại bằng TTS"),
    missingText ? null : btn("⬆", () => file.click(), "btn tiny", "Tải giọng người thật lên"),
    file);
}
