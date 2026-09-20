import { state, isExpired } from "./state.js";
import { el, mount } from "./ui.js";
import { T } from "./strings.js";

// Quyết định màn hình theo trạng thái. Thứ tự các điều kiện là LUẬT của luồng vào app
// (xem mục 4.0 tài liệu yêu cầu) — thêm màn hình mới phải chèn đúng vị trí, đừng append cuối.
export function decideScreen() {
  if (!state.session) return "auth";
  const a = state.account;
  if (!a) return "loading";
  if (a.role === "admin" || a.role === "teacher") return "admin";
  if (!a.pin_hash) return "setup-pin";
  if (isExpired(a)) return "expired";
  if (state.children.length === 0) return "create-child";
  if (state.activeChildId) return "child-home";
  if (state.parentOpen) return "parent";
  return "avatars";
}

let renderToken = 0;

export async function render() {
  const root = document.getElementById("app");
  const token = ++renderToken;
  const screen = decideScreen();
  document.body.classList.toggle("admin-wide", screen === "admin");
  if (screen === "loading") {
    mount(root, el("p", { class: "boot" }, T.loading));
    return;
  }
  const page = await import(`./pages/${screen}.js`);
  if (token !== renderToken) return; // có lượt render mới hơn, bỏ lượt cũ
  page.mount(root);
}
