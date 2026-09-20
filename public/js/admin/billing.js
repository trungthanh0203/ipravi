import { sb } from "../supabase.js";
import { el, msg } from "../ui.js";
import { A } from "./text.js";
import { notice } from "./notice.js";

const check = ({ error, data }) => { if (error) throw error; return data; };
const money = (n, c) => (n == null ? "—" : `${Number(n).toLocaleString("vi-VN")} ${c ?? ""}`.trim());
const dt = (s) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");

// Gợi ý phí thêm con = extra_child_percent% × học phí của giao dịch học phí gần nhất (admin luôn sửa được).
export async function suggestExtraFee(accountId, n, percent) {
  const { data } = await sb.from("payments").select("amount")
    .eq("account_id", accountId).eq("kind", "tuition").eq("status", "confirmed")
    .order("confirmed_at", { ascending: false }).limit(1);
  const base = data?.[0]?.amount;
  return base == null ? "" : String(Math.round(Number(base) * (Number(percent) / 100) * n * 100) / 100);
}

// Ghi nhận thanh toán thay phụ huynh: chèn (luôn ở trạng thái chờ) rồi xác nhận -> trigger tự gia hạn / tăng số con.
export async function recordPayment(row) {
  const created = check(await sb.from("payments").insert(row).select("id").single());
  check(await sb.from("payments").update({ status: "confirmed" }).eq("id", created.id));
}

export async function mount(box) {
  box.replaceChildren(el("p", { class: "muted" }, A.loading));
  try {
    const [plans, pending, history, settings] = await Promise.all([
      sb.from("tuition_plans").select("*").order("sort_order").then(check),
      sb.from("payments").select("*, accounts!payments_account_id_fkey(email), tuition_plans(name)").eq("status", "pending").order("created_at").then(check),
      sb.from("payments").select("*, accounts!payments_account_id_fkey(email), tuition_plans(name)").neq("status", "pending").order("created_at", { ascending: false }).limit(30).then(check),
      sb.from("settings").select("*").eq("id", 1).single().then(check),
    ]);
    render(box, plans, pending, history, settings);
  } catch (e) {
    box.replaceChildren(msg("err", A.loadError + e.message));
  }
}

function render(box, plans, pending, history, settings) {
  const reload = () => mount(box);
  const flash = el("div");
  const say = (kind, t) => flash.replaceChildren(msg(kind, t));
  const carried = notice.take();
  if (carried) say(carried.kind, carried.text);

  // ---- chờ xác nhận ----
  const pendingRows = pending.map((p) => {
    const amount = el("input", { type: "number", step: "0.01", min: "0", class: "cell cell-sm", value: p.amount ?? "" });
    const note = el("input", { type: "text", class: "cell", placeholder: "Ghi chú", value: p.note ?? "" });
    if (p.kind === "extra_child" && p.amount == null) {
      suggestExtraFee(p.account_id, p.extra_children, settings.extra_child_percent).then((s) => { if (s && !amount.value) amount.value = s; });
    }
    const what = p.kind === "tuition" ? `Học phí: ${p.tuition_plans?.name ?? "?"} (${p.duration_days} ngày)` : `Thêm ${p.extra_children} con`;
    return el("tr", null,
      el("td", null, dt(p.created_at)), el("td", null, p.accounts?.email ?? p.account_id), el("td", null, what),
      el("td", { class: "nowrap" }, amount, " ", p.currency ?? ""), el("td", null, note),
      el("td", { class: "nowrap" },
        el("button", { class: "btn small", onclick: async (e) => {
          if (amount.value === "") return say("err", "Nhập số tiền đã nhận trước khi xác nhận.");
          e.currentTarget.disabled = true;
          try {
            check(await sb.from("payments").update({ amount: Number(amount.value), note: note.value.trim() || null, status: "confirmed" }).eq("id", p.id));
            notice.set("ok", p.kind === "tuition" ? "Đã xác nhận — tài khoản đã được gia hạn." : "Đã xác nhận — đã cấp thêm tài khoản con.");
            reload();
          } catch (err) { e.target.disabled = false; say("err", err.message); }
        } }, "Xác nhận đã nhận tiền"), " ",
        el("button", { class: "btn small ghost", onclick: async () => {
          if (!confirm("Huỷ yêu cầu này?")) return;
          try { check(await sb.from("payments").update({ status: "cancelled" }).eq("id", p.id)); reload(); } catch (err) { say("err", err.message); }
        } }, "Huỷ")));
  });

  // ---- mức học phí ----
  const planRow = (p) => {
    const f = {
      name: el("input", { type: "text", class: "cell", value: p?.name ?? "", placeholder: "Tên (vd 3 tháng)" }),
      price: el("input", { type: "number", min: "0", step: "0.01", class: "cell cell-sm", value: p?.price ?? "" }),
      currency: el("input", { type: "text", class: "cell cell-xs", value: p?.currency ?? settings.currency, maxlength: "3" }),
      days: el("input", { type: "number", min: "1", class: "cell cell-xs", value: p?.duration_days ?? "" }),
      order: el("input", { type: "number", class: "cell cell-xs", value: p?.sort_order ?? plans.length + 1 }),
    };
    const save = async (extra = {}) => {
      try {
        const row = { name: f.name.value.trim(), price: Number(f.price.value), currency: f.currency.value.trim().toUpperCase() || settings.currency,
          duration_days: Number(f.days.value), sort_order: Number(f.order.value) || 0, ...extra };
        if (!row.name || !(row.price >= 0) || !(row.duration_days >= 1) || f.price.value === "") throw new Error("Cần tên, giá (≥ 0) và số ngày (≥ 1)");
        check(p ? await sb.from("tuition_plans").update(row).eq("id", p.id) : await sb.from("tuition_plans").insert(row));
        notice.set("ok", "Đã lưu mức học phí.");
        reload();
      } catch (e) { say("err", e.message); }
    };
    return el("tr", { class: p && !p.active ? "off" : "" },
      el("td", null, f.name), el("td", null, f.price), el("td", null, f.currency), el("td", null, f.days), el("td", null, f.order),
      el("td", { class: "nowrap" },
        el("button", { class: "btn small", onclick: () => save() }, p ? "Lưu" : "+ Thêm"), " ",
        p ? el("button", { class: "btn small ghost", title: "Mức đã ẩn không hiện cho phụ huynh nhưng giữ lịch sử giao dịch", onclick: () => save({ active: !p.active }) }, p.active ? "Ẩn" : "Hiện lại") : null));
  };

  box.replaceChildren(flash,
    el("div", { class: "card" }, el("h2", null, `Chờ xác nhận (${pending.length})`),
      pending.length
        ? el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
          el("thead", null, el("tr", null, ["Ngày", "Phụ huynh", "Nội dung", "Số tiền nhận", "Ghi chú", ""].map((h) => el("th", null, h)))), el("tbody", null, pendingRows)))
        : el("p", { class: "muted" }, "Không có yêu cầu nào đang chờ. Phụ huynh bấm “Tôi đã thanh toán” hoặc “Xin thêm con” thì yêu cầu hiện ở đây."),
      el("p", { class: "muted" }, "Chỉ bấm xác nhận SAU KHI đã nhận được tiền. Xác nhận học phí sẽ tự cộng thời gian dùng; xác nhận phí con sẽ tự cấp thêm 1 tài khoản con.")),
    el("div", { class: "card" }, el("h2", null, "Mức học phí"),
      el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
        el("thead", null, el("tr", null, ["Tên", "Giá", "Tiền tệ", "Số ngày dùng", "Thứ tự", ""].map((h) => el("th", null, h)))),
        el("tbody", null, [...plans.map(planRow), planRow(null)])))),
    el("div", { class: "card" }, el("h2", null, "Lịch sử gần đây"),
      history.length
        ? el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
          el("thead", null, el("tr", null, ["Ngày", "Phụ huynh", "Nội dung", "Số tiền", "Trạng thái"].map((h) => el("th", null, h)))),
          el("tbody", null, history.map((p) => el("tr", null, el("td", null, dt(p.confirmed_at ?? p.created_at)), el("td", null, p.accounts?.email ?? ""),
            el("td", null, p.kind === "tuition" ? `Học phí ${p.tuition_plans?.name ?? ""}` : `Thêm ${p.extra_children} con`),
            el("td", null, money(p.amount, p.currency)), el("td", null, el("span", { class: `pill ${p.status === "confirmed" ? "good" : "bad"}` }, p.status === "confirmed" ? "Đã xác nhận" : "Đã huỷ")))))))
        : el("p", { class: "muted" }, "Chưa có giao dịch nào.")));
}
