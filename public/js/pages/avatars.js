import { state } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { AVATARS } from "../data.js";
import { askPin } from "../pin.js";
import { emojiNodes } from "../emoji.js";

// Màn hình đầu tiên mỗi lần mở app. Hiện TẤT CẢ avatar; chỉ avatar đã gán cho hồ sơ con mới vào được.
export function mount(root) {
  const feedback = el("div", { style: "text-align:center;min-height:52px" });

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

  paint(root, el("div", { class: "avatar-screen" },
    el("div", { class: "mascot" }, ...emojiNodes("🐓")),
    el("h1", { style: "text-align:center" }, T.avatarWhoAreYou),
    feedback, grid, corner));
}
