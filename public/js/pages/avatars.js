import { state } from "../state.js";
import { sb } from "../supabase.js";
import { render, preloadScreen } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { AVATARS } from "../data.js";
import { askPin } from "../pin.js";
import { emojiNodes, mascotHero } from "../emoji.js";

// Màn hình đầu tiên mỗi lần mở app. Hiện TẤT CẢ avatar; chỉ avatar đã gán cho 1 hồ sơ (con hoặc người học bài bản)
// mới vào được — CẢ 2 loại hồ sơ đều vào được từ đây bằng đúng avatar (quyết định 2026-09, sửa từ bản đầu chỉ cho
// hồ sơ con: đã thử thật, phụ huynh tạo hồ sơ learner cho CHÍNH con mình dùng, bé tự bấm avatar để vào — bắt vòng
// qua khu phụ huynh mới vào được gây khó hiểu). Hồ sơ learner vẫn vào thêm được từ khu phụ huynh (thẻ "Hồ sơ học
// bài bản" trong parent.js) — tiện cho trường hợp phụ huynh tự học, không cần nhớ avatar.
export function mount(root) {
  // Rảnh thì nạp sẵn khu học của các hồ sơ có ở đây → bấm avatar là vào ngay, không chờ tải ~50 module.
  const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 300));
  idle(() => new Set(state.children.map((c) => (c.profile_type === "learner" ? "bai-ban-home" : "child-home"))).forEach((s) => preloadScreen(s)));
  const feedback = el("div", { style: "text-align:center" });

  const grid = el(
    "div", { class: "avatar-grid" },
    AVATARS.map((a) =>
      el("button", {
        class: "avatar-btn", "aria-label": a.id,
        onclick: () => {
          const child = state.children.find((c) => c.avatar_id === a.id);
          if (!child) return feedback.replaceChildren(msg("err", T.avatarWrong));
          state.activeChildId = child.id;
          render();
        },
      }, ...emojiNodes(a.emoji))
    )
  );

  // Nút nhỏ kín đáo cho phụ huynh — phải nhập PIN mới vào.
  const corner = el("button", {
    class: "parent-corner", "aria-label": T.parentArea, title: T.parentArea,
    onclick: async () => {
      if (await askPin()) {
        state.parentOpen = true;
        render();
      }
    },
  }, "🔒");

  // Header: trái = tên/email phụ huynh đang đăng nhập, phải = Thoát (đăng xuất tài khoản). Thoát PHẢI nhập PIN phụ huynh
  // (như màn hết hạn, expired.js) — màn này là màn của trẻ, không để trẻ bấm nhầm đăng xuất cả tài khoản.
  const header = el("div", { class: "row child-header avatar-header" },
    el("div", { class: "who-wrap" },
      el("span", { class: "who-avatar" }, "👪"),
      el("div", { class: "who-text" }, el("span", { class: "who" }, state.account?.email ?? state.session?.user?.email ?? ""))),
    el("button", { class: "btn ghost small", onclick: async () => { if (await askPin()) sb.auth.signOut(); } }, T.childExit));

  paint(root, el("div", { class: "avatar-screen" },
    header,
    el("div", { class: "avatar-hero" }, mascotHero(), el("h1", null, T.avatarWhoAreYou)),
    feedback, grid, corner));
}
