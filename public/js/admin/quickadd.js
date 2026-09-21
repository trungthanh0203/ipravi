import { sb } from "../supabase.js";
import { CONFIG } from "../config.js";
import { el, msg } from "../ui.js";
import { A, Q, KIND_LABEL } from "./text.js";
import * as ops from "./ops.js";
import * as audio from "./audio.js";
import { LEVELS } from "../levels.js";
import { ACTIVITY_DEFAULTS, keyOf } from "./csv.js";
import { makeLookup, suggestItem, suggestUnit, suggestLesson, defaultKinds, parseLines, QUICK_TYPES } from "./autofill.js";

// Biểu mẫu "Thêm nhanh" + sửa tên (chủ đề / bài / từ-câu). Admin chỉ gõ chữ Việt; phần còn lại được điền sẵn bằng LUẬT (autofill.js) rồi xem lại và lưu.
// Mỗi hàm trả về 1 phần tử DOM để content.js chèn vào chỗ đang mở; onSaved/onCancel do content.js xử lý (tải lại danh sách + thông báo).

const langs = () => CONFIG.languages;
const btn = (label, onclick, cls = "btn small ghost", attrs = {}) => el("button", { class: cls, type: "button", onclick, ...attrs }, label);
const TYPE_LABEL = { word: "từ", phrase: "cụm từ", sentence: "câu", story: "truyện", song: "bài hát", letter: "chữ cái", syllable: "vần/tiếng" };

// Ô tự điền: nhớ admin đã sửa tay chưa — sửa rồi thì các lần gợi ý sau KHÔNG ghi đè.
function autoField(input) {
  let dirty = false;
  input.addEventListener("input", () => { dirty = true; });
  return { input, set(v) { if (!dirty) input.value = v ?? ""; } };
}
const labeled = (label, input, note) => el("label", { class: "qa-field" }, el("span", { class: "muted" }, label), input, note ? el("small", { class: "muted" }, note) : null);

// ---- Dữ liệu tra cứu: mọi mục đã có trong CSDL (chữ → emoji/nghĩa/loại). Tải 1 lần, nhớ tới khi có thay đổi. ----
let lookupCache = null;
export const resetLookup = () => { lookupCache = null; };
async function getLookup() {
  if (lookupCache) return lookupCache;
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("content_items").select("text_vi, emoji, item_type, translations(lang, meaning)").order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  lookupCache = makeLookup(rows);
  return lookupCache;
}
const withLookup = (fn) => getLookup().then(fn).catch(() => fn(makeLookup([]))); // lỗi mạng: vẫn dùng từ điển khởi đầu

const footer = (saveBtn, cancel, err) => el("div", { class: "qa-actions" }, saveBtn, btn(A.cancel, cancel), err);
const fail = (box, e) => box.replaceChildren(msg("err", e.message ?? String(e)));

// ---- Thêm chủ đề: chỉ cần gõ tên ----
export function unitForm({ level, units, onSaved, onCancel }) {
  const err = el("div");
  const title = el("input", { type: "text", placeholder: "Ví dụ: Động vật ở sở thú", maxlength: "60", class: "cell" });
  const emoji = autoField(el("input", { type: "text", class: "cell cell-sm", maxlength: "16", value: "📚" }));
  const lv = el("select", { class: "cell" }, LEVELS.map((L) => el("option", { value: String(L.n), selected: L.n === level }, `${L.emoji} Cấp ${L.n} · ${L.name}`)));
  const tr = Object.fromEntries(langs().map((l) => [l.code, autoField(el("input", { type: "text", class: "cell", placeholder: Q.missing }))]));
  let lookup = new Map();
  const refresh = () => {
    if (!title.value.trim()) return;
    const s = suggestUnit(title.value, { level: Number(lv.value), lookup, langs: langs().map((l) => l.code) });
    emoji.set(s.emoji);
    for (const l of langs()) tr[l.code].set(s.title_tr[l.code]);
  };
  withLookup((l) => { lookup = l; refresh(); });
  title.addEventListener("input", refresh);
  const save = btn(Q.saveDraft, async () => {
    save.disabled = true;
    try {
      const row = await ops.createUnit({ title_vi: title.value, emoji: emoji.input.value, level: lv.value, title_tr: Object.fromEntries(langs().map((l) => [l.code, tr[l.code].input.value])) }, units);
      onSaved(row);
    } catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled(Q.unitTitle, title), labeled("Cấp", lv), labeled("Emoji", emoji.input),
      langs().map((l) => labeled(`Tên bằng ${l.label}`, tr[l.code].input))),
    el("p", { class: "muted" }, Q.autoNote), footer(save, onCancel, err));
}

// ---- Thêm bài: gõ tên; bộ hoạt động điền sẵn theo cấp ----
export function lessonForm({ unit, level, siblings, onSaved, onCancel }) {
  const err = el("div");
  const title = el("input", { type: "text", placeholder: "Ví dụ: Con vật ở sở thú", maxlength: "60", class: "cell" });
  const tr = Object.fromEntries(langs().map((l) => [l.code, autoField(el("input", { type: "text", class: "cell", placeholder: Q.missing }))]));
  const boxes = Object.keys(ACTIVITY_DEFAULTS).map((kind) => ({ kind, box: el("input", { type: "checkbox", checked: defaultKinds(level).includes(kind) }) }));
  let lookup = new Map();
  const refresh = () => {
    if (!title.value.trim()) return;
    const s = suggestLesson(title.value, { level, lookup, langs: langs().map((l) => l.code) });
    for (const l of langs()) tr[l.code].set(s.title_tr[l.code]);
  };
  withLookup((l) => { lookup = l; refresh(); });
  title.addEventListener("input", refresh);
  const save = btn(Q.saveDraft, async () => {
    save.disabled = true;
    try {
      const row = await ops.createLesson(unit.id, { title_vi: title.value, kinds: boxes.filter((b) => b.box.checked).map((b) => b.kind), title_tr: Object.fromEntries(langs().map((l) => [l.code, tr[l.code].input.value])) }, siblings);
      onSaved(row);
    } catch (e) { save.disabled = false; fail(err, e); }
  }, "btn small");
  return el("div", { class: "qa-box" },
    el("div", { class: "qa-grid" }, labeled(Q.lessonTitle, title), langs().map((l) => labeled(`Tên bằng ${l.label}`, tr[l.code].input))),
    el("details", { class: "qa-kinds" }, el("summary", null, `Hoạt động của bài (điền sẵn theo Cấp ${level}; bỏ trò không hợp nội dung được)`),
      el("div", { class: "qa-kind-grid" }, boxes.map((b) => el("label", { class: "qa-kind" }, b.box, " ", KIND_LABEL[b.kind] ?? b.kind)))),
    el("p", { class: "muted" }, Q.autoNote), footer(save, onCancel, err));
}

// ---- Sửa tên (bài) hoặc tên + emoji (chủ đề) ----
export function renameForm({ title, emoji, withEmoji = false, onSave, onCancel }) {
  const err = el("div");
  const t = el("input", { type: "text", value: title, maxlength: "60", class: "cell" });
  const e = el("input", { type: "text", value: emoji ?? "", maxlength: "16", class: "cell cell-sm" });
  const save = btn(A.save, async () => {
    save.disabled = true;
    try { await onSave({ title_vi: t.value, ...(withEmoji ? { emoji: e.value } : {}) }); } catch (x) { save.disabled = false; fail(err, x); }
  }, "btn small");
  return el("div", { class: "qa-box" }, el("div", { class: "qa-grid" }, labeled("Tên (tiếng Việt)", t), withEmoji ? labeled("Emoji", e) : null), footer(save, onCancel, err));
}

// ---- Thêm từ / câu: gõ nhiều dòng, xem trước bảng đã điền sẵn, sửa nhanh rồi lưu ----
// existingKeys: Set(keyOf(chữ)) của các mục đã có trong bài (dòng trùng bị bỏ qua). lesson.status quyết định trạng thái mục mới.
export function itemsForm({ lesson, level, existingKeys, onSaved, onCancel }) {
  const err = el("div");
  const area = el("textarea", { class: "cell qa-area", rows: "5", placeholder: "con chó\ncon mèo\nCon chào bà ạ." });
  const preview = el("div");
  const info = el("p", { class: "muted" });
  const ttsOn = el("input", { type: "checkbox", checked: Object.keys(CONFIG.ttsVoices ?? {}).length > 0 });
  const codes = langs().map((l) => l.code);
  const rows = new Map(); // key → { s (gợi ý, sửa được), include }
  let lookup = new Map();
  let timer = null;

  const save = btn("", null, "btn small");
  const includedRows = () => [...rows.values()].filter((r) => r.include);
  const updateSave = () => { const n = includedRows().length; save.textContent = `${Q.saveDraft} ${n} mục`; save.disabled = n === 0; };

  const srcNote = (s, lang) => {
    const src = lang ? s.src.tr[lang] : s.src.emoji;
    if (!src) return null;
    return el("small", { class: "qa-src" }, src === "db" ? Q.srcDb : src === "dict" ? Q.srcDict : src === "rule" ? Q.srcRule : Q.srcGuess(s.src.emojiFrom));
  };

  function rowEl(r) {
    const s = r.s;
    const on = (k) => (e) => { s[k] = e.target.value; };
    const type = el("select", { class: "cell", onchange: on("item_type") }, QUICK_TYPES.map((t) => el("option", { value: t, selected: t === s.item_type }, TYPE_LABEL[t] ?? t)));
    const emoji = el("input", { type: "text", class: "cell cell-sm", value: s.emoji, maxlength: "16", oninput: on("emoji") });
    const say = el("input", { type: "text", class: "cell cell-sm", value: s.say_vi, placeholder: "đọc", title: "Cách đọc thành tiếng nếu khác chữ hiển thị (vd chữ b đọc là bờ)", oninput: on("say_vi") });
    const trs = codes.map((c) => {
      const inp = el("input", { type: "text", class: "cell" + (s.tr[c] ? "" : " warn"), value: s.tr[c], placeholder: Q.missing, oninput: (e) => { s.tr[c] = e.target.value; inp.classList.toggle("warn", !e.target.value.trim()); } });
      return el("td", null, inp, srcNote(s, c));
    });
    const inc = el("input", { type: "checkbox", checked: r.include, onchange: (e) => { r.include = e.target.checked; updateSave(); } });
    return el("tr", null, el("td", null, inc), el("td", null, el("b", null, s.text_vi)),
      el("td", null, type), el("td", null, emoji, srcNote(s)), ...trs, el("td", null, say));
  }

  function render() {
    if (!rows.size) { preview.replaceChildren(); updateSave(); return; }
    preview.replaceChildren(el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
      el("thead", null, el("tr", null, ["Lưu", "Tiếng Việt", "Loại", "Emoji", ...langs().map((l) => l.label), "Cách đọc"].map((h) => el("th", null, h)))),
      el("tbody", null, [...rows.values()].map(rowEl)))));
    updateSave();
  }

  function recompute() {
    const { lines, duplicates } = parseLines(area.value, existingKeys);
    const keep = new Map();
    for (const t of lines) {
      const k = keyOf(t);
      keep.set(k, rows.get(k) ?? { include: true, s: suggestItem(t, { level, lookup, langs: codes }) });
    }
    rows.clear();
    for (const [k, v] of keep) rows.set(k, v);
    info.textContent = duplicates.length ? `Bỏ qua ${duplicates.length} dòng đã có trong bài hoặc bị lặp: ${duplicates.slice(0, 5).join(", ")}${duplicates.length > 5 ? "…" : ""}` : "";
    render();
  }
  area.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(recompute, 200); });
  withLookup((l) => { lookup = l; if (area.value.trim()) { rows.clear(); recompute(); } });

  save.addEventListener("click", async () => {
    const chosen = includedRows().map((r) => r.s);
    save.disabled = true;
    err.replaceChildren();
    try {
      const made = await ops.createItems(lesson, chosen.map((s) => ({ ...s })));
      resetLookup(); // mục mới cũng thành nguồn tra cứu cho lần sau
      let tts = null;
      if (ttsOn.checked && made.length) {
        info.textContent = "Đang sinh âm thanh…";
        tts = await audio.generateMissing(made, codes, (d, n) => { info.textContent = `Đang sinh âm thanh ${d}/${n}…`; });
      }
      onSaved({ count: made.length, tts });
    } catch (e) { save.disabled = false; fail(err, e); }
  });
  updateSave();

  return el("div", { class: "qa-box" },
    el("p", { class: "muted" }, Q.itemsHelp), area, info, preview,
    el("label", { class: "qa-tts" }, ttsOn, " ", Q.ttsAfter),
    lesson.status === "approved" ? el("p", { class: "muted" }, "Bài đang ở trạng thái ĐÃ DUYỆT nên mục mới hiện cho bé ngay sau khi lưu.") : null,
    el("p", { class: "muted" }, Q.autoNote), footer(save, onCancel, err));
}
