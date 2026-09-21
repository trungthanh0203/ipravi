import { sb } from "../supabase.js";
import { CONFIG } from "../config.js";
import { el, msg } from "../ui.js";
import { A, Q, KIND_LABEL } from "./text.js";
import * as ops from "./ops.js";
import * as audio from "./audio.js";
import { LEVELS } from "../levels.js";
import { ACTIVITY_DEFAULTS, keyOf } from "./csv.js";
import { makeLookup, suggestItem, suggestUnit, suggestLesson, defaultKinds, parseLines, QUICK_TYPES, needsAi, applyAi } from "./autofill.js";
import { aiEnabled, suggest as aiSuggest } from "./ai.js";

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
  const aiBtn = aiEnabled() ? btn(Q.aiTitle, async () => {
    if (!title.value.trim()) return fail(err, new Error("Gõ tên chủ đề trước"));
    aiBtn.disabled = true; err.replaceChildren();
    const { results, error } = await aiSuggest([{ vi: title.value }], { context: { kind: "unit", level: Number(lv.value) }, langs: langs().map((l) => l.code), wantEmoji: true });
    aiBtn.disabled = false;
    if (error) return fail(err, error);
    const r = results[0];
    for (const l of langs()) if (!tr[l.code].input.value.trim() && r?.tr?.[l.code]) tr[l.code].input.value = r.tr[l.code];
    if (r?.emoji && ["", "📚"].includes(emoji.input.value.trim())) emoji.input.value = r.emoji;
    err.replaceChildren(msg("ok", Q.aiNote));
  }) : null;
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
    el("p", { class: "muted" }, Q.autoNote), aiBtn, footer(save, onCancel, err));
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
  const aiBtn = aiEnabled() ? btn(Q.aiTitle, async () => {
    if (!title.value.trim()) return fail(err, new Error("Gõ tên bài trước"));
    aiBtn.disabled = true; err.replaceChildren();
    const { results, error } = await aiSuggest([{ vi: title.value }], { context: { kind: "lesson", unit: unit.title_vi, level }, langs: langs().map((l) => l.code) });
    aiBtn.disabled = false;
    if (error) return fail(err, error);
    for (const l of langs()) if (!tr[l.code].input.value.trim() && results[0]?.tr?.[l.code]) tr[l.code].input.value = results[0].tr[l.code];
    err.replaceChildren(msg("ok", Q.aiNote));
  }) : null;
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
    el("p", { class: "muted" }, Q.autoNote), aiBtn, footer(save, onCancel, err));
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
export function itemsForm({ lesson, level, unitTitle = "", existingKeys, onSaved, onCancel }) {
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
  const aiBtn = aiEnabled() ? btn(Q.aiFill, async () => {
    const todo = includedRows().filter((r) => needsAi(r.s, codes));
    if (!todo.length) { info.textContent = "Không còn ô nào trống để AI điền."; return; }
    aiBtn.disabled = true; err.replaceChildren();
    const { results, error } = await aiSuggest(todo.map((r) => ({ vi: r.s.text_vi })), {
      context: { kind: "item", unit: unitTitle, lesson: lesson.title_vi, level }, wantEmoji: true,
      langs: codes.filter((c) => todo.some((r) => !String(r.s.tr[c] ?? "").trim())).length ? codes.filter((c) => todo.some((r) => !String(r.s.tr[c] ?? "").trim())) : codes, // chỉ hỏi ngôn ngữ còn thiếu (đỡ tốn, khỏi đổi nghĩa đã có)
      onProgress: (d, n) => { info.textContent = `AI đang dịch ${d}/${n}…`; } });
    const filled = todo.reduce((a, r, k) => a + applyAi(r.s, results[k], codes), 0);
    aiBtn.disabled = false;
    render();
    info.textContent = filled ? `AI đã điền ${filled} ô (màu tím) — hãy đọc lại kỹ trước khi lưu.` : "AI không điền được ô nào.";
    if (error) fail(err, error);
  }, "btn small") : null;
  const includedRows = () => [...rows.values()].filter((r) => r.include);
  const updateSave = () => { const n = includedRows().length; save.textContent = `${Q.saveDraft} ${n} mục`; save.disabled = n === 0; };

  const srcNote = (s, lang) => {
    const src = lang ? s.src.tr[lang] : s.src.emoji;
    if (!src) return null;
    return el("small", { class: "qa-src" + (src === "ai" ? " ai" : ""), }, src === "db" ? Q.srcDb : src === "dict" ? Q.srcDict : src === "rule" ? Q.srcRule : src === "ai" ? Q.srcAi : Q.srcGuess(s.src.emojiFrom));
  };

  function rowEl(r) {
    const s = r.s;
    const on = (k) => (e) => { s[k] = e.target.value; };
    const type = el("select", { class: "cell", onchange: on("item_type") }, QUICK_TYPES.map((t) => el("option", { value: t, selected: t === s.item_type }, TYPE_LABEL[t] ?? t)));
    const emoji = el("input", { type: "text", class: "cell cell-sm" + (s.src.emoji === "ai" ? " ai" : ""), value: s.emoji, maxlength: "16", oninput: (e) => { s.emoji = e.target.value; s.src.emoji = ""; emoji.classList.remove("ai"); } });
    const say = el("input", { type: "text", class: "cell cell-sm", value: s.say_vi, placeholder: "đọc", title: "Cách đọc thành tiếng nếu khác chữ hiển thị (vd chữ b đọc là bờ)", oninput: on("say_vi") });
    const trs = codes.map((c) => {
      const inp = el("input", { type: "text", class: "cell" + (s.tr[c] ? "" : " warn") + (s.src.tr[c] === "ai" ? " ai" : ""), value: s.tr[c], placeholder: Q.missing,
        oninput: (e) => { s.tr[c] = e.target.value; s.src.tr[c] = ""; inp.classList.remove("ai"); inp.classList.toggle("warn", !e.target.value.trim()); } });
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
    el("p", { class: "muted" }, Q.itemsHelp), area, aiBtn ? el("div", { class: "qa-actions" }, aiBtn) : null, info, preview,
    aiBtn ? el("p", { class: "muted" }, Q.aiNote) : null,
    el("label", { class: "qa-tts" }, ttsOn, " ", Q.ttsAfter),
    lesson.status === "approved" ? el("p", { class: "muted" }, "Bài đang ở trạng thái ĐÃ DUYỆT nên mục mới hiện cho bé ngay sau khi lưu.") : null,
    el("p", { class: "muted" }, Q.autoNote), footer(save, onCancel, err));
}

// ---- Dịch bổ sung các ô nghĩa còn thiếu bằng AI (cả bài hoặc cả chủ đề) ----
// getItems(): Promise<[{ id, text_vi, item_type, lesson_title, translations:[{lang, meaning}], content_audio }]>. Dùng khi thêm ngôn ngữ mới
// (vd Hàn/Nhật) cho nội dung đã có. AI chỉ điền ô TRỐNG; admin xem lại/sửa từng ô rồi mới lưu. Tối đa MAX mục mỗi lần (chạy lại sau khi lưu để làm tiếp).
const MAX_MISSING = 200;
export function missingForm({ getItems, unitTitle = "", level = 1, onSaved, onCancel }) {
  const err = el("div");
  const info = el("p", { class: "muted" }, "Đang tìm các ô còn thiếu…");
  const table = el("div");
  const codes = langs().map((l) => l.code);
  const ttsOn = el("input", { type: "checkbox", checked: false });
  const save = btn("", null, "btn small");
  save.disabled = true;
  let rows = []; // { item, inc, vals:{lang:string}, ai:{lang:bool}, need:[lang] }
  const updateSave = () => { const n = rows.filter((r) => r.inc).reduce((a, r) => a + r.need.filter((c) => r.vals[c].trim()).length, 0); save.textContent = `Lưu ${n} ô`; save.disabled = n === 0; };

  function render() {
    table.replaceChildren(el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
      el("thead", null, el("tr", null, ["Lưu", "Tiếng Việt", ...langs().map((l) => l.label)].map((h) => el("th", null, h)))),
      el("tbody", null, rows.map((r) => el("tr", null,
        el("td", null, el("input", { type: "checkbox", checked: r.inc, onchange: (e) => { r.inc = e.target.checked; updateSave(); } })),
        el("td", null, el("b", null, r.item.text_vi), r.item.lesson_title ? el("small", { class: "qa-src" }, r.item.lesson_title) : null),
        ...codes.map((c) => {
          const have = r.item.translations?.find((t) => t.lang === c)?.meaning;
          if (have) return el("td", null, el("span", { class: "muted" }, have));
          const inp = el("input", { type: "text", class: "cell" + (r.vals[c] ? "" : " warn") + (r.ai[c] ? " ai" : ""), value: r.vals[c], placeholder: Q.missing,
            oninput: (e) => { r.vals[c] = e.target.value; r.ai[c] = false; inp.classList.remove("ai"); inp.classList.toggle("warn", !e.target.value.trim()); updateSave(); } });
          return el("td", null, inp, r.ai[c] ? el("small", { class: "qa-src ai" }, Q.srcAi) : null);
        })))))));
    updateSave();
  }

  (async () => {
    try {
      const all = (await getItems()).filter((i) => i.item_type !== "question" && i.item_type !== "letter");
      const todo = all.filter((i) => codes.some((c) => !i.translations?.some((t) => t.lang === c && t.meaning)));
      if (!todo.length) { info.textContent = "Mọi mục đều đã đủ nghĩa ở các ngôn ngữ của trung tâm."; return; }
      const part = todo.slice(0, MAX_MISSING);
      const { results, error } = await aiSuggest(part.map((i) => ({ vi: i.text_vi, lesson: i.lesson_title })), {
        context: { kind: "item", unit: unitTitle, level }, wantEmoji: false,
        langs: codes.filter((c) => part.some((i) => !i.translations?.some((t) => t.lang === c && t.meaning))), onProgress: (d, n) => { info.textContent = `AI đang dịch ${d}/${n}…`; } });
      rows = part.map((item, k) => {
        const need = codes.filter((c) => !item.translations?.some((t) => t.lang === c && t.meaning));
        const vals = Object.fromEntries(codes.map((c) => [c, need.includes(c) ? results[k]?.tr?.[c] ?? "" : ""]));
        return { item, inc: true, need, vals, ai: Object.fromEntries(codes.map((c) => [c, Boolean(vals[c])])) };
      });
      info.textContent = `${part.length} mục thiếu nghĩa${todo.length > part.length ? ` (còn ${todo.length - part.length} mục nữa — lưu xong bấm lại để làm tiếp)` : ""}. Ô tím do AI điền: ${Q.aiNote}`;
      if (error) fail(err, error);
      render();
    } catch (e) { fail(err, e); info.textContent = ""; }
  })();

  save.addEventListener("click", async () => {
    save.disabled = true;
    err.replaceChildren();
    try {
      const out = [];
      const touched = [];
      for (const r of rows.filter((x) => x.inc)) {
        const fresh = r.need.filter((c) => r.vals[c].trim()).map((c) => ({ item_id: r.item.id, lang: c, meaning: r.vals[c].trim().slice(0, 200) }));
        if (fresh.length) { out.push(...fresh); touched.push({ ...r.item, translations: [...(r.item.translations ?? []), ...fresh.map(({ lang, meaning }) => ({ lang, meaning }))] }); }
      }
      for (let i = 0; i < out.length; i += 100) {
        const { error } = await sb.from("translations").upsert(out.slice(i, i + 100), { onConflict: "item_id,lang" });
        if (error) throw error;
      }
      let tts = null;
      if (ttsOn.checked && touched.length) tts = await audio.generateMissing(touched, codes, (d, n) => { info.textContent = `Đang sinh âm thanh ${d}/${n}…`; });
      resetLookup();
      onSaved({ count: out.length, items: touched.length, tts });
    } catch (e) { save.disabled = false; fail(err, e); }
  });

  return el("div", { class: "qa-box" }, info, table,
    el("label", { class: "qa-tts" }, ttsOn, " ", Q.ttsAfter), footer(save, onCancel, err));
}
