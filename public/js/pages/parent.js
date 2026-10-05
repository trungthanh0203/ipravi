import { sb } from "../supabase.js";
import { state } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { avatarEmoji } from "../data.js";
import { pronunciationSupported } from "../pronunciation.js";
import { requestExtraChild, myPayments, cancelPayment } from "../payments.js";
import { loadStats, loadSkillStats, loadPronReport, parentStatsView } from "../stats.js";
import { childAge } from "../child/util.js";
import { loadBbStats, bbStatsView } from "../bb/stats.js";

// Điện thoại/địa chỉ: bắt buộc từ lúc đăng ký (auth.js), sửa lại được ở đây bất cứ lúc nào.
function contactCard() {
  const a = state.account;
  const feedback = el("div");
  const phone = el("input", { type: "tel", autocomplete: "tel", maxlength: "40", required: true, value: a.phone ?? "" });
  const address = el("input", { type: "text", autocomplete: "street-address", maxlength: "300", required: true, value: a.address ?? "" });
  const btn = el("button", { class: "btn small", type: "submit" }, T.save);
  const form = el("form", null, el("label", null, T.contactPhone), phone, el("label", null, T.contactAddress), address, feedback, btn);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    btn.disabled = true;
    const next = { phone: phone.value.trim(), address: address.value.trim() };
    if (!next.phone || !next.address) { btn.disabled = false; return feedback.replaceChildren(msg("err", T.contactRequired)); }
    const { error } = await sb.from("accounts").update(next).eq("id", a.id);
    btn.disabled = false;
    if (error) return feedback.replaceChildren(msg("err", error.message));
    Object.assign(a, next);
    feedback.replaceChildren(msg("ok", T.contactSaved));
  });
  return el("div", { class: "card" }, el("h2", null, T.contactTitle), form);
}

// Đổi mật khẩu (phiên đang đăng nhập nên không cần mật khẩu cũ — khu này đã có PIN bảo vệ).
function passwordCard() {
  const feedback = el("div");
  const p1 = el("input", { type: "password", autocomplete: "new-password", minlength: "8", required: true });
  const p2 = el("input", { type: "password", autocomplete: "new-password", minlength: "8", required: true });
  const btn = el("button", { class: "btn small", type: "submit" }, T.save);
  const form = el("form", null, el("label", null, T.passwordNew), p1, el("label", null, T.passwordConfirm), p2, feedback, btn);
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (p1.value.length < 8) return feedback.replaceChildren(msg("err", T.passwordShort));
    if (p1.value !== p2.value) return feedback.replaceChildren(msg("err", T.passwordMismatch));
    btn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: p1.value });
    btn.disabled = false;
    if (error) return feedback.replaceChildren(msg("err", T.passwordError));
    form.reset();
    feedback.replaceChildren(msg("ok", T.passwordSaved));
  });
  return el("div", { class: "card" }, el("h2", null, T.passwordTitle), form);
}

// Thêm tài khoản học: mặc định 1/tài khoản; muốn thêm phải xin + trả phí cho Admin, Admin xác nhận thì được cấp. Yêu cầu đang chờ huỷ được.
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
          p.status === "confirmed" ? T.payConfirmed : p.status === "cancelled" ? T.payCancelled : T.payPending),
        p.status === "pending" ? [" ", el("button", { class: "btn small ghost", type: "button", onclick: (ev) => cancel(p, ev.currentTarget) }, T.payCancel)] : null)));
  }
  async function cancel(p, button) {
    if (!confirm(T.payCancelConfirm)) return;
    button.disabled = true;
    feedback.replaceChildren();
    try {
      await cancelPayment(p.id);
      feedback.replaceChildren(msg("ok", T.payCancelled2));
      btn.disabled = false; // huỷ xong thì xin lại được (nếu chưa chạm trần — kiểm ở lần tải sau)
      await refresh();
    } catch (e) {
      button.disabled = false;
      feedback.replaceChildren(msg("err", e.message));
      await refresh().catch(() => {});
    }
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
  return el("div", { class: "pron-setting" },
    el("label", { for: "pron", style: "font-weight:700" }, box, " ", T.parentPron),
    el("p", { class: "muted" }, pronunciationSupported() ? T.parentPronHelp : T.parentPronUnsupported),
    feedback);
}

// Thanh tab cho nhóm "Thông tin chung" (các card cũ xếp dọc → mỗi card 1 tab cho gọn). defs = [[id, nhãn, node]]; nhớ tab đang mở
// trong lần mở trang này (tabNow) để tải lại màn hình không nhảy về tab đầu.
let tabNow = "account";
function tabPanels(defs) {
  const bar = el("div", { class: "tabs", role: "tablist" });
  const body = el("div");
  const show = (id) => {
    tabNow = id;
    [...bar.children].forEach((b) => b.classList.toggle("on", b.dataset.id === id));
    body.replaceChildren(defs.find((d) => d[0] === id)[2]);
  };
  bar.replaceChildren(...defs.map(([id, label]) => el("button", { type: "button", role: "tab", "data-id": id, onclick: () => show(id) }, label)));
  show(defs.some((d) => d[0] === tabNow) ? tabNow : defs[0][0]);
  return el("div", null, bar, body);
}

// Tổng kết TỪNG CON riêng (mỗi con 1 thẻ, có thể gập): hồ sơ 'child' (khu Trẻ em) dùng RPC child_stats + kỹ năng + đánh giá đọc;
// hồ sơ 'learner' (Tiếng Việt Bài Bản) dùng bb/stats.js (chặng xong, hộp nhớ, luyện tập) — 2 giáo trình có hình dạng thống kê
// khác nhau nên không gộp chung 1 view, nhưng cùng nằm dưới tên + nhãn giáo trình của từng bé. Tải song song, lỗi 1 bé không ảnh hưởng bé khác.
function childSection(kid, open) {
  const learner = kid.profile_type === "learner";
  const body = el("div", { class: "child-stats" }, el("p", { class: "muted" }, T.loading));
  (async () => {
    try {
      if (learner) return body.replaceChildren(bbStatsView(await loadBbStats(kid.id)));
      const [stats, skills, pron] = await Promise.all([loadStats(kid.id), loadSkillStats(kid.id).catch(() => null), loadPronReport(kid.id).catch(() => null)]);
      body.replaceChildren(parentStatsView(stats, { skills, pron, pronEnabled: Boolean(state.account?.pronunciation_enabled), age: childAge(kid) }));
    } catch {
      body.replaceChildren(msg("err", T.statsError));
    }
  })();
  const d = el("details", { class: "card child-section" },
    el("summary", null, el("span", { class: "who" }, avatarEmoji(kid.avatar_id), " ", el("b", null, kid.nickname)),
      el("span", { class: "pill" + (learner ? "" : " good") }, learner ? T.parentCurrBb : T.parentCurrKid)),
    body);
  d.open = open;
  return d;
}

function childrenSection() {
  const kids = state.children;
  if (!kids.length) return el("div", { class: "card" }, el("h2", null, T.parentStatsTitle), el("p", { class: "muted" }, T.parentNoChild));
  return el("div", null, el("h2", { class: "group-title" }, T.parentStatsTitle), el("p", { class: "muted" }, T.parentStatsHelp),
    ...kids.map((k) => childSection(k, kids.length <= 2 || k.id === (state.activeChildId ?? kids[0].id))));
}

// TODO: dashboard theo từng con (tiến độ, điểm phát âm), chế độ cùng học (từ Việt 🔊 + nghĩa 🔊),
// cài đặt (giới hạn thời gian, đổi PIN).
export function mount(root) {
  const a = state.account;
  const status = a.access_status === "trial" ? T.statusTrial : T.statusActive;
  const canAddProfile = state.children.length < a.child_slots;
  const accountPanel = el("div", { class: "card" },
    el("p", null, `${T.accessStatus}: `, el("span", { class: "pill good" }, status)),
    el("p", null, `${T.accessUntil}: ${new Date(a.access_until).toLocaleDateString("vi-VN")}`),
    el("p", null, `${T.childSlots}: ${state.children.length}/${a.child_slots}`),
    // Cùng 1 danh sách cho mọi hồ sơ (con lẫn người học bài bản) — vào lại đều bấm avatar ở màn hình đầu như
    // nhau (avatars.js), nên KHÔNG cần nút "Vào học" riêng ở đây. Chỉ gắn nhãn nhỏ để phân biệt loại hồ sơ.
    state.children.map((c) => el("p", null, avatarEmoji(c.avatar_id), " ", el("b", null, c.nickname),
      el("span", { class: "pill" + (c.profile_type === "learner" ? "" : " good"), style: "margin-left:6px" }, c.profile_type === "learner" ? T.parentCurrBb : T.parentCurrKid))),
    canAddProfile ? el("button", {
      class: "btn small", onclick: () => { state.creatingProfile = true; render(); },
    }, T.addProfileBtn) : null,
    el("hr", { class: "soft-hr" }),
    pronunciationToggle());
  paint(root, el("div", null,
    el("h1", null, T.parentTitle),
    el("h2", { class: "group-title" }, T.parentGeneral),
    tabPanels([
      ["account", T.parentTabAccount, accountPanel],
      ["contact", T.parentTabContact, contactCard()],
      ["password", T.parentTabPassword, passwordCard()],
      ["slots", T.parentTabSlots, addChildCard()],
    ]),
    childrenSection(),
    el("p", { class: "muted" }, T.soon),
    el("p", { class: "muted", style: "font-size:12px" }, T.credits),
    el("button", { class: "btn", onclick: () => { state.parentOpen = false; render(); } }, T.parentBack),
    " ",
    el("button", { class: "btn ghost", onclick: () => sb.auth.signOut() }, T.logout)));
}
