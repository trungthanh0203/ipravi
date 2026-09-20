import { sb } from "../supabase.js";
import { el, msg } from "../ui.js";
import { A } from "./text.js";

export async function mount(box) {
  box.replaceChildren(el("p", { class: "muted" }, A.loading));
  const { data: s, error } = await sb.from("settings").select("*").eq("id", 1).single();
  if (error) return box.replaceChildren(msg("err", A.loadError + error.message));

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
  box.replaceChildren(el("div", { class: "card" }, el("h2", null, A.tabs.settings), form));
}
