import { sb } from "../supabase.js";
import { state, loadAccountAndChildren } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { AVATARS } from "../data.js";

// Tạo hồ sơ mới — lần đầu (children.length === 0, KHÔNG có nút Huỷ) hoặc từ khu phụ huynh qua "+ Thêm hồ sơ mới"
// (state.creatingProfile, CÓ nút Huỷ để quay lại). Có bước chọn loại hồ sơ: 'child' (khu học của bé, vào bằng avatar
// ở màn hình đầu) hay 'learner' ("Tiếng Việt Bài Bản", vào từ khu phụ huynh — xem KE_HOACH_TIENG_VIET_BAI_BAN.md).
export function mount(root) {
  const cameFromParent = state.children.length > 0; // đến từ "+ Thêm hồ sơ mới", không phải lần tạo đầu tiên
  let profileType = "child";
  let picked = null;
  const feedback = el("div");
  const name = el("input", { type: "text", maxlength: "30", required: true });
  const year = el("input", { type: "number", min: "2000", max: String(new Date().getFullYear()), inputmode: "numeric" });
  const btn = el("button", { class: "btn block", type: "submit" }, T.childCreate);

  const nickLabel = el("label", null, T.childNickname);
  const avatarLabel = el("label", null, T.childPickAvatar);

  const grid = el("div", { class: "avatar-grid" });
  const buttons = AVATARS.map((a) => {
    const b = el("button", { type: "button", class: "avatar-btn", "aria-label": a.id }, a.emoji);
    b.addEventListener("click", () => {
      picked = a.id;
      buttons.forEach((x) => x.classList.toggle("picked", x === b));
    });
    return b;
  });
  grid.append(...buttons);

  const typeHelp = el("p", { class: "muted", style: "display:none" }, T.childTypeLearnerHelp);
  const typeButtons = [
    ["child", T.childTypeChild],
    ["learner", T.childTypeLearner],
  ].map(([v, label]) =>
    el("button", {
      type: "button",
      onclick: () => {
        profileType = v;
        typeButtons.forEach((x, i) => x.classList.toggle("on", ["child", "learner"][i] === v));
        nickLabel.textContent = v === "learner" ? T.childNicknameLearner : T.childNickname;
        avatarLabel.textContent = v === "learner" ? T.childPickAvatarLearner : T.childPickAvatar;
        typeHelp.style.display = v === "learner" ? "" : "none";
      },
    }, label)
  );
  typeButtons[0].classList.add("on");

  const form = el(
    "form", null,
    el("label", null, T.childProfileType), el("div", { class: "tabs" }, ...typeButtons), typeHelp,
    nickLabel, name,
    el("label", null, T.childBirthYear), year,
    avatarLabel, grid,
    feedback, btn,
    cameFromParent ? el("button", {
      type: "button", class: "btn ghost block",
      onclick: () => { state.creatingProfile = false; state.parentOpen = true; render(); },
    }, T.childCancel) : null
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!picked) return feedback.replaceChildren(msg("err", T.childPickAvatar));
    btn.disabled = true;
    const { data, error } = await sb.from("child_profiles").insert({
      parent_id: state.session.user.id,
      nickname: name.value.trim(),
      avatar_id: picked,
      birth_year: year.value ? Number(year.value) : null,
      profile_type: profileType,
    }).select().single();
    if (error) {
      btn.disabled = false;
      const text = error.code === "23505" ? T.childAvatarTaken : /đủ số con/i.test(error.message) ? T.childLimit : error.message;
      return feedback.replaceChildren(msg("err", text));
    }
    state.creatingProfile = false;
    await loadAccountAndChildren();
    // Hồ sơ 'learner' vào thẳng "Tiếng Việt Bài Bản" (không qua màn hình avatar — avatars.js cố tình không khớp
    // hồ sơ learner). Hồ sơ 'child' thì KHÔNG tự vào — bé phải tự chạm đúng avatar của mình như bình thường.
    if (profileType === "learner") state.activeChildId = data.id;
    await render();
  });

  paint(root, el("div", { class: "card" }, el("h1", null, T.childCreateTitle), form));
}
