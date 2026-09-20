import { sb } from "../supabase.js";
import { state, loadAccountAndChildren } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { AVATARS } from "../data.js";

export function mount(root) {
  let picked = null;
  const feedback = el("div");
  const name = el("input", { type: "text", maxlength: "30", required: true });
  const year = el("input", { type: "number", min: "2000", max: String(new Date().getFullYear()), inputmode: "numeric" });
  const btn = el("button", { class: "btn block", type: "submit" }, T.childCreate);

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

  const form = el(
    "form", null,
    el("label", null, T.childNickname), name,
    el("label", null, T.childBirthYear), year,
    el("label", null, T.childPickAvatar), grid,
    feedback, btn
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!picked) return feedback.replaceChildren(msg("err", T.childPickAvatar));
    btn.disabled = true;
    const { error } = await sb.from("child_profiles").insert({
      parent_id: state.session.user.id,
      nickname: name.value.trim(),
      avatar_id: picked,
      birth_year: year.value ? Number(year.value) : null,
    });
    if (error) {
      btn.disabled = false;
      const text = error.code === "23505" ? T.childAvatarTaken : /đủ số con/i.test(error.message) ? T.childLimit : error.message;
      return feedback.replaceChildren(msg("err", text));
    }
    await loadAccountAndChildren();
    await render();
  });

  paint(root, el("div", { class: "card" }, el("h1", null, T.childCreateTitle), form));
}
