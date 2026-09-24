import { sb } from "../supabase.js";
import { state } from "../state.js";
import { el, mount as paint } from "../ui.js";
import { T } from "../strings.js";
import { A } from "../admin/text.js";

// Khu quản trị: mỗi tab là 1 module trong js/admin/ (tải khi bấm vào — chỉ tải dữ liệu của tab đang xem).
// Thứ tự TABS = thứ tự nút trên giao diện; tab mặc định là tab NHẸ nhất ("content" chỉ đọc danh sách chủ đề/bài).
const TABS = ["content", "bb", "record", "import", "parents", "billing", "settings"];
let tab = "content";

export function mount(root) {
  if (state.account?.role !== "admin") {
    return paint(root, el("div", { class: "card" }, el("h1", null, A.title), el("p", { class: "muted" }, A.teacherSoon),
      el("button", { class: "btn ghost", onclick: () => sb.auth.signOut() }, T.logout)));
  }
  const body = el("div");
  const nav = el("div", { class: "tabs admin-tabs" }, TABS.map((id) =>
    el("button", { class: id === tab ? "on" : "", onclick: () => { tab = id; mount(root); } }, A.tabs[id])));
  paint(root, el("div", { class: "admin" },
    el("div", { class: "row" }, el("h1", null, `${A.title} — ${state.account.email ?? ""}`),
      el("button", { class: "btn ghost small", onclick: () => sb.auth.signOut() }, T.logout)),
    nav, body));
  import(`../admin/${tab}.js`).then((m) => m.mount(body));
}
