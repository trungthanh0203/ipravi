import { state } from "../state.js";
import { render } from "../flow.js";
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
    mascotHero(),
    el("h1", { style: "text-align:center" }, T.avatarWhoAreYou),
    feedback, grid, corner));
}
