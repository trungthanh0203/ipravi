import { sb, contentUrl } from "../supabase.js";
import { CONFIG } from "../config.js";
import { el, msg } from "../ui.js";
import { A } from "./text.js";
import { beginLoad } from "./view.js";
import { notice } from "./notice.js";
import { moveIn } from "./ops.js";
import * as bb from "./bb-ops.js";
import * as bbCsv from "./bb-csv.js";

// Tab admin "Bài Bản" — soạn nội dung "Tiếng Việt Bài Bản" (xem KE_HOACH_TIENG_VIET_BAI_BAN.md GĐ 5).
// Cây: Cấp (bb_levels) → Chủ đề (bb_units) → Bài (bb_lessons) → Chặng (bb_lesson_steps, 7 loại) → nội dung riêng
// theo từng loại chặng. Cùng khuôn với admin/content.js (khu trẻ em): beginLoad giữ vị trí cuộn, notice giữ thông
// báo qua lần tải lại, slotToggle mở/đóng biểu mẫu, act() bọc thao tác báo lỗi + tải lại. ▲▼ đổi thứ tự dùng lại
// NGUYÊN ops.moveIn (mọi bảng bb_* đều có id + sort_order).

const langs = () => CONFIG.languages;
const btn = (label, onclick, cls = "btn small ghost", title) => el("button", { class: cls, type: "button", onclick, title }, label);
const pill = (status) => el("span", { class: `pill ${status === "approved" ? "good" : ""}` }, status === "approved" ? A.approved : A.draft);
const labeled = (label, input, note) => el("label", { class: "qa-field" }, el("span", { class: "muted" }, label), input, note ? el("small", { class: "muted" }, note) : null);
const footer = (saveBtn, cancel, err) => el("div", { class: "qa-actions" }, saveBtn, btn(A.cancel, cancel), err);
const fail = (box, e) => box.replaceChildren(msg("err", e.message ?? String(e)));
const slotToggle = (slot, make) => () => { if (slot.childNodes.length) slot.replaceChildren(); else slot.replaceChildren(make(() => slot.replaceChildren())); };

// Nhiều ô nhập theo từng ngôn ngữ đã cấu hình — dùng chung cho meaning/line_tr/formula_tr/passage_tr/prompt_tr
// (cùng hình dạng jsonb {lang: chữ}).
function langBlock(existing = {}, multiline = false) {
  const mk = (v) => (multiline ? el("textarea", { class: "cell", rows: "2" }, v ?? "") : el("input", { type: "text", class: "cell", value: v ?? "" }));
  const inputs = Object.fromEntries(langs().map((l) => [l.code, mk(existing?.[l.code])]));
  return { fields: langs().map((l) => labeled(l.label, inputs[l.code])), value: () => Object.fromEntries(langs().map((l) => [l.code, inputs[l.code].value])) };
}

const STEP_LABEL = { dialogue: "💬 Hội thoại", vocab: "🔤 Từ vựng", grammar: "📐 Ngữ pháp", phonics: "🎧 Ngữ âm", minigame: "🎮 Mini-game", reading: "📖 Đọc hiểu", writing: "✍️ Luyện viết" };
const LESSON_TYPE_LABEL = { core: "Bài học", review: "🏆 Ôn tập", reading: "Đọc hiểu", writing: "Luyện viết" };

let openLevels = new Set(), openUnits = new Set(), openLessons = new Set(), openSteps = new Set();

// ============================================================================
export async function mount(box) {
  const done = beginLoad(box);
  const check = (r) => { if (r.error) throw r.error; return r.data; };
  try {
    const [levels, units, lessons, steps] = await Promise.all([
      sb.from("bb_levels").select("*").order("sort_order").then(check),
      sb.from("bb_units").select("*").order("sort_order").then(check),
      sb.from("bb_lessons").select("*").order("sort_order").then(check),
      sb.from("bb_lesson_steps").select("*").order("sort_order").then(check),
    ]);
    render(box, { levels, units, lessons, steps });
  } catch (e) {
    box.replaceChildren(msg("err", A.loadError + e.message));
  }
  done();
}

function render(box, data) {
  const reload = () => mount(box);
  const flash = el("div");
  const say = (kind, text) => flash.replaceChildren(msg(kind, text));
  const carried = notice.take();
  if (carried) say(carried.kind, carried.text);
  const act = (fn, okText) => async () => {
    try { const r = await fn(); if (r === false) return; if (okText) notice.set("ok", okText); await reload(); } catch (e) { say("err", e.message); }
  };
  const ctx = { ...data, reload, say, act };

  const addSlot = el("div");
  const header = el("div", { class: "row-btns", style: "justify-content:flex-start" },
    btn("➕ Thêm cấp", slotToggle(addSlot, (close) => levelForm({
      levels: data.levels, onCancel: close,
      onSaved: (row) => { notice.set("ok", `Đã thêm cấp "${row.code}" (nháp).`); openLevels.add(row.id); reload(); },
    })), "btn small"));

  if (data.levels.length === 0) {
    box.replaceChildren(flash, header, addSlot, csvSection(ctx), el("div", { class: "card" }, el("p", { class: "muted" }, "Chưa có cấp độ nào. Thêm cấp đầu tiên (vd A1) để bắt đầu soạn nội dung, hoặc nhập CSV hàng loạt ở trên.")));
    return;
  }
  box.replaceChildren(flash, header, addSlot, csvSection(ctx), ...data.levels.map((lv) => levelCard(lv, ctx)));
}

// ---------------------------------------------------------------------------- Nhập CSV hàng loạt
function csvSection(ctx) {
  const text = el("textarea", { rows: "6", placeholder: "…hoặc dán nội dung CSV vào đây", style: "width:100%;font-family:monospace;font-size:13px" });
  const file = el("input", { type: "file", accept: ".csv,text/csv,text/plain" });
  file.addEventListener("change", async () => { if (file.files[0]) text.value = await file.files[0].text(); });
  const preview = el("div");
  const help = el("p", { class: "muted" },
    "Cột bắt buộc: level (mã CEFR vd A1), unit, lesson, step_type (dialogue|vocab|grammar|phonics|reading|writing). " +
    "Tuỳ chặng: dialogue dùng speaker+vi · vocab dùng vi+pos · grammar dùng vi (công thức)+examples (cách nhau ;) · " +
    "phonics dùng vi (âm A)+vi2 (âm B)+examples · reading: dòng đoạn văn dùng vi (để trống cột question), dòng câu " +
    "hỏi dùng question+choices (cách nhau |)+answer (số) · writing dùng task_type (fill|order|write)+vi (đề bài), " +
    "rồi fill dùng sentence+answer_text, order dùng words (cách nhau bằng dấu phẩy), write dùng min_words+sample. " +
    "Cột khác: level_name, can_do, unit_emoji, lesson_type, rồi 1 cột/ngôn ngữ (vd de, en) = bản dịch. " +
    "Mỗi bài chỉ 1 chặng/loại qua CSV — nhập lại không tạo trùng nội dung trong cùng chặng.");
  const runCheck = btn("Kiểm tra", () => {
    preview.replaceChildren(el("p", { class: "muted" }, A.loading));
    const parsed = bbCsv.parseCsv(text.value);
    const v = bbCsv.validateRows(parsed, { langs: langs().map((l) => l.code) });
    const plan = v.errors.length === 0 ? bbCsv.buildPlan(v.items, ctx) : null;
    renderPreview(v, plan);
  }, "btn small");

  function renderPreview(v, plan) {
    const go = btn("Nhập vào (tạo bản nháp)", async () => {
      go.disabled = true;
      try {
        const r = await bb.importPlan(plan, ctx);
        notice.set("ok", `Đã nhập: ${r.levels} cấp mới, ${r.units} chủ đề mới, ${r.lessons} bài mới, ${r.steps} chặng mới, ${r.rows} dòng nội dung (đã tạo/cập nhật). Nội dung mới đang ở trạng thái NHÁP.`);
        ctx.reload();
      } catch (e) {
        go.disabled = false;
        preview.append(msg("err", "Dừng giữa chừng: " + e.message + ". Có thể Kiểm tra rồi Nhập lại — mục đã nhập sẽ không bị trùng."));
      }
    }, "btn", v.errors.length ? "Còn lỗi, sửa file rồi kiểm tra lại" : undefined);
    go.disabled = v.errors.length > 0 || !plan;
    // el() (KHÔNG phải replaceChildren gốc) tự bỏ qua con null — bọc tất cả trong 1 el() rồi mới gắn vào preview,
    // tránh lặp lại đúng lỗi "[object HTMLDivElement]"/"null" đã gặp ở phần cây nội dung (replaceChildren gốc của
    // trình duyệt không tự lọc null/mảng, ép kiểu thành chuỗi rồi hiện thẳng lên màn hình).
    preview.replaceChildren(el("div", null,
      plan ? el("p", null, `${v.items.length} dòng hợp lệ · sẽ tạo ${plan.newLevels.length} cấp, ${plan.newUnits.length} chủ đề, ${plan.newLessons.length} bài, ${plan.newSteps.length} chặng mới.`)
        : el("p", null, "Chưa nhập được — sửa các lỗi sau rồi kiểm tra lại."),
      v.errors.length ? el("div", { class: "msg err" }, el("b", null, `${v.errors.length} lỗi (phải sửa):`),
        el("ul", null, v.errors.slice(0, 50).map((e) => el("li", null, `Dòng ${e.row}: ${e.msg}`))),
        v.errors.length > 50 ? `…và ${v.errors.length - 50} lỗi nữa` : null) : null,
      v.warnings.length ? el("details", { class: "msg warn" }, el("summary", null, `${v.warnings.length} cảnh báo (vẫn nhập được)`),
        el("ul", null, v.warnings.slice(0, 100).map((w) => el("li", null, `Dòng ${w.row}: ${w.msg}`)))) : null,
      go));
  }

  return el("details", { class: "qa-box" }, el("summary", null, "📄 Nhập CSV hàng loạt"),
    el("div", { class: "row-btns", style: "justify-content:flex-start" }, file, runCheck), text, help, preview);
}

// ---------------------------------------------------------------------------- Cấp
function levelForm({ levels, onCancel, onSaved }) {
  const err = el("div");
  const code = el("input", { type: "text", class: "cell cell-sm", maxlength: "2", placeholder: "A1" });
  const name = el("input", { type: "text", class: "cell", placeholder: "Sơ cấp 1" });
  const canDo = el("textarea", { class: "cell", rows: "2", placeholder: "Giới thiệu bản thân, chào hỏi…" });
  const save = btn(A.save, async () => {
    save.disabled = true;
    try { onSaved(await bb.createLevel({ code: code.value, name_vi: name.value, can_do: canDo.value }, levels)); }
    catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Mã cấp (CEFR: A1, A2, B1, B2, C1, C2)", code), labeled("Tên cấp", name)),
    labeled("Có thể làm được gì (can-do statement)", canDo), footer(save, onCancel, err));
}
function levelEditForm(level, onCancel, onSaved) {
  const err = el("div");
  const name = el("input", { type: "text", class: "cell", value: level.name_vi });
  const canDo = el("textarea", { class: "cell", rows: "2" }, level.can_do ?? "");
  const save = btn(A.save, async () => {
    save.disabled = true;
    try { await bb.updateLevel(level, { name_vi: name.value, can_do: canDo.value }); onSaved(); }
    catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled(`Tên cấp (mã ${level.code}, không đổi được)`, name)),
    labeled("Có thể làm được gì", canDo), footer(save, onCancel, err));
}

function levelCard(level, ctx) {
  const us = ctx.units.filter((u) => u.level_id === level.id);
  const open = openLevels.has(level.id);
  const editSlot = el("div"), addSlot = el("div");
  return el("div", { class: "card" },
    el("div", { class: "unit-head" },
      el("h2", { style: "margin:0" }, `${level.code} · ${level.name_vi} `, pill(level.status), el("span", { class: "muted" }, ` · ${us.length} chủ đề`)),
      el("div", { class: "row-btns unit-btns" },
        btn("✎ Sửa", slotToggle(editSlot, (close) => levelEditForm(level, close, () => { notice.set("ok", "Đã lưu cấp."); ctx.reload(); }))),
        btn("▲", ctx.act(() => moveIn("bb_levels", ctx.levels, level, -1), "Đã đổi thứ tự cấp."), "btn small ghost"),
        btn("▼", ctx.act(() => moveIn("bb_levels", ctx.levels, level, 1), "Đã đổi thứ tự cấp."), "btn small ghost"),
        btn(open ? "Thu gọn ▲" : "Mở ▼", () => { open ? openLevels.delete(level.id) : openLevels.add(level.id); ctx.reload(); }),
        level.status === "approved"
          ? btn("Ẩn cả cấp", ctx.act(() => bb.setLevelStatus(level, "draft"), "Đã ẩn cấp (mọi chủ đề/bài/chặng bên trong cũng ẩn theo)."))
          : btn("Duyệt cả cấp", ctx.act(async () => { if (!confirm(`Duyệt cấp "${level.name_vi}" và MỌI chủ đề/bài/chặng bên trong? Người học sẽ thấy ngay.`)) return false; await bb.setLevelStatus(level, "approved"); }, "Đã duyệt cấp."), "btn small"),
        btn("Xoá", ctx.act(async () => { if (!confirm(`Xoá cấp "${level.name_vi}" cùng MỌI chủ đề/bài/chặng/nội dung bên trong? Không hoàn tác được.`)) return false; await bb.deleteLevel(level.id); }, "Đã xoá cấp."), "btn small ghost danger"))),
    level.can_do ? el("p", { class: "muted" }, level.can_do) : null,
    editSlot,
    open ? el("div", null,
      el("div", { class: "row-btns", style: "justify-content:flex-start" },
        btn("➕ Thêm chủ đề", slotToggle(addSlot, (close) => unitForm(level.id, us, close, (row) => { notice.set("ok", `Đã thêm chủ đề "${row.title_vi}" (nháp).`); openUnits.add(row.id); ctx.reload(); })), "btn small")),
      addSlot, us.map((u) => unitCard(u, ctx))) : null);
}

// ---------------------------------------------------------------------------- Chủ đề
function unitForm(levelId, siblings, onCancel, onSaved) {
  const err = el("div");
  const title = el("input", { type: "text", class: "cell", placeholder: "Chào hỏi" });
  const emoji = el("input", { type: "text", class: "cell cell-sm", maxlength: "16", placeholder: "👋" });
  const desc = el("textarea", { class: "cell", rows: "2" });
  const save = btn(A.save, async () => {
    save.disabled = true;
    try { onSaved(await bb.createUnit(levelId, { title_vi: title.value, emoji: emoji.value, description: desc.value }, siblings)); }
    catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Tên chủ đề", title), labeled("Emoji", emoji)),
    labeled("Diễn giải (không bắt buộc)", desc), footer(save, onCancel, err));
}
function unitEditForm(unit, onCancel, onSaved) {
  const err = el("div");
  const title = el("input", { type: "text", class: "cell", value: unit.title_vi });
  const emoji = el("input", { type: "text", class: "cell cell-sm", maxlength: "16", value: unit.emoji ?? "" });
  const desc = el("textarea", { class: "cell", rows: "2" }, unit.description ?? "");
  const save = btn(A.save, async () => {
    save.disabled = true;
    try { await bb.updateUnit(unit, { title_vi: title.value, emoji: emoji.value, description: desc.value }); onSaved(); }
    catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Tên chủ đề", title), labeled("Emoji", emoji)),
    labeled("Diễn giải", desc), footer(save, onCancel, err));
}

function unitCard(unit, ctx) {
  const ls = ctx.lessons.filter((l) => l.unit_id === unit.id);
  const open = openUnits.has(unit.id);
  const editSlot = el("div"), addSlot = el("div");
  return el("div", { class: "card", style: "margin-left:16px" },
    el("div", { class: "unit-head" },
      el("h3", { style: "margin:0" }, `${unit.emoji ?? ""} ${unit.title_vi} `, pill(unit.status), el("span", { class: "muted" }, ` · ${ls.length} bài`)),
      el("div", { class: "row-btns unit-btns" },
        btn("✎ Sửa", slotToggle(editSlot, (close) => unitEditForm(unit, close, () => { notice.set("ok", "Đã lưu chủ đề."); ctx.reload(); }))),
        btn("▲", ctx.act(() => moveIn("bb_units", ctx.units.filter((u) => u.level_id === unit.level_id), unit, -1), "Đã đổi thứ tự chủ đề."), "btn small ghost"),
        btn("▼", ctx.act(() => moveIn("bb_units", ctx.units.filter((u) => u.level_id === unit.level_id), unit, 1), "Đã đổi thứ tự chủ đề."), "btn small ghost"),
        btn(open ? "Thu gọn ▲" : "Mở ▼", () => { open ? openUnits.delete(unit.id) : openUnits.add(unit.id); ctx.reload(); }),
        unit.status === "approved"
          ? btn("Ẩn cả chủ đề", ctx.act(() => bb.setUnitStatus(unit, "draft"), "Đã ẩn chủ đề."))
          : btn("Duyệt cả chủ đề", ctx.act(async () => { if (!confirm(`Duyệt "${unit.title_vi}" và mọi bài/chặng bên trong?`)) return false; await bb.setUnitStatus(unit, "approved"); }, "Đã duyệt chủ đề."), "btn small"),
        btn("Xoá", ctx.act(async () => { if (!confirm(`Xoá chủ đề "${unit.title_vi}" cùng ${ls.length} bài và mọi nội dung bên trong?`)) return false; await bb.deleteUnit(unit.id); }, "Đã xoá chủ đề."), "btn small ghost danger"))),
    editSlot,
    open ? el("div", null,
      el("div", { class: "row-btns", style: "justify-content:flex-start" },
        btn("➕ Thêm bài", slotToggle(addSlot, (close) => lessonForm(unit.id, ls, close, (row) => { notice.set("ok", `Đã thêm bài "${row.title_vi}" (nháp).`); openLessons.add(row.id); ctx.reload(); })), "btn small")),
      addSlot, ls.map((l) => lessonBlock(l, ctx))) : null);
}

// ---------------------------------------------------------------------------- Bài
function lessonTypeSelect(value) {
  return el("select", { class: "cell" }, Object.entries(LESSON_TYPE_LABEL).map(([v, label]) => el("option", { value: v, selected: v === value }, label)));
}
function lessonForm(unitId, siblings, onCancel, onSaved) {
  const err = el("div");
  const title = el("input", { type: "text", class: "cell", placeholder: "Bài 1: Xin chào" });
  const type = lessonTypeSelect("core");
  const tr = langBlock();
  const desc = el("textarea", { class: "cell", rows: "2" });
  const save = btn(A.save, async () => {
    save.disabled = true;
    try { onSaved(await bb.createLesson(unitId, { title_vi: title.value, lesson_type: type.value, title_tr: tr.value(), description: desc.value }, siblings)); }
    catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Tên bài", title), labeled("Loại bài", type), tr.fields),
    labeled("Diễn giải (không bắt buộc)", desc), footer(save, onCancel, err));
}
function lessonEditForm(lesson, onCancel, onSaved) {
  const err = el("div");
  const title = el("input", { type: "text", class: "cell", value: lesson.title_vi });
  const type = lessonTypeSelect(lesson.lesson_type);
  const tr = langBlock(lesson.title_tr);
  const desc = el("textarea", { class: "cell", rows: "2" }, lesson.description ?? "");
  const save = btn(A.save, async () => {
    save.disabled = true;
    try { await bb.updateLesson(lesson, { title_vi: title.value, lesson_type: type.value, title_tr: tr.value(), description: desc.value }); onSaved(); }
    catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Tên bài", title), labeled("Loại bài", type), tr.fields),
    labeled("Diễn giải", desc), footer(save, onCancel, err));
}

function lessonBlock(lesson, ctx) {
  const steps = ctx.steps.filter((s) => s.lesson_id === lesson.id);
  const siblingLessons = ctx.lessons.filter((l) => l.unit_id === lesson.unit_id);
  const open = openLessons.has(lesson.id);
  const editSlot = el("div"), addSlot = el("div");
  const addStepType = el("select", { class: "cell cell-sm" }, bb.STEP_TYPES.map((t) => el("option", { value: t }, STEP_LABEL[t])));
  return el("div", { class: "lesson-block", style: "margin-left:16px" },
    el("div", { class: "row lesson-row" },
      el("div", null, el("b", null, lesson.title_vi), " ", pill(lesson.status), el("span", { class: "muted" }, ` · ${LESSON_TYPE_LABEL[lesson.lesson_type]} · ${steps.length} chặng`)),
      el("div", { class: "row-btns", style: "margin:0" },
        btn("▲", ctx.act(() => moveIn("bb_lessons", siblingLessons, lesson, -1), "Đã đổi thứ tự bài."), "btn small ghost"),
        btn("▼", ctx.act(() => moveIn("bb_lessons", siblingLessons, lesson, 1), "Đã đổi thứ tự bài."), "btn small ghost"),
        btn("✎ Sửa", slotToggle(editSlot, (close) => lessonEditForm(lesson, close, () => { notice.set("ok", "Đã lưu bài."); ctx.reload(); }))),
        btn(open ? "Đóng chặng" : "Xem / sửa chặng", () => { open ? openLessons.delete(lesson.id) : openLessons.add(lesson.id); ctx.reload(); }),
        lesson.status === "approved"
          ? btn("Ẩn bài", ctx.act(() => bb.setLessonStatus(lesson, "draft"), "Đã ẩn bài."))
          : btn("Duyệt bài", ctx.act(() => bb.setLessonStatus(lesson, "approved"), "Đã duyệt bài (chủ đề/cấp chứa bài cũng được hiện)."), "btn small"),
        btn("Xoá bài", ctx.act(async () => { if (!confirm(`Xoá bài "${lesson.title_vi}" cùng ${steps.length} chặng và mọi nội dung bên trong?`)) return false; await bb.deleteLesson(lesson.id); }, "Đã xoá bài."), "btn small ghost danger"))),
    editSlot,
    open ? el("div", { style: "margin-left:16px" },
      el("div", { class: "row-btns", style: "justify-content:flex-start" },
        addStepType,
        btn("➕ Thêm chặng", async () => {
          try { const row = await bb.createStep(lesson.id, addStepType.value, steps); notice.set("ok", `Đã thêm chặng ${STEP_LABEL[row.step_type]} (nháp).`); openSteps.add(row.id); ctx.reload(); }
          catch (e) { ctx.say("err", e.message); }
        }, "btn small")),
      steps.map((s) => stepBlock(s, ctx))) : null);
}

// ---------------------------------------------------------------------------- Chặng
function stepBlock(step, ctx) {
  const siblingSteps = ctx.steps.filter((s) => s.lesson_id === step.lesson_id);
  const open = openSteps.has(step.id);
  const flash = el("div");
  const panel = el("div");
  return el("div", { class: "lesson-block", style: "margin-left:16px" },
    el("div", { class: "row lesson-row" },
      el("div", null, el("b", null, STEP_LABEL[step.step_type]), " ", pill(step.status)),
      el("div", { class: "row-btns", style: "margin:0" },
        btn("▲", ctx.act(() => moveIn("bb_lesson_steps", siblingSteps, step, -1), "Đã đổi thứ tự chặng."), "btn small ghost"),
        btn("▼", ctx.act(() => moveIn("bb_lesson_steps", siblingSteps, step, 1), "Đã đổi thứ tự chặng."), "btn small ghost"),
        btn(open ? "Đóng" : "Xem / sửa nội dung", () => { open ? openSteps.delete(step.id) : openSteps.add(step.id); ctx.reload(); }),
        step.status === "approved"
          ? btn("Ẩn chặng", ctx.act(() => bb.setStepStatus(step, "draft"), "Đã ẩn chặng."))
          : btn("Duyệt chặng", ctx.act(() => bb.setStepStatus(step, "approved"), "Đã duyệt chặng (bài/chủ đề/cấp chứa nó cũng được hiện)."), "btn small"),
        btn("Xoá chặng", ctx.act(async () => { if (!confirm(`Xoá chặng ${STEP_LABEL[step.step_type]} cùng mọi nội dung bên trong?`)) return false; await bb.deleteStep(step.id); }, "Đã xoá chặng."), "btn small ghost danger"))),
    open ? el("div", null, flash, panel) : null,
    open ? loadStepContent(panel, step, (kind, text) => flash.replaceChildren(msg(kind, text))) : null);
}

// say() SỐNG NGOÀI panel (ở flash riêng, xem stepBlock) nên KHÔNG bị mất khi refresh() vẽ lại panel — lỗi cũ:
// say() rồi refresh() ngay sau đó xoá luôn thông báo trước khi kịp thấy.
function loadStepContent(panel, step, say) {
  const done = beginLoad(panel);
  const refresh = () => loadStepContent(panel, step, say);
  (async () => {
    try {
      if (step.step_type === "dialogue") await dialoguePanel(panel, step, say, refresh);
      else if (step.step_type === "vocab") await vocabPanel(panel, step, say, refresh);
      else if (step.step_type === "grammar") await grammarPanel(panel, step, say, refresh);
      else if (step.step_type === "phonics") await phonicsPanel(panel, step, say, refresh);
      else if (step.step_type === "reading") await readingPanel(panel, step, say, refresh);
      else if (step.step_type === "writing") await writingPanel(panel, step, say, refresh);
      else panel.replaceChildren(el("p", { class: "muted" }, "Mini-game không có nội dung soạn riêng — chạy runtime từ Từ vựng/Ngữ âm của bài (Giai đoạn 4)."));
    } catch (e) {
      panel.replaceChildren(msg("err", A.loadError + e.message));
    }
    done();
  })();
}

const rowHead = (...parts) => el("div", { class: "row", style: "align-items:flex-start" }, el("div", null, ...parts));
const rowActs = (...buttons) => el("div", { class: "row-btns", style: "margin:0" }, ...buttons);
// text (tuỳ chọn): có chữ thì hiện thêm nút "🔊 TTS" sinh giọng đọc qua /api/tts (dùng lại NGUYÊN pipeline TTS của
// khu trẻ em — xem bb-ops.generateAudio); không có chữ (vd chưa nhập gì) thì chỉ còn nút tải file tay.
const audioBtn = (label, table, row, col, refresh, say, text) => {
  const file = el("input", { type: "file", accept: "audio/*", style: "display:none" });
  file.addEventListener("change", async () => {
    if (!file.files[0]) return;
    try { await bb.setAudioPath(table, row, col, file.files[0]); say("ok", "Đã tải âm thanh."); refresh(); } catch (e) { say("err", e.message); }
  });
  const ttsBtn = text ? btn("🔊 TTS", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try { await bb.generateAudio(table, row, col, text); say("ok", "Đã sinh giọng đọc (TTS)."); refresh(); }
    catch (err) { b.disabled = false; say("err", err.message); }
  }, "btn tiny") : null;
  return el("span", { class: "row-btns", style: "margin:0" },
    row[col] ? btn("▶ " + label, () => new Audio(contentUrl(row[col])).play(), "btn tiny") : null,
    ttsBtn,
    btn(row[col] ? "🔄 Đổi" : "⬆ " + label, () => file.click(), "btn tiny"),
    row[col] ? btn("✕", async () => { try { await bb.clearAudioPath(table, row, col); say("ok", "Đã gỡ âm thanh."); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost") : null,
    file);
};

// ---- Hội thoại ----
async function dialoguePanel(panel, step, say, refresh) {
  const { data, error } = await sb.from("bb_dialogue_lines").select("*").eq("step_id", step.id).order("sort_order");
  if (error) throw error;
  const addSlot = el("div");
  panel.replaceChildren(
    btn("➕ Thêm dòng thoại", slotToggle(addSlot, (close) => dialogueForm(null, step.id, data, close, () => { say("ok", "Đã thêm."); refresh(); })), "btn small"),
    addSlot,
    ...data.map((row) => {
      const editSlot = el("div");
      return el("div", { class: "bb-row" },
        rowHead(el("span", { class: "pill" }, row.speaker), " ", el("b", null, row.line_vi), Object.values(row.line_tr ?? {}).length ? el("div", { class: "muted" }, Object.values(row.line_tr).join(" · ")) : null),
        rowActs(
          audioBtn("Nghe", "bb_dialogue_lines", row, "audio_path", refresh, say, row.line_vi),
          btn("▲", async () => { try { await moveIn("bb_dialogue_lines", data, row, -1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("▼", async () => { try { await moveIn("bb_dialogue_lines", data, row, 1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("✎", slotToggle(editSlot, (close) => dialogueForm(row, step.id, data, close, () => { say("ok", "Đã lưu."); refresh(); })), "btn tiny ghost"),
          btn("✕", async () => { if (!confirm(`Xoá dòng "${row.line_vi}"?`)) return; try { await bb.deleteDialogueLine(row); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost danger")),
        editSlot);
    }));
}
function dialogueForm(existing, stepId, siblings, onCancel, onSaved) {
  const err = el("div");
  const speaker = el("input", { type: "text", class: "cell cell-sm", value: existing?.speaker ?? "A", maxlength: "20" });
  const vi = el("textarea", { class: "cell", rows: "2" }, existing?.line_vi ?? "");
  const tr = langBlock(existing?.line_tr);
  const save = btn(A.save, async () => {
    save.disabled = true;
    try {
      if (existing) await bb.updateDialogueLine(existing, { speaker: speaker.value, line_vi: vi.value, line_tr: tr.value() });
      else await bb.createDialogueLine(stepId, { speaker: speaker.value, line_vi: vi.value, line_tr: tr.value() }, siblings);
      onSaved();
    } catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Vai (vd A, B)", speaker), labeled("Câu tiếng Việt", vi), tr.fields), footer(save, onCancel, err));
}

// ---- Từ vựng ----
async function vocabPanel(panel, step, say, refresh) {
  const { data, error } = await sb.from("bb_vocab").select("*").eq("step_id", step.id).order("sort_order");
  if (error) throw error;
  const addSlot = el("div");
  panel.replaceChildren(
    btn("➕ Thêm từ", slotToggle(addSlot, (close) => vocabForm(null, step.id, data, close, () => { say("ok", "Đã thêm."); refresh(); })), "btn small"),
    addSlot,
    ...data.map((row) => {
      const editSlot = el("div");
      const img = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp", style: "display:none" });
      img.addEventListener("change", async () => {
        if (!img.files[0]) return;
        try { await bb.setImage("bb_vocab", row, img.files[0]); say("ok", "Đã lưu ảnh."); refresh(); } catch (e) { say("err", e.message); }
      });
      return el("div", { class: "bb-row" },
        rowHead(row.image_path ? el("img", { class: "thumb", src: contentUrl(row.image_path), alt: "" }) : null,
          el("b", null, row.word_vi), row.pos ? el("span", { class: "pill" }, row.pos) : null,
          Object.values(row.meaning ?? {}).length ? el("div", { class: "muted" }, Object.values(row.meaning).join(" · ")) : null),
        rowActs(
          audioBtn("Nghe", "bb_vocab", row, "audio_path", refresh, say, row.word_vi),
          btn(row.image_path ? "🔄 Ảnh" : "⬆ Ảnh", () => img.click(), "btn tiny"), img,
          btn("▲", async () => { try { await moveIn("bb_vocab", data, row, -1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("▼", async () => { try { await moveIn("bb_vocab", data, row, 1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("✎", slotToggle(editSlot, (close) => vocabForm(row, step.id, data, close, () => { say("ok", "Đã lưu."); refresh(); })), "btn tiny ghost"),
          btn("✕", async () => { if (!confirm(`Xoá từ "${row.word_vi}"?`)) return; try { await bb.deleteVocab(row); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost danger")),
        editSlot);
    }));
}
function vocabForm(existing, stepId, siblings, onCancel, onSaved) {
  const err = el("div");
  const word = el("input", { type: "text", class: "cell", value: existing?.word_vi ?? "" });
  const pos = el("input", { type: "text", class: "cell cell-sm", value: existing?.pos ?? "", placeholder: "danh từ…" });
  const tr = langBlock(existing?.meaning);
  const save = btn(A.save, async () => {
    save.disabled = true;
    try {
      if (existing) await bb.updateVocab(existing, { word_vi: word.value, pos: pos.value, meaning: tr.value() });
      else await bb.createVocab(stepId, { word_vi: word.value, pos: pos.value, meaning: tr.value() }, siblings);
      onSaved();
    } catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Từ tiếng Việt", word), labeled("Loại từ", pos), tr.fields), footer(save, onCancel, err));
}

// ---- Ngữ pháp ----
async function grammarPanel(panel, step, say, refresh) {
  const { data, error } = await sb.from("bb_grammar").select("*").eq("step_id", step.id).order("sort_order");
  if (error) throw error;
  const addSlot = el("div");
  panel.replaceChildren(
    btn("➕ Thêm công thức", slotToggle(addSlot, (close) => grammarForm(null, step.id, data, close, () => { say("ok", "Đã thêm."); refresh(); })), "btn small"),
    addSlot,
    ...data.map((row) => {
      const editSlot = el("div");
      return el("div", { class: "bb-row" },
        rowHead(el("b", null, row.formula), Object.values(row.formula_tr ?? {}).length ? el("div", { class: "muted" }, Object.values(row.formula_tr).join(" · ")) : null,
          (row.examples ?? []).length ? el("ul", { class: "bb-examples" }, row.examples.map((ex) => el("li", null, ex.vi))) : null),
        rowActs(
          btn("▲", async () => { try { await moveIn("bb_grammar", data, row, -1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("▼", async () => { try { await moveIn("bb_grammar", data, row, 1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("✎", slotToggle(editSlot, (close) => grammarForm(row, step.id, data, close, () => { say("ok", "Đã lưu."); refresh(); })), "btn tiny ghost"),
          btn("✕", async () => { if (!confirm("Xoá công thức này?")) return; try { await bb.deleteGrammar(row.id); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost danger")),
        editSlot);
    }));
}
function grammarForm(existing, stepId, siblings, onCancel, onSaved) {
  const err = el("div");
  const formula = el("input", { type: "text", class: "cell", value: existing?.formula ?? "", placeholder: "Chào + đại từ" });
  const tr = langBlock(existing?.formula_tr);
  const examples = el("textarea", { class: "cell", rows: "3", placeholder: "Chào bạn\nChào cô" }, (existing?.examples ?? []).map((e) => e.vi).join("\n"));
  const save = btn(A.save, async () => {
    save.disabled = true;
    try {
      if (existing) await bb.updateGrammar(existing, { formula: formula.value, formula_tr: tr.value(), examples: examples.value });
      else await bb.createGrammar(stepId, { formula: formula.value, formula_tr: tr.value(), examples: examples.value }, siblings);
      onSaved();
    } catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Công thức", formula), tr.fields),
    labeled("Câu ví dụ (mỗi dòng 1 câu, chỉ tiếng Việt — dịch từng câu chưa hỗ trợ ở đây)", examples), footer(save, onCancel, err));
}

// ---- Ngữ âm ----
async function phonicsPanel(panel, step, say, refresh) {
  const { data, error } = await sb.from("bb_phonics_pairs").select("*").eq("step_id", step.id).order("sort_order");
  if (error) throw error;
  const addSlot = el("div");
  panel.replaceChildren(
    btn("➕ Thêm cặp âm", slotToggle(addSlot, (close) => phonicsForm(null, step.id, data, close, () => { say("ok", "Đã thêm."); refresh(); })), "btn small"),
    addSlot,
    ...data.map((row) => {
      const editSlot = el("div");
      return el("div", { class: "bb-row" },
        rowHead(el("b", null, `${row.sound_a} / ${row.sound_b}`), (row.examples ?? []).length ? el("div", { class: "muted" }, row.examples.join(" · ")) : null),
        rowActs(
          audioBtn("A", "bb_phonics_pairs", row, "audio_a_path", refresh, say, row.sound_a),
          audioBtn("B", "bb_phonics_pairs", row, "audio_b_path", refresh, say, row.sound_b),
          btn("▲", async () => { try { await moveIn("bb_phonics_pairs", data, row, -1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("▼", async () => { try { await moveIn("bb_phonics_pairs", data, row, 1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("✎", slotToggle(editSlot, (close) => phonicsForm(row, step.id, data, close, () => { say("ok", "Đã lưu."); refresh(); })), "btn tiny ghost"),
          btn("✕", async () => { if (!confirm("Xoá cặp âm này?")) return; try { await bb.deletePhonicsPair(row); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost danger")),
        editSlot);
    }));
}
function phonicsForm(existing, stepId, siblings, onCancel, onSaved) {
  const err = el("div");
  const a = el("input", { type: "text", class: "cell cell-sm", value: existing?.sound_a ?? "", placeholder: "ch" });
  const b = el("input", { type: "text", class: "cell cell-sm", value: existing?.sound_b ?? "", placeholder: "tr" });
  const examples = el("textarea", { class: "cell", rows: "2", placeholder: "cha - tra" }, (existing?.examples ?? []).join("\n"));
  const save = btn(A.save, async () => {
    save.disabled = true;
    try {
      if (existing) await bb.updatePhonicsPair(existing, { sound_a: a.value, sound_b: b.value, examples: examples.value });
      else await bb.createPhonicsPair(stepId, { sound_a: a.value, sound_b: b.value, examples: examples.value }, siblings);
      onSaved();
    } catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Âm A", a), labeled("Âm B", b)),
    labeled("Ví dụ minh hoạ (mỗi dòng 1 ví dụ)", examples), footer(save, onCancel, err));
}

// ---- Đọc hiểu: 1 đoạn văn + nhiều câu hỏi ----
async function readingPanel(panel, step, say, refresh) {
  const { data: passages, error } = await sb.from("bb_reading_passages").select("*").eq("step_id", step.id);
  if (error) throw error;
  const passage = passages[0] ?? null;
  if (!passage) {
    const addSlot = el("div");
    panel.replaceChildren(
      el("p", { class: "muted" }, "Chặng này chưa có đoạn văn."),
      btn("➕ Thêm đoạn văn", slotToggle(addSlot, (close) => passageForm(null, step.id, close, () => { say("ok", "Đã thêm."); refresh(); })), "btn small"),
      addSlot);
    return;
  }
  const { data: questions, error: e2 } = await sb.from("bb_reading_questions").select("*").eq("passage_id", passage.id).order("sort_order");
  if (e2) throw e2;
  const editSlot = el("div"), addQSlot = el("div");
  panel.replaceChildren(
    el("div", { class: "bb-row" },
      rowHead(el("p", { class: "bb-passage" }, passage.passage_vi), Object.values(passage.passage_tr ?? {}).length ? el("p", { class: "muted" }, Object.values(passage.passage_tr).join(" · ")) : null),
      rowActs(audioBtn("Nghe", "bb_reading_passages", passage, "audio_path", refresh, say, passage.passage_vi),
        btn("✎", slotToggle(editSlot, (close) => passageForm(passage, step.id, close, () => { say("ok", "Đã lưu."); refresh(); })), "btn tiny ghost"),
        btn("✕ Xoá đoạn văn", async () => { if (!confirm("Xoá đoạn văn cùng mọi câu hỏi bên trong?")) return; try { await bb.deletePassage(passage); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost danger"))),
    editSlot,
    el("h4", null, "Câu hỏi"),
    btn("➕ Thêm câu hỏi", slotToggle(addQSlot, (close) => questionForm(null, passage.id, questions, close, () => { say("ok", "Đã thêm."); refresh(); })), "btn small"),
    addQSlot,
    ...questions.map((q) => {
      const qEditSlot = el("div");
      return el("div", { class: "bb-row" },
        rowHead(el("b", null, q.question_vi), el("div", { class: "muted" }, q.choices.map((c, i) => (i + 1 === q.answer ? "✓ " : "") + c).join(" · "))),
        rowActs(
          btn("▲", async () => { try { await moveIn("bb_reading_questions", questions, q, -1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("▼", async () => { try { await moveIn("bb_reading_questions", questions, q, 1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("✎", slotToggle(qEditSlot, (close) => questionForm(q, passage.id, questions, close, () => { say("ok", "Đã lưu."); refresh(); })), "btn tiny ghost"),
          btn("✕", async () => { if (!confirm("Xoá câu hỏi này?")) return; try { await bb.deleteQuestion(q.id); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost danger")),
        qEditSlot);
    }));
}
function passageForm(existing, stepId, onCancel, onSaved) {
  const err = el("div");
  const vi = el("textarea", { class: "cell", rows: "4" }, existing?.passage_vi ?? "");
  const tr = langBlock(existing?.passage_tr, true);
  const save = btn(A.save, async () => {
    save.disabled = true;
    try {
      if (existing) await bb.updatePassage(existing, { passage_vi: vi.value, passage_tr: tr.value() });
      else await bb.createPassage(stepId, { passage_vi: vi.value, passage_tr: tr.value() });
      onSaved();
    } catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" }, labeled("Đoạn văn (tiếng Việt)", vi), el("div", { class: "qa-grid" }, tr.fields), footer(save, onCancel, err));
}
function questionForm(existing, passageId, siblings, onCancel, onSaved) {
  const err = el("div");
  const q = el("input", { type: "text", class: "cell", value: existing?.question_vi ?? "" });
  const choices = el("input", { type: "text", class: "cell", value: (existing?.choices ?? []).join(" | "), placeholder: "An | Bình | Chi" });
  const answer = el("input", { type: "number", class: "cell cell-sm", min: "1", value: existing?.answer ?? "1" });
  const save = btn(A.save, async () => {
    save.disabled = true;
    try {
      if (existing) await bb.updateQuestion(existing, { question_vi: q.value, choices: choices.value, answer: answer.value });
      else await bb.createQuestion(passageId, { question_vi: q.value, choices: choices.value, answer: answer.value }, siblings);
      onSaved();
    } catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Câu hỏi", q), labeled("Đáp án (cách nhau bằng |)", choices), labeled("Số thứ tự đáp án đúng", answer)),
    footer(save, onCancel, err));
}

// ---- Luyện viết ----
async function writingPanel(panel, step, say, refresh) {
  const { data, error } = await sb.from("bb_writing_tasks").select("*").eq("step_id", step.id).order("sort_order");
  if (error) throw error;
  const addSlot = el("div");
  const summary = (row) => row.task_type === "fill" ? `Điền từ: "${row.content?.sentence ?? ""}" → ${row.content?.answer ?? ""}`
    : row.task_type === "order" ? `Xếp câu: ${(row.content?.words ?? []).join(" / ")}`
    : `Viết tự do (≥ ${row.content?.min_words ?? 0} từ)`;
  panel.replaceChildren(
    btn("➕ Thêm bài luyện viết", slotToggle(addSlot, (close) => writingForm(null, step.id, data, close, () => { say("ok", "Đã thêm."); refresh(); })), "btn small"),
    addSlot,
    ...data.map((row) => {
      const editSlot = el("div");
      return el("div", { class: "bb-row" },
        rowHead(el("b", null, row.prompt_vi), el("div", { class: "muted" }, summary(row))),
        rowActs(
          btn("▲", async () => { try { await moveIn("bb_writing_tasks", data, row, -1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("▼", async () => { try { await moveIn("bb_writing_tasks", data, row, 1); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost"),
          btn("✎", slotToggle(editSlot, (close) => writingForm(row, step.id, data, close, () => { say("ok", "Đã lưu."); refresh(); })), "btn tiny ghost"),
          btn("✕", async () => { if (!confirm("Xoá bài luyện viết này?")) return; try { await bb.deleteWritingTask(row.id); refresh(); } catch (e) { say("err", e.message); } }, "btn tiny ghost danger")),
        editSlot);
    }));
}
function writingForm(existing, stepId, siblings, onCancel, onSaved) {
  const err = el("div");
  const taskType = el("select", { class: "cell", disabled: Boolean(existing) },
    ["fill", "order", "write"].map((v) => el("option", { value: v, selected: v === (existing?.task_type ?? "fill") }, v === "fill" ? "Điền từ" : v === "order" ? "Xếp câu" : "Viết tự do")));
  const prompt = el("input", { type: "text", class: "cell", value: existing?.prompt_vi ?? "" });
  const tr = langBlock(existing?.prompt_tr);
  const sentence = el("input", { type: "text", class: "cell", value: existing?.content?.sentence ?? "", placeholder: "Xin ___ !" });
  const answer = el("input", { type: "text", class: "cell", value: existing?.content?.answer ?? "" });
  const words = el("input", { type: "text", class: "cell", value: (existing?.content?.words ?? []).join(", "), placeholder: "Tôi, là, An" });
  const minWords = el("input", { type: "number", class: "cell cell-sm", min: "1", value: existing?.content?.min_words ?? "5" });
  const sample = el("textarea", { class: "cell", rows: "2" }, existing?.content?.sample ?? "");
  const fields = el("div");
  const paintFields = () => {
    const t = taskType.value;
    // Bọc trong el() (không gọi thẳng fields.replaceChildren với mảng/null) — cùng lý do đã sửa ở nơi khác trong
    // file này: replaceChildren GỐC không tự lọc null/dàn phẳng mảng.
    fields.replaceChildren(el("div", { class: "qa-grid" },
      t === "fill" ? [labeled("Câu có chỗ trống (đánh dấu bằng ___)", sentence), labeled("Đáp án", answer)] : null,
      t === "order" ? labeled("Các từ đúng thứ tự (cách nhau bằng dấu phẩy)", words) : null,
      t === "write" ? [labeled("Số từ tối thiểu", minWords), labeled("Câu mẫu (không bắt buộc)", sample)] : null));
  };
  taskType.addEventListener("change", paintFields);
  paintFields();
  const save = btn(A.save, async () => {
    save.disabled = true;
    try {
      const t = taskType.value;
      const content = t === "fill" ? { sentence: sentence.value.trim(), answer: answer.value.trim() }
        : t === "order" ? { words: words.value.split(",").map((w) => w.trim()).filter(Boolean) }
        : { min_words: Number(minWords.value) || 1, sample: sample.value.trim() || undefined };
      if (existing) await bb.updateWritingTask(existing, { prompt_vi: prompt.value, prompt_tr: tr.value(), content });
      else await bb.createWritingTask(stepId, { task_type: t, prompt_vi: prompt.value, prompt_tr: tr.value(), content }, siblings);
      onSaved();
    } catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled("Loại bài", taskType), labeled("Đề bài", prompt), tr.fields),
    fields, footer(save, onCancel, err));
}
