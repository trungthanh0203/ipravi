import { sb } from "../supabase.js";
import { state, loadAccountAndChildren } from "../state.js";
import { render } from "../flow.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";
import { hashPin, newSalt, isValidPin } from "../pin.js";

export function mount(root) {
  const pin1 = el("input", { type: "password", inputmode: "numeric", maxlength: "4", class: "pin-input", autocomplete: "off" });
  const pin2 = el("input", { type: "password", inputmode: "numeric", maxlength: "4", class: "pin-input", autocomplete: "off" });
  const phone = el("input", { type: "tel", autocomplete: "tel" });
  const address = el("input", { type: "text", autocomplete: "street-address" });
  const feedback = el("div");
  const btn = el("button", { class: "btn block", type: "submit" }, T.save);

  const form = el(
    "form", null,
    el("label", null, T.pinNew), pin1,
    el("label", null, T.pinConfirm), pin2,
    el("label", null, T.contactPhone), phone,
    el("label", null, T.contactAddress), address,
    el("p", { class: "muted" }, T.contactHelp),
    feedback, btn
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!isValidPin(pin1.value)) return feedback.replaceChildren(msg("err", T.pinFormat));
    if (pin1.value !== pin2.value) return feedback.replaceChildren(msg("err", T.pinMismatch));
    btn.disabled = true;
    const salt = newSalt();
    const { error } = await sb
      .from("accounts")
      .update({ pin_hash: await hashPin(pin1.value, salt), pin_salt: salt, phone: phone.value.trim() || null, address: address.value.trim() || null })
      .eq("id", state.session.user.id);
    if (error) {
      btn.disabled = false;
      return feedback.replaceChildren(msg("err", error.message));
    }
    await loadAccountAndChildren();
    await render();
  });

  paint(root, el("div", { class: "card" }, el("h1", null, T.pinSetupTitle), el("p", { class: "muted" }, T.pinSetupHelp), form));
}
