import { el } from "./ui.js";
import { T } from "./strings.js";
import { state } from "./state.js";

// PIN 4 số: CHỈ để phụ huynh vào khu phụ huynh (không dùng để đăng nhập).
// Lưu băm SHA-256 kèm salt. PIN 4 số dễ đoán nên có khoá tạm phía thiết bị (chặn trẻ đoán mò).

const LOCK_KEY = "tltv-pin-lock";
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

export function newSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const isValidPin = (pin) => /^\d{4}$/.test(pin);

function readLock() {
  try {
    return JSON.parse(localStorage.getItem(LOCK_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeLock(v) {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(v));
  } catch {
    /* bỏ qua nếu bị chặn lưu trữ */
  }
}

// Hiện hộp thoại nhập PIN; trả về Promise<boolean> (true = đúng PIN).
export function askPin() {
  return new Promise((resolve) => {
    const acc = state.account;
    const input = el("input", {
      type: "password", inputmode: "numeric", maxlength: "4", autocomplete: "off", class: "pin-input",
    });
    const error = el("div", { class: "msg err", style: "display:none" });
    const close = (ok) => {
      back.remove();
      resolve(ok);
    };
    const showError = (t) => {
      error.textContent = t;
      error.style.display = "block";
    };

    const submit = async () => {
      const lock = readLock();
      if (lock.until && Date.now() < lock.until) return showError(T.pinLocked);
      if (!isValidPin(input.value)) return showError(T.pinFormat);
      const hash = await hashPin(input.value, acc.pin_salt);
      if (hash === acc.pin_hash) {
        writeLock({});
        return close(true);
      }
      const fails = (lock.fails || 0) + 1;
      writeLock(fails >= MAX_FAILS ? { fails: 0, until: Date.now() + LOCK_MS } : { fails });
      input.value = "";
      showError(fails >= MAX_FAILS ? T.pinLocked : T.pinWrong);
    };

    const back = el(
      "div", { class: "modal-back" },
      el(
        "div", { class: "modal" },
        el("h2", null, T.pinEnter), input, error,
        el("div", { class: "row" },
          el("button", { class: "btn ghost small", onclick: () => close(false) }, T.cancel),
          el("button", { class: "btn small", onclick: submit }, T.ok))
      )
    );
    input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    document.body.append(back);
    input.focus();
  });
}
