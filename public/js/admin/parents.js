import { sb } from "../supabase.js";
import { el, msg } from "../ui.js";
import { A } from "./text.js";
import { beginLoad } from "./view.js";
import { notice } from "./notice.js";
import { suggestExtraFee, recordPayment } from "./billing.js";

const check = ({ error, data }) => { if (error) throw error; return data; };
const dt = (s) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");

function statusOf(p) {
  if (p.access_status === "suspended") return ["Tạm khoá", "bad"];
  const days = Math.ceil((new Date(p.access_until) - Date.now()) / 864e5);
  if (days <= 0) return ["Hết hạn", "bad"];
  return [`${p.access_status === "trial" ? "Dùng thử" : "Đang dùng"} · còn ${days} ngày`, "good"];
}

export async function mount(box) {
  const done = beginLoad(box);
  try {
    const [rows, plans, settings] = await Promise.all([
      sb.rpc("admin_parent_overview").then(check),
      sb.from("tuition_plans").select("*").eq("active", true).order("sort_order").then(check),
      sb.from("settings").select("extra_child_percent, max_children").eq("id", 1).single().then(check),
    ]);
    render(box, rows, plans, settings);
  } catch (e) {
    box.replaceChildren(msg("err", A.loadError + e.message));
  }
  done();
}

function render(box, rows, plans, settings) {
  const reload = () => mount(box);
  const flash = el("div");
  const say = (kind, t) => flash.replaceChildren(msg(kind, t));
  const carried = notice.take();
  if (carried) say(carried.kind, carried.text);
  const run = (fn, okText) => async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try { await fn(); notice.set("ok", okText); await reload(); } catch (err) { b.disabled = false; if (/^Đã huỷ/.test(err.message) && !/cần nhập/.test(err.message)) flash.replaceChildren(); else say("err", err.message); }
  };

  const tr = (p) => {
    const [label, tone] = statusOf(p);
    const planSel = el("select", { class: "cell" }, plans.map((pl) => el("option", { value: pl.id }, `${pl.name} — ${pl.price} ${pl.currency}`)));
    return el("tr", null,
      el("td", null, el("b", null, p.email ?? "(không có email)"), el("div", { class: "muted" }, `${p.content_language.toUpperCase()} · đăng ký ${dt(p.created_at)}`)),
      el("td", null, el("span", { class: `pill ${tone}` }, label), el("div", { class: "muted" }, `đến ${dt(p.access_until)}`)),
      el("td", null, `${p.children}/${p.child_slots}`),
      el("td", null, String(p.words_learned)),
      el("td", null, dt(p.last_activity)),
      el("td", null, String(p.paid_count)),
      el("td", { class: "actions" },
        plans.length ? el("div", { class: "nowrap" }, planSel, " ", el("button", { class: "btn small", title: "Ghi nhận phụ huynh đã trả học phí (tiền mặt, chuyển khoản…)",
          onclick: run(async () => {
            if (!confirm(`Ghi nhận ${p.email} đã trả học phí mức đã chọn và gia hạn ngay?`)) throw new Error("Đã huỷ");
            await recordPayment({ account_id: p.id, kind: "tuition", plan_id: Number(planSel.value) });
          }, "Đã ghi nhận học phí và gia hạn.") }, "+ Học phí")) : null,
        el("div", { class: "nowrap" },
          el("button", { class: "btn small ghost", onclick: run(async () => {
            const room = settings.max_children - p.child_slots;
            if (room <= 0) throw new Error(`Đã đạt trần ${settings.max_children} con (chỉnh ở tab Cài đặt).`);
            const n = Number(prompt(`Cấp thêm bao nhiêu tài khoản con? (còn được thêm tối đa ${room})`, "1"));
            if (!Number.isInteger(n) || n < 1) throw new Error("Đã huỷ");
            const amount = prompt("Số tiền phụ huynh đã trả cho việc thêm con:", await suggestExtraFee(p.id, n, settings.extra_child_percent));
            if (amount === null || amount.trim() === "" || !(Number(amount) >= 0)) throw new Error("Đã huỷ (cần nhập số tiền, có thể là 0)");
            await recordPayment({ account_id: p.id, kind: "extra_child", extra_children: n, amount: Number(amount) });
          }, "Đã cấp thêm tài khoản con.") }, "+ Cấp thêm con"), " ",
          el("button", { class: "btn small ghost", onclick: run(async () => {
            const suspend = p.access_status !== "suspended";
            if (suspend && !confirm(`Tạm khoá ${p.email}? Bé sẽ không học được cho tới khi mở khoá.`)) throw new Error("Đã huỷ");
            check(await sb.from("accounts").update({ access_status: suspend ? "suspended" : p.paid_count > 0 ? "active" : "trial" }).eq("id", p.id));
          }, "Đã cập nhật trạng thái.") }, p.access_status === "suspended" ? "Mở khoá" : "Tạm khoá"))));
  };

  box.replaceChildren(flash, el("div", { class: "card" },
    el("h2", null, `Phụ huynh (${rows.length})`),
    rows.length
      ? el("div", { class: "table-wrap" }, el("table", { class: "tbl" },
        el("thead", null, el("tr", null, ["Phụ huynh", "Tình trạng", "Con", "Từ đã thuộc", "Học gần nhất", "Lần đã trả", "Thao tác"].map((h) => el("th", null, h)))),
        el("tbody", null, rows.map(tr))))
      : el("p", { class: "muted" }, "Chưa có phụ huynh nào đăng ký."),
    el("p", { class: "muted" }, "“Từ đã thuộc” = số từ đạt mức thuộc từ 3/5 trở lên, cộng dồn các bé của tài khoản. Chưa có phần xem chi tiết từng bé (sẽ làm sau).")));
}
