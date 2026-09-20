import { sb } from "../supabase.js";
import { CONFIG } from "../config.js";
import { el, msg } from "../ui.js";
import { A } from "./text.js";
import { getVoices, resetVoices, previewVoice } from "./audio.js";

// Gợi ý giọng theo nhà cung cấp — chỉ liệt kê giọng đã đối chiếu tài liệu; giọng khác gõ tay (xem danh sách của nhà cung cấp).
const SUGGEST = {
  azure: {
    vi: [["vi-VN-HoaiMyNeural", "nữ"], ["vi-VN-NamMinhNeural", "nam"]],
    de: [["de-DE-KatjaNeural", "nữ"], ["de-DE-ConradNeural", "nam"]],
    en: [["en-US-JennyNeural", "nữ"]],
  },
  google: {
    vi: [["vi-VN-Wavenet-A", ""], ["vi-VN-Wavenet-B", ""], ["vi-VN-Wavenet-C", ""]],
    de: [["de-DE-Wavenet-A", ""]],
    en: [["en-US-Neural2-C", ""]],
  },
};
const SAMPLE = {
  vi: "Xin chào các con, chúng mình cùng học tiếng Việt nhé.",
  de: "Hallo, wir lernen zusammen Vietnamesisch.",
  en: "Hello, let's learn Vietnamese together.",
};
const VOICE_RE = /^[A-Za-z0-9]{2,8}-[A-Za-z0-9-]{2,64}$/; // phần sau mã ngôn ngữ, vd "VN-HoaiMyNeural"

export async function mount(box) {
  box.replaceChildren(el("p", { class: "muted" }, A.loading));
  const { data: s, error } = await sb.from("settings").select("*").eq("id", 1).single();
  if (error) return box.replaceChildren(msg("err", A.loadError + error.message));

  box.replaceChildren(generalCard(s), await voiceCard(s));
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
  const langs = [["vi", "Tiếng Việt"], ...CONFIG.languages.map((l) => [l.code, l.label])];
  const inputs = {};

  const rows = langs.map(([code, label]) => {
    const sug = SUGGEST[provider]?.[code] ?? [];
    const listId = `voices-${code}`;
    const input = el("input", { type: "text", value: saved[code] ?? "", list: listId, placeholder: sug[0]?.[0] ?? `${code}-XX-TênGiọng`, class: "cell", style: "min-width:260px" });
    inputs[code] = input;
    const listen = el("button", { type: "button", class: "btn small ghost", onclick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      feedback.replaceChildren();
      try {
        // Ô trống = giọng đang dùng (TTS_VOICES / mặc định của Worker)
        await previewVoice(code, input.value.trim() || undefined, SAMPLE[code] ?? "Hello");
      } catch (err) {
        feedback.replaceChildren(msg("err", `${label}: ${err.message}`));
      } finally {
        b.disabled = false;
      }
    } }, "▶ Nghe thử");
    return el("tr", null,
      el("td", null, el("b", null, label)),
      el("td", null, input, el("datalist", { id: listId }, sug.map(([name, g]) => el("option", { value: name }, g ? `${name} (${g})` : name)))),
      el("td", null, listen));
  });

  const save = el("button", { class: "btn", type: "button" }, A.save);
  save.addEventListener("click", async () => {
    const voices = {};
    for (const [code] of langs) {
      const v = inputs[code].value.trim();
      if (!v) continue;
      if (!v.startsWith(`${code}-`) || !VOICE_RE.test(v.slice(code.length + 1))) {
        return feedback.replaceChildren(msg("err", `Giọng "${v}" không hợp lệ: tên giọng phải bắt đầu bằng "${code}-" (ví dụ ${SUGGEST[provider]?.[code]?.[0]?.[0] ?? `${code}-XX-TênGiọng`}).`));
      }
      voices[code] = v;
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
      ? `Nhà cung cấp: ${provider === "azure" ? "Microsoft Azure" : provider === "google" ? "Google Cloud" : provider}. Chọn giọng nam/nữ cho từng ngôn ngữ, bấm “Nghe thử” rồi Lưu. Ô để trống = dùng giọng mặc định.`
      : "Chưa cấu hình TTS cho Worker (biến TTS_PROVIDER, TTS_KEY). Cấu hình xong tải lại trang."),
    el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
      el("thead", null, el("tr", null, ["Ngôn ngữ", "Tên giọng", ""].map((h) => el("th", null, h)))), el("tbody", null, rows))),
    el("p", { class: "muted" }, "Muốn giọng khác: gõ tên giọng vào ô (xem danh sách giọng trong tài liệu của nhà cung cấp). Nên dùng 1 giọng nhất quán cho toàn bộ nội dung."),
    feedback, save);
}
