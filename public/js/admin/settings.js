import { sb } from "../supabase.js";
import { CONFIG } from "../config.js";
import { el, msg } from "../ui.js";
import { A } from "./text.js";
import { getVoices, resetVoices, previewVoice, audioSummary } from "./audio.js";
import { guessGender } from "../voice-names.js";

// Câu đọc thử theo ngôn ngữ (mỗi giọng phải đọc đúng tiếng của nó).
const SAMPLE = {
  vi: "Xin chào các con, chúng mình cùng học tiếng Việt nhé.",
  de: "Hallo, wir lernen zusammen Vietnamesisch.",
  en: "Hello, let's learn Vietnamese together.",
  ko: "안녕하세요, 함께 베트남어를 배워요.",
  ja: "こんにちは、一緒にベトナム語を勉強しましょう。",
  fr: "Bonjour, apprenons le vietnamien ensemble.",
  es: "Hola, aprendamos vietnamita juntos.",
  it: "Ciao, impariamo il vietnamita insieme.",
  zh: "你好，我们一起学习越南语吧。",
  pt: "Olá, vamos aprender vietnamita juntos.",
  nl: "Hallo, laten we samen Vietnamees leren.",
  pl: "Cześć, uczmy się razem wietnamskiego.",
  ru: "Привет, давайте вместе учить вьетнамский.",
  th: "สวัสดี เรามาเรียนภาษาเวียดนามด้วยกันนะ",
  cs: "Ahoj, pojďme se spolu učit vietnamsky.",
};
const GENDERS = [["female", "Giọng nữ ♀"], ["male", "Giọng nam ♂"]];
const VOICE_RE = /^[A-Za-z0-9]{2,8}-[A-Za-z0-9-]{2,64}$/; // phần sau mã ngôn ngữ, vd "VN-HoaiMyNeural"

export async function mount(box) {
  box.replaceChildren(el("p", { class: "muted" }, A.loading));
  const { data: s, error } = await sb.from("settings").select("*").eq("id", 1).single();
  if (error) return box.replaceChildren(msg("err", A.loadError + error.message));

  box.replaceChildren(generalCard(s), await voiceCard(s), aiCard(), diagnosticCard());
}

function generalCard(s) {
  const feedback = el("div");
  const f = {
    center_name: el("input", { type: "text", value: s.center_name, maxlength: "80" }),
    payment_instructions: el("textarea", { rows: "5", style: "width:100%" }, s.payment_instructions),
    extra_child_percent: el("input", { type: "number", min: "0", step: "0.5", value: s.extra_child_percent }),
    max_children: el("input", { type: "number", min: "1", max: "20", value: s.max_children }),
    trial_days: el("input", { type: "number", min: "0", max: "90", value: s.trial_days }),
    currency: el("input", { type: "text", maxlength: "3", value: s.currency }),
  };
  const field = (label, input, help) => el("div", null, el("label", null, label), input, help ? el("p", { class: "muted" }, help) : null);
  const form = el("form", null,
    field("Tên trung tâm/người dạy", f.center_name, "Chỉ để tham khảo trong CSDL. Tên hiển thị trên app lấy từ biến CENTER_NAME của Worker."),
    field("Hướng dẫn thanh toán (phụ huynh thấy khi gia hạn)", f.payment_instructions, "Ví dụ: số tài khoản ngân hàng/IBAN, PayPal, nội dung chuyển khoản cần ghi."),
    field("Phí mỗi con thêm (% học phí)", f.extra_child_percent, "Chỉ để gợi ý số tiền — bạn vẫn sửa được khi xác nhận."),
    field("Số con tối đa mỗi tài khoản", f.max_children),
    field("Số ngày dùng thử", f.trial_days, "Áp dụng cho tài khoản đăng ký MỚI."),
    field("Tiền tệ mặc định (mã 3 chữ, vd EUR)", f.currency),
    feedback, el("button", { class: "btn", type: "submit" }, A.save));

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const row = {
      center_name: f.center_name.value.trim() || s.center_name,
      payment_instructions: f.payment_instructions.value,
      extra_child_percent: Number(f.extra_child_percent.value),
      max_children: Number(f.max_children.value),
      trial_days: Number(f.trial_days.value),
      currency: f.currency.value.trim().toUpperCase(),
      updated_at: new Date().toISOString(),
    };
    if (!/^[A-Z]{3}$/.test(row.currency)) return feedback.replaceChildren(msg("err", "Tiền tệ gồm đúng 3 chữ cái (vd EUR)."));
    const { error: e } = await sb.from("settings").update(row).eq("id", 1);
    feedback.replaceChildren(e ? msg("err", e.message) : msg("ok", "Đã lưu cài đặt."));
  });
  return el("div", { class: "card" }, el("h2", null, A.tabs.settings), form);
}

async function voiceCard() {
  const provider = CONFIG.ttsProvider || "";
  const saved = await getVoices();
  const feedback = el("div");
  const langs = [["vi", "Tiếng Việt"], ...CONFIG.languages.filter((l) => l.code !== "vi").map((l) => [l.code, l.label])];
  const inputs = {}; // inputs[lang][gender]

  const rows = langs.map(([code, label]) => {
    const eff = CONFIG.ttsVoices?.[code] ?? {};
    inputs[code] = {};
    const cells = GENDERS.map(([gender, gLabel]) => {
      const listId = `voices-${code}-${gender}`;
      const input = el("input", { type: "text", value: saved[code]?.[gender] ?? "", list: listId, class: "cell", style: "min-width:230px",
        placeholder: eff[gender] ? `mặc định: ${eff[gender]}` : `${code}-XX-TênGiọng` });
      inputs[code][gender] = input;
      const listen = el("button", { type: "button", class: "btn tiny ghost", title: "Nghe thử giọng này", onclick: async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        feedback.replaceChildren();
        try {
          // Ô trống = giọng đang có hiệu lực (mặc định / TTS_VOICES) của giới này
          await previewVoice(code, input.value.trim() || undefined, SAMPLE[code] ?? "Hello", gender);
        } catch (err) {
          feedback.replaceChildren(msg("err", `${label} (${gLabel}): ${err.message}`));
        } finally {
          b.disabled = false;
        }
      } }, "▶");
      const opts = [...new Set([eff[gender]].filter(Boolean))].map((n) => el("option", { value: n }));
      return el("td", { class: "nowrap" }, input, " ", listen, el("datalist", { id: listId }, opts));
    });
    const hasTts = Boolean(eff.female || eff.male || saved[code]?.female || saved[code]?.male);
    const note = el("td", { class: "muted" }, code === "vi" ? "bé chọn nữ/nam" : hasTts ? "nữ mặc định; nam chỉ sinh khi bạn nhập giọng nam" : "chưa có TTS → giọng trình duyệt");
    return el("tr", null, el("td", null, el("b", null, label), el("div", { class: "muted" }, code)), ...cells, note);
  });

  const save = el("button", { class: "btn", type: "button" }, A.save);
  save.addEventListener("click", async () => {
    const voices = {};
    for (const [code] of langs) {
      for (const [gender] of GENDERS) {
        const v = inputs[code][gender].value.trim();
        if (!v) continue;
        if (!v.startsWith(`${code}-`) || !VOICE_RE.test(v.slice(code.length + 1))) {
          return feedback.replaceChildren(msg("err", `Giọng "${v}" không hợp lệ: tên giọng phải bắt đầu bằng "${code}-" (ví dụ ${CONFIG.ttsVoices?.[code]?.[gender] || `${code}-XX-TênGiọng`}).`));
        }
        const actual = guessGender(v);
        if (actual && actual !== gender) {
          return feedback.replaceChildren(msg("err", `Giọng "${v}" là giọng ${actual === "male" ? "nam" : "nữ"} nhưng đang nhập ở ô giọng ${gender === "male" ? "nam" : "nữ"} — chuyển sang ô còn lại.`));
        }
        (voices[code] ??= {})[gender] = v;
      }
    }
    save.disabled = true;
    const { error } = await sb.from("settings").update({ tts_voices: voices, updated_at: new Date().toISOString() }).eq("id", 1);
    save.disabled = false;
    if (error) return feedback.replaceChildren(msg("err", error.message));
    resetVoices();
    feedback.replaceChildren(msg("ok", "Đã lưu giọng đọc. Giọng mới áp dụng cho âm thanh sinh MỚI; muốn đổi các bài đã có, vào tab Nội dung → “Sinh lại TTS bằng giọng hiện tại”."));
  });

  return el("div", { class: "card" },
    el("h2", null, "Giọng đọc (TTS)"),
    el("p", { class: "muted" }, provider
      ? `Nhà cung cấp: ${provider === "azure" ? "Microsoft Azure" : provider === "google" ? "Google Cloud" : provider}. Mỗi ngôn ngữ có giọng nữ và giọng nam: bấm ▶ để nghe thử rồi Lưu. Ô để trống = dùng giọng mặc định (hiện trong ô).`
      : "Chưa cấu hình TTS cho Worker (biến TTS_PROVIDER, TTS_KEY). Cấu hình xong tải lại trang. Khi chưa có TTS, bé nghe giọng của trình duyệt."),
    el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
      el("thead", null, el("tr", null, ["Ngôn ngữ", "Giọng nữ", "Giọng nam", "Ghi chú"].map((h) => el("th", null, h)))), el("tbody", null, rows))),
    el("p", { class: "muted" }, "Tiếng Việt luôn sinh cả nữ và nam để bé chọn. Ngôn ngữ gốc của bé mặc định chỉ sinh giọng nữ (tiết kiệm ký tự TTS); ngôn ngữ nhà cung cấp không có giọng sẽ dùng giọng trình duyệt. Azure có giọng trẻ em ở một số ngôn ngữ nhưng không có cho tiếng Việt."),
    feedback, save);
}

// Kiểm tra âm thanh đã sinh: mỗi dòng = 1 (ngôn ngữ, giới, nguồn, giọng) + số file. ⚠ khi tên giọng (TTS) trái với giới của nhãn.
function diagnosticCard() {
  const out = el("div");
  const run = el("button", { class: "btn ghost", type: "button" }, "Kiểm tra âm thanh đã sinh");
  run.addEventListener("click", async () => {
    run.disabled = true;
    out.replaceChildren(el("p", { class: "muted" }, A.loading));
    try {
      const rows = await audioSummary();
      if (!rows.length) return out.replaceChildren(el("p", { class: "muted" }, "Chưa có file âm thanh nào."));
      const bad = rows.filter((r) => r.source === "tts" && r.gender && guessGender(r.voice_name) && guessGender(r.voice_name) !== r.gender);
      const tr = (r) => {
        const mismatch = bad.includes(r);
        return el("tr", null,
          el("td", null, r.lang), el("td", null, r.gender === "male" ? "♂ nam" : r.gender === "female" ? "♀ nữ" : "—"),
          el("td", null, r.source === "human" ? "người thật" : "TTS"), el("td", null, (mismatch ? "⚠ " : "") + (r.voice_name || "—")), el("td", null, String(r.files)));
      };
      out.replaceChildren(
        el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
          el("thead", null, el("tr", null, ["Ngôn ngữ", "Giới (nhãn)", "Nguồn", "Giọng đã dùng", "Số file"].map((h) => el("th", null, h)))),
          el("tbody", null, rows.map(tr)))),
        bad.length
          ? msg("err", "Có file gắn nhãn giới KHÔNG khớp giọng thật (dòng ⚠). Chạy migration 006 để vá nhãn, rồi tab Nội dung → “Sinh lại TTS bằng giọng hiện tại”.")
          : msg("ok", "Nhãn giới khớp với giọng đã dùng."));
    } catch (e) {
      out.replaceChildren(msg("err", e.message));
    } finally {
      run.disabled = false;
    }
  });
  return el("div", { class: "card" }, el("h2", null, "Kiểm tra giọng đã sinh"),
    el("p", { class: "muted" }, "Xem mỗi ngôn ngữ/giới đang dùng giọng nào và bao nhiêu file. Giọng nữ phải là HoaiMy…, giọng nam là NamMinh…"), run, out);
}

// Kiểm tra cấu hình Gemini (GET /api/suggest): khoá có dùng được không, AI_MODEL có tồn tại không, và danh sách mô hình hợp lệ để chọn.
function aiCard() {
  const out = el("div");
  const run = el("button", { class: "btn ghost", type: "button" }, "Kiểm tra AI (Gemini)");
  run.addEventListener("click", async () => {
    run.disabled = true;
    out.replaceChildren(el("p", { class: "muted" }, A.loading));
    try {
      if (!CONFIG.aiEnabled) {
        return out.replaceChildren(msg("err", "Worker chưa có biến bí mật AI_KEY. Đặt ở Cloudflare Dashboard → Worker → Settings → Variables and Secrets (loại Secret), rồi deploy lại. File .dev.vars chỉ dùng khi chạy ở máy bạn."));
      }
      const { data } = await sb.auth.getSession();
      const res = await fetch("/api/suggest", { headers: { authorization: `Bearer ${data.session?.access_token}` } });
      let j = null;
      try { j = await res.json(); } catch { /* không phải JSON */ }
      if (!res.ok) return out.replaceChildren(msg("err", j?.error || `Lỗi ${res.status}`));
      out.replaceChildren(
        j.modelUsable
          ? msg("ok", `Khoá dùng được. Mô hình đang dùng: ${j.model}${j.usingDefault ? " (mặc định — chưa đặt AI_MODEL)" : ""}.`)
          : msg("err", `Khoá dùng được nhưng mô hình “${j.model}” KHÔNG có trong danh sách dùng được của khoá này. Sửa biến AI_MODEL (Cloudflare Dashboard → Variables) thành một tên trong danh sách dưới đây rồi deploy lại.`),
        el("p", { class: "muted" }, "Mô hình Gemini dùng được: " + (j.available.length ? j.available.join(", ") : "(không có)")),
        el("p", { class: "muted" }, "Ngôn ngữ dịch (biến LANGUAGES): " + j.languages.join(", ")));
    } catch (e) {
      out.replaceChildren(msg("err", e.message));
    } finally {
      run.disabled = false;
    }
  });
  return el("div", { class: "card" }, el("h2", null, "Dịch bằng AI (Gemini)"),
    el("p", { class: "muted" }, "Khoá AI_KEY và tên mô hình AI_MODEL đặt ở biến môi trường của Worker (không nhập ở đây). Bấm để kiểm tra khoá có dùng được không và AI_MODEL có đúng tên không."), run, out);
}
