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
  if (state.creatingProfile) return "create-child";
  if (state.activeChildId) {
    const active = state.children.find((c) => c.id === state.activeChildId);
    // profile_type='learner' ("Tiếng Việt Bài Bản") vào giao diện khác hẳn khu học của bé (xem KE_HOACH_TIENG_VIET_BAI_BAN.md).
    return active?.profile_type === "learner" ? "bai-ban-home" : "child-home";
  }
  if (state.parentOpen) return "parent";
  return "avatars";
}

// modulepreload SONG SONG mọi module của 1 màn (danh sách sinh bởi scripts/gen-preload.mjs) — bỏ chuỗi 3–5 lượt chờ
// mạng nối tiếp khi trình duyệt tự khám phá từng tầng import. Lỗi/map cũ chỉ mất tối ưu, không ảnh hưởng chạy.
let preloadMap = null;
const preloaded = new Set();
const mapReady = fetch("/js/preload-map.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => (preloadMap = m));
export async function preloadScreen(screen) {
  const urls = (preloadMap ?? (await mapReady))[screen] ?? [];
  for (const href of urls) {
    if (preloaded.has(href)) continue;
    preloaded.add(href);
    const link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = href;
    document.head.append(link);
  }
}

let renderToken = 0;

export async function render() {
  const root = document.getElementById("app");
  const token = ++renderToken;
  const screen = decideScreen();
  document.body.classList.toggle("admin-wide", screen === "admin");
  document.body.classList.toggle("bb-theme", screen === "bai-ban-home"); // "Tiếng Việt Bài Bản": theme riêng (xem app.css)
  if (screen === "loading") {
    mount(root, el("p", { class: "boot" }, T.loading));
    return;
  }
  await preloadScreen(screen);
  const page = await import(`./pages/${screen}.js`);
  if (token !== renderToken) return; // có lượt render mới hơn, bỏ lượt cũ
  page.mount(root);
}
