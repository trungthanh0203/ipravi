import { sb } from "../supabase.js";
import { loadAccountAndChildren } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { askPin } from "../pin.js";
import { requestTuition, myPayments } from "../payments.js";

// Hết hạn = khoá hết: chỉ còn màn hình gia hạn + đăng xuất (+ sau này: xuất/xoá dữ liệu con).
// Phụ huynh chọn mức học phí → "Tôi đã thanh toán" (yêu cầu chờ) → admin xác nhận → tài khoản tự gia hạn.
export async function mount(root) {
  const list = el("div");
  const how = el("p", { class: "muted", style: "white-space:pre-wrap" });
  const feedback = el("div");
  const history = el("div");
  paint(root, el("div", { class: "card" },
    el("h1", null, T.expiredTitle), el("p", null, T.expiredHelp),
    el("h2", null, T.plans), list, feedback,
    el("h2", null, T.paymentHow), how,
    el("h2", null, T.payHistory), history,
    el("button", { class: "btn small", onclick: async () => { await loadAccountAndChildren(); render(); } }, T.payRefresh), " ",
    el("button", { class: "btn ghost small", onclick: async () => { if (await askPin()) sb.auth.signOut(); } }, T.logout)));

  async function loadHistory() {
    const rows = await myPayments();
    history.replaceChildren(...(rows.length ? rows.map((p) =>
      el("p", null, `${new Date(p.created_at).toLocaleDateString("vi-VN")} · ${p.kind === "tuition" ? `${T.payKindTuition} ${p.tuition_plans?.name ?? ""}` : T.payKindChild} · `,
        el("span", { class: `pill ${p.status === "confirmed" ? "good" : p.status === "cancelled" ? "bad" : ""}` },
          p.status === "confirmed" ? T.payConfirmed : p.status === "cancelled" ? T.payCancelled : T.payPending))) : [el("p", { class: "muted" }, T.payNone)]));
    return rows;
  }

  try {
    const [{ data: plans }, { data: settings }] = await Promise.all([
      sb.from("tuition_plans").select("*").eq("active", true).order("sort_order"),
      sb.from("settings").select("payment_instructions").eq("id", 1).single(),
    ]);
    how.textContent = settings?.payment_instructions ?? "";
    await loadHistory();
    list.replaceChildren(...(plans ?? []).map((p) =>
      el("div", { class: "row", style: "margin:8px 0" },
        el("span", null, el("b", null, p.name), ` — ${p.price} ${p.currency} / ${p.duration_days} ngày`),
        el("button", { class: "btn small", onclick: async (e) => {
          if (!confirm(T.payDoneConfirm)) return;
          e.currentTarget.disabled = true;
          try {
            await requestTuition(p.id);
            feedback.replaceChildren(msg("ok", T.paySent));
            await loadHistory();
          } catch (err) {
            e.target.disabled = false;
            feedback.replaceChildren(msg("err", err.message));
          }
        } }, T.payDone))));
  } catch (err) {
    feedback.replaceChildren(msg("err", err.message));
  }
}
