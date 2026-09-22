import { sb } from "../supabase.js";
import { CONFIG } from "../config.js";
import { el, msg } from "../ui.js";
import { A, CSV_HELP, aiPrompt } from "./text.js";
import { parseCsv, validateRows, buildPlan, buildTemplate, keyOf, activitiesFor, summarizeChanges } from "./csv.js";
import { dropAudio } from "./audio.js";

const langs = () => CONFIG.languages.map((l) => l.code);
const chunk = (arr, n = 200) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const check = ({ error, data }) => { if (error) throw error; return data; };

// Đọc dữ liệu ĐÃ CÓ liên quan tới file (chỉ các bài có trong file — không tải cả bảng, tránh trần 1000 dòng).
async function loadExisting(items) {
  const units = check(await sb.from("units").select("*"));
  const lessons = check(await sb.from("lessons").select("*"));
  const unitByKey = new Map(units.map((u) => [keyOf(u.title_vi), u]));
  const wanted = new Set();
  for (const it of items) {
    const u = unitByKey.get(keyOf(it.unit));
    const l = u && lessons.find((x) => x.unit_id === u.id && keyOf(x.title_vi) === keyOf(it.lesson));
    if (l) wanted.add(l.id);
  }
  const existingItems = [];
  for (const lessonId of wanted) {
    const rows = check(await sb.from("content_items")
      .select("id, lesson_id, text_vi, say_vi, extra, pic, emoji, item_type, min_age, max_age, sort_order, translations(lang, meaning)")
      .eq("lesson_id", lessonId).range(0, 999));
    for (const r of rows) existingItems.push({ ...r, tr: Object.fromEntries((r.translations ?? []).map((t) => [t.lang, t.meaning])) });
  }
  return { units, lessons, items: existingItems };
}

// Ghi vào CSDL. Chạy lại an toàn (không tạo trùng): chủ đề/bài/mục đã có được tái sử dụng.
async function execute(plan, ex, onProgress) {
  const unitId = new Map(ex.units.map((u) => [keyOf(u.title_vi), u.id]));
  const unitTitleById = new Map(ex.units.map((u) => [u.id, keyOf(u.title_vi)]));
  const lessonId = new Map(ex.lessons.map((l) => [`${unitTitleById.get(l.unit_id)}|${keyOf(l.title_vi)}`, l.id]));
  const counts = { units: 0, lessons: 0, items: 0, updated: 0, translations: 0 };

  onProgress("Tạo chủ đề", 0, 1);
  if (plan.newUnits.length) {
    let order = Math.max(0, ...ex.units.map((u) => u.sort_order ?? 0));
    const rows = check(await sb.from("units")
      .insert(plan.newUnits.map((u) => ({ title_vi: u.title, emoji: u.emoji, level: u.level ?? 1, sort_order: ++order, status: "draft", ...(Object.keys(u.tr ?? {}).length ? { title_tr: u.tr } : {}) })))
      .select("id, title_vi"));
    rows.forEach((u) => { unitId.set(keyOf(u.title_vi), u.id); });
    counts.units = rows.length;
  }

  for (const c of plan.levelChanges ?? []) check(await sb.from("units").update({ level: c.level }).eq("id", c.id));

  for (const c of plan.titleChanges ?? []) check(await sb.from(c.table).update({ title_tr: c.title_tr }).eq("id", c.id));

  onProgress("Tạo bài học", 0, 1);
  if (plan.newLessons.length) {
    const nextOrder = new Map();
    for (const l of ex.lessons) nextOrder.set(l.unit_id, Math.max(nextOrder.get(l.unit_id) ?? 0, l.sort_order ?? 0));
    const payload = plan.newLessons.map((l) => {
      const uid = unitId.get(keyOf(l.unit));
      nextOrder.set(uid, (nextOrder.get(uid) ?? 0) + 1);
      return { unit_id: uid, title_vi: l.title, sort_order: nextOrder.get(uid), status: "draft", ...(Object.keys(l.tr ?? {}).length ? { title_tr: l.tr } : {}) };
    });
    const rows = check(await sb.from("lessons").insert(payload).select("id, unit_id, title_vi"));
    const titleOfUnit = new Map([...unitId].map(([k, v]) => [v, k]));
    rows.forEach((l) => lessonId.set(`${titleOfUnit.get(l.unit_id)}|${keyOf(l.title_vi)}`, l.id));
    counts.lessons = rows.length;
    // Mỗi bài mới có sẵn bộ hoạt động (theo cột "activities" của CSV; trống = 4 hoạt động chuẩn), nháp, được duyệt cùng bài
    const kindsByKey = new Map(plan.newLessons.map((l) => [`${keyOf(l.unit)}|${keyOf(l.title)}`, l.kinds]));
    check(await sb.from("activities").insert(rows.flatMap((l) =>
      activitiesFor(kindsByKey.get(`${titleOfUnit.get(l.unit_id)}|${keyOf(l.title_vi)}`)).map(([kind, config], i) => ({ lesson_id: l.id, kind, config, sort_order: i + 1, status: "draft" })))));
  }

  const lid = (it) => lessonId.get(`${keyOf(it.unit)}|${keyOf(it.lesson)}`);
  const orderIn = new Map();
  for (const i of ex.items) orderIn.set(i.lesson_id, Math.max(orderIn.get(i.lesson_id) ?? 0, i.sort_order ?? 0));

  // Mục mới
  const fresh = plan.rows.filter((r) => r.status === "new");
  const idOf = new Map();
  let done = 0;
  for (const part of chunk(fresh)) {
    onProgress("Thêm mục từ", done, fresh.length);
    const payload = part.map((r) => {
      const l = lid(r.item);
      orderIn.set(l, (orderIn.get(l) ?? 0) + 1);
      return { lesson_id: l, item_type: r.item.type, text_vi: r.item.vi, say_vi: r.item.say || null, pic: r.item.pic === "decor" ? "decor" : null, extra: r.item.type === "question" ? { choices: r.item.choices, answer: r.item.answer } : null, emoji: r.item.emoji || null,
        min_age: r.item.minAge, max_age: r.item.maxAge, sort_order: orderIn.get(l), status: "draft" };
    });
    const rows = check(await sb.from("content_items").insert(payload).select("id, lesson_id, text_vi"));
    rows.forEach((r) => idOf.set(`${r.lesson_id}|${keyOf(r.text_vi)}`, r.id));
    done += part.length;
  }
  counts.items = fresh.length;

  // Mục đã có nhưng đổi: chỉ ghi các trường thật sự đổi; đổi nghĩa -> âm thanh của ngôn ngữ đó không còn đúng
  const changed = plan.rows.filter((r) => r.status === "update");
  for (const [n, r] of changed.entries()) {
    onProgress("Cập nhật mục đã có", n, changed.length);
    const patch = {};
    if (r.changed.includes("extra")) patch.extra = { choices: r.item.choices, answer: r.item.answer };
    if (r.changed.includes("pic")) patch.pic = r.item.pic === "decor" ? "decor" : null;
    if (r.changed.includes("emoji")) patch.emoji = r.item.emoji;
    if (r.changed.includes("say")) { patch.say_vi = r.item.say; await dropAudio(r.existing.id, "vi"); } // đổi chữ đọc → âm thanh cũ không còn đúng
    if (r.changed.includes("type")) patch.item_type = r.item.type;
    if (r.changed.includes("min_age")) patch.min_age = r.item.minAge;
    if (r.changed.includes("max_age")) patch.max_age = r.item.maxAge;
    if (Object.keys(patch).length) check(await sb.from("content_items").update(patch).eq("id", r.existing.id));
    for (const c of r.changed.filter((x) => x.startsWith("tr:"))) await dropAudio(r.existing.id, c.slice(3));
  }
  counts.updated = changed.length;

  // Nghĩa: mục mới -> mọi nghĩa; mục cập nhật -> chỉ các ngôn ngữ đổi
  const tr = [];
  for (const r of plan.rows) {
    const id = r.status === "new" ? idOf.get(`${lid(r.item)}|${keyOf(r.item.vi)}`) : r.existing?.id;
    if (!id || r.status === "same") continue;
    for (const [lang, meaning] of Object.entries(r.item.tr)) {
      if (r.status === "new" || r.changed.includes(`tr:${lang}`)) tr.push({ item_id: id, lang, meaning });
    }
  }
  let t = 0;
  for (const part of chunk(tr)) {
    onProgress("Ghi nghĩa", t, tr.length);
    check(await sb.from("translations").upsert(part, { onConflict: "item_id,lang" }));
    t += part.length;
  }
  counts.translations = tr.length;
  return counts;
}

export function mount(box, { onImported } = {}) {
  const preview = el("div");
  const text = el("textarea", { rows: "6", placeholder: "…hoặc dán nội dung CSV vào đây", style: "width:100%;font-family:monospace;font-size:13px" });
  const file = el("input", { type: "file", accept: ".csv,text/csv,text/plain" });
  const download = (name, content, type) => {
    const a = el("a", { href: URL.createObjectURL(new Blob([content], { type })), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  async function check_() {
    preview.replaceChildren(el("p", { class: "muted" }, A.loading));
    const parsed = parseCsv(text.value);
    const v = validateRows(parsed, { langs: langs() });
    let plan = null;
    let ex = null;
    if (v.errors.length === 0) {
      try {
        ex = await loadExisting(v.items);
        plan = buildPlan(v.items, ex);
      } catch (e) {
        return preview.replaceChildren(msg("err", A.loadError + e.message));
      }
    }
    render(v, plan, ex);
  }

  function render(v, plan, ex) {
    const blocking = v.errors.length > 0;
    const status = { new: ["Mới", "good"], update: ["Cập nhật", ""], same: ["Không đổi", ""] };
    const progress = el("p", { class: "muted" });
    const result = el("div");
    // Có gì để ghi không: mục mới/đổi, HOẶC chỉ đổi cấp/tên dịch của chủ đề-bài (không đổi mục từ/câu nào) — trường hợp
    // sau vẫn phải cho nhập, không thì đổi cấp hàng loạt qua CSV sẽ không bấm được (lỗi cũ, phát hiện khi đảo cấp giáo trình).
    const nothingToDo = plan && plan.counts.new + plan.counts.update + (plan.levelChanges?.length ?? 0) + (plan.titleChanges?.length ?? 0) === 0;
    const go = el("button", { class: "btn", disabled: blocking || !plan || nothingToDo }, "Nhập vào (tạo bản nháp)");
    go.addEventListener("click", async () => {
      go.disabled = true;
      result.replaceChildren();
      try {
        const c = await execute(plan, ex, (stage, d, n) => { progress.textContent = `${stage}… ${d}/${n}`; });
        progress.textContent = "";
        result.replaceChildren(msg("ok",
          `Xong: ${c.units} chủ đề, ${c.lessons} bài, ${c.items} mục mới, ${c.updated} mục cập nhật, ${c.translations} nghĩa. ` +
          "Nội dung đang ở trạng thái NHÁP — sang tab Nội dung để sinh âm thanh và Duyệt."));
        onImported?.();
      } catch (e) {
        progress.textContent = "";
        result.replaceChildren(msg("err", `Dừng giữa chừng: ${e.message}. Có thể bấm Kiểm tra rồi Nhập lại — mục đã nhập sẽ không bị trùng.`));
        go.disabled = false;
      }
    });

    preview.replaceChildren(
      el("p", null, plan
        ? `${v.items.length} dòng hợp lệ: ${plan.counts.new} mới, ${plan.counts.update} cập nhật, ${plan.counts.same} không đổi` +
          ` · sẽ tạo ${plan.newUnits.length} chủ đề, ${plan.newLessons.length} bài` + (plan.levelChanges?.length ? `, đổi cấp ${plan.levelChanges.length} chủ đề` : "") + (plan.titleChanges?.length ? `, cập nhật tên dịch ${plan.titleChanges.length} chủ đề/bài` : "") + "."
        : "Chưa thể nhập — sửa các lỗi sau rồi kiểm tra lại."),
      plan && plan.counts.update ? el("p", { class: "muted" }, "Sẽ đổi ở các mục đã có: " + summarizeChanges(plan).map(([k, n]) => `${k} (${n})`).join(" · ") + ".") : null,
      plan ? el("p", { class: "muted" }, "Lưu ý: bài ĐÃ CÓ không bị đổi bộ hoạt động khi nhập lại (chỉ bài mới có hoạt động ghi trong cột activities). Không thấy thay đổi mong đợi? Tải lại trang (Ctrl+F5) để chắc chắn đang chạy bản app mới nhất, và kiểm tra file CSV có đúng cột (vd pic, say, activities).") : null,
      v.errors.length ? el("div", { class: "msg err" }, el("b", null, `${v.errors.length} lỗi (phải sửa):`),
        el("ul", null, v.errors.slice(0, 50).map((e) => el("li", null, `Dòng ${e.row}: ${e.msg}`))),
        v.errors.length > 50 && `…và ${v.errors.length - 50} lỗi nữa`) : null,
      v.warnings.length ? el("details", { class: "msg warn" }, el("summary", null, `${v.warnings.length} cảnh báo (vẫn nhập được)`),
        el("ul", null, v.warnings.slice(0, 100).map((w) => el("li", null, `Dòng ${w.row}: ${w.msg}`)))) : null,
      plan ? el("table", { class: "tbl" },
        el("thead", null, el("tr", null, ["Dòng", "Chủ đề", "Bài", "Tiếng Việt", "Emoji", ...langs(), ""].map((h) => el("th", null, h)))),
        el("tbody", null, plan.rows.slice(0, 100).map((r) =>
          el("tr", null,
            el("td", null, r.item.row), el("td", null, r.item.unit), el("td", null, r.item.lesson), el("td", null, r.item.vi),
            el("td", null, r.item.emoji), ...langs().map((l) => el("td", null, r.item.tr[l] ?? "")),
            el("td", null, el("span", { class: `pill ${status[r.status][1]}` }, status[r.status][0]))))),
        plan.rows.length > 100 && el("caption", null, `Hiện 100/${plan.rows.length} dòng đầu`)) : null,
      go, progress, result);
  }

  file.addEventListener("change", async () => {
    if (!file.files[0]) return;
    text.value = await file.files[0].text();
    check_();
  });

  box.replaceChildren(el("div", { class: "card" },
    el("h2", null, "Nhập nội dung bằng CSV"),
    el("p", { class: "muted" }, CSV_HELP),
    el("div", { class: "row-btns", style: "justify-content:flex-start" },
      el("button", { class: "btn small ghost", onclick: () => download("mau-noi-dung.csv", buildTemplate(langs()), "text/csv;charset=utf-8") }, "⬇ Tải file mẫu"),
      el("button", { class: "btn small ghost", onclick: async (e) => {
        try { await navigator.clipboard.writeText(aiPrompt(langs())); e.target.textContent = "✓ Đã sao chép"; }
        catch { text.value = aiPrompt(langs()); e.target.textContent = "Đã dán vào ô bên dưới"; }
      } }, "📋 Sao chép câu lệnh cho AI")),
    el("label", null, "Chọn file CSV"), file, text,
    el("button", { class: "btn small", onclick: check_ }, "Kiểm tra"),
    preview));
}
