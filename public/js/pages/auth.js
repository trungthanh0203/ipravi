import { sb } from "../supabase.js";
import { CONFIG } from "../config.js";
import { emojiNodes } from "../emoji.js";
import { el, mount as paint, msg } from "../ui.js";
import { T } from "../strings.js";

let tab = "login"; // "login" | "register"

export function mount(root) {
  paint(root, view(root));
}

function view(root) {
  const feedback = el("div");
  const email = el("input", { type: "email", autocomplete: "email", required: true });
  const password = el("input", { type: "password", autocomplete: tab === "login" ? "current-password" : "new-password", minlength: "8", required: true });
  const lang = el("select", null, CONFIG.languages.map((l) => el("option", { value: l.code }, l.label)));
  const consent = el("input", { type: "checkbox", id: "consent" });
  const submit = el("button", { class: "btn block", type: "submit" }, tab === "login" ? T.login : T.register);

  const form = el(
    "form", null,
    el("label", null, T.email), email,
    el("label", null, T.password), password,
    tab === "register" && [
      el("label", null, T.myLanguage), lang,
      el("label", { for: "consent", style: "font-weight:400;margin-top:14px" }, consent, " ", T.consent),
      el("p", { class: "muted" }, T.trialInfo),
    ],
    feedback, submit
  );

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    feedback.replaceChildren();
    if (tab === "register" && !consent.checked) return; // bắt buộc đồng ý
    submit.disabled = true;
    try {
      if (tab === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
        if (error) feedback.replaceChildren(msg("err", T.authError));
      } else {
        const { data, error } = await sb.auth.signUp({
          email: email.value.trim(),
          password: password.value,
          options: { data: { content_language: lang.value } },
        });
        if (error) feedback.replaceChildren(msg("err", T.registerError));
        else if (!data.session) feedback.replaceChildren(msg("ok", T.registerOk));
      }
    } finally {
      submit.disabled = false;
    }
  });

  const tabBtn = (id, label) =>
    el("button", { type: "button", class: tab === id ? "on" : "", onclick: () => { tab = id; paint(root, view(root)); } }, label);

  return el(
    "div", null,
    el("div", { class: "mascot" }, ...emojiNodes("🐓")),
    el("h1", { style: "text-align:center" }, CONFIG.centerName),
    el("div", { class: "card" }, el("div", { class: "tabs" }, tabBtn("login", T.login), tabBtn("register", T.register)), form),
    installBox()
  );
}

// Hướng dẫn cài app về máy (PWA) theo từng nền tảng — chữ lấy từ T.install.
function installBox() {
  return el(
    "div", { class: "install-box" },
    el("h2", { class: "install-title" }, T.install.title),
    el("p", { class: "muted install-contact" }, T.install.contact),
    el(
      "div", { class: "install-grid" },
      T.install.platforms.map((p) =>
        el(
          "div", { class: "install-card" },
          el("div", { class: "install-icon" }, p.icon),
          el("h3", null, p.name),
          el("ol", null, p.steps.map((s) => el("li", null, s))),
          el("p", { class: "muted install-note" }, p.note)
        )
      )
    )
  );
}
