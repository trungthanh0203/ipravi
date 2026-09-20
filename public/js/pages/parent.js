import { sb } from "../supabase.js";
import { state } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { avatarEmoji } from "../data.js";
import { pronunciationSupported } from "../pronunciation.js";
import { requestExtraChild, myPayments } from "../payments.js";

// Thêm con: mặc định 1 con/tài khoản; muốn thêm phải xin + trả phí cho người dạy, người dạy xác nhận thì được cấp.
function addChildCard() {
  const a = state.account;
  const feedback = el("div");
  const list = el("div");
  const help = el("p", { class: "muted" }, T.addChildHelp);
  const btn = el("button", { class: "btn small" }, T.addChildBtn);
  // Trần số con do admin đặt (settings.max_children); đủ trần thì không cho gửi yêu cầu nữa.
  sb.from("settings").select("max_children").eq("id", 1).single().then(({ data }) => {
    if (data && a.child_slots >= data.max_children) { btn.disabled = true; help.textContent = T.addChildFull; }
  });
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await requestExtraChild();
      feedback.replaceChildren(msg("ok", T.addChildSent));
      await refresh();
    } catch (e) {
      btn.disabled = false;
      feedback.replaceChildren(msg("err", e.message));
    }
  });
  async function refresh() {
    const rows = await myPayments();
    list.replaceChildren(...rows.map((p) =>
      el("p", { class: "muted" }, `${new Date(p.created_at).toLocaleDateString("vi-VN")} · ${p.kind === "tuition" ? `${T.payKindTuition} ${p.tuition_plans?.name ?? ""}` : T.payKindChild} · `,
        el("span", { class: `pill ${p.status === "confirmed" ? "good" : p.status === "cancelled" ? "bad" : ""}` },
          p.status === "confirmed" ? T.payConfirmed : p.status === "cancelled" ? T.payCancelled : T.payPending))));
  }
  refresh().catch(() => {});
  return el("div", { class: "card" }, el("h2", null, T.addChildTitle), help,
    btn, feedback, el("h2", null, T.payHistory), list);
}

// Bật chấm phát âm: xin quyền micro NGAY khi phụ huynh bật (không xin bất ngờ giữa lúc trẻ chơi).
function pronunciationToggle() {
  const a = state.account;
  const feedback = el("div");
  const box = el("input", { type: "checkbox", id: "pron", disabled: !pronunciationSupported() });
  box.checked = Boolean(a.pronunciation_enabled);
  box.addEventListener("change", async () => {
    feedback.replaceChildren();
    const want = box.checked;
    if (want) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        box.checked = false;
        return feedback.replaceChildren(msg("err", T.parentPronDenied));
      }
    }
    const { error } = await sb.from("accounts").update({ pronunciation_enabled: want }).eq("id", a.id);
    if (error) {
      box.checked = !want;
      return feedback.replaceChildren(msg("err", error.message));
    }
    a.pronunciation_enabled = want;
  });
  return el("div", { class: "card" },
    el("label", { for: "pron", style: "font-weight:700" }, box, " ", T.parentPron),
    el("p", { class: "muted" }, pronunciationSupported() ? T.parentPronHelp : T.parentPronUnsupported),
    feedback);
}

// TODO: dashboard theo từng con (tiến độ, điểm phát âm), chế độ cùng học (từ Việt 🔊 + nghĩa 🔊),
// cài đặt (giới hạn thời gian, bật/tắt chấm phát âm, đổi PIN), học phí + "Xin thêm tài khoản cho con".
export function mount(root) {
  const a = state.account;
  const status = a.access_status === "trial" ? T.statusTrial : T.statusActive;
  paint(root, el("div", null,
    el("h1", null, T.parentTitle),
    el("div", { class: "card" },
      el("p", null, `${T.accessStatus}: `, el("span", { class: "pill good" }, status)),
      el("p", null, `${T.accessUntil}: ${new Date(a.access_until).toLocaleDateString("vi-VN")}`),
      el("p", null, `${T.childSlots}: ${state.children.length}/${a.child_slots}`),
      state.children.map((c) => el("p", null, avatarEmoji(c.avatar_id), " ", c.nickname))),
    pronunciationToggle(),
    addChildCard(),
    el("p", { class: "muted" }, T.soon),
    el("button", { class: "btn", onclick: () => { state.parentOpen = false; render(); } }, T.parentBack),
    " ",
    el("button", { class: "btn ghost", onclick: () => sb.auth.signOut() }, T.logout)));
}
