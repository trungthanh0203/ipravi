import { contentUrl, sb } from "../supabase.js";
import { state } from "../state.js";
import { CONFIG } from "../config.js";
import { pickAudio, playUrl, stopAudio } from "../audio.js";
import { el } from "../ui.js";
import { spoken } from "../viet.js";

const TTS_LANG = { vi: "vi-VN", de: "de-DE", en: "en-US" };

// Ngôn ngữ bản ngữ của trẻ = ngôn ngữ phụ huynh chọn lúc đăng ký.
export const nativeLang = () => state.account?.content_language ?? "de";
export const nativeLabel = () => CONFIG.languages.find((l) => l.code === nativeLang())?.label ?? nativeLang();
export const meaningOf = (item, lang = nativeLang()) => item.translations?.find((t) => t.lang === lang)?.meaning ?? "";

// Hình của mục/chủ đề: ưu tiên ảnh thật, không có thì dùng emoji.
export function visual(thing, cls = "") {
  if (thing.image_path) return el("img", { class: `visual ${cls}`, src: contentUrl(thing.image_path), alt: "" });
  return el("span", { class: `visual emoji ${cls}`, "aria-hidden": "true" }, thing.emoji || "❓");
}

// TẠM THỜI: đọc bằng giọng của trình duyệt khi mục chưa có file âm thanh (TTS sinh sẵn sẽ làm ở
// bước công cụ admin). Chất lượng tiếng Việt phụ thuộc thiết bị — KHÔNG dùng làm giải pháp cuối.
export function speakFallback(text, lang = "vi", slow = false) {
  return new Promise((resolve) => {
    if (!text || !("speechSynthesis" in globalThis)) return resolve();
    stopAudio();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = TTS_LANG[lang] ?? lang;
    u.rate = slow ? 0.6 : 0.9;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
    setTimeout(resolve, 8000); // an toàn: một số trình duyệt không bắn sự kiện kết thúc
  });
}

// Giọng nghe của bé: bé tự chọn (child_profiles.voice_gender) > mặc định của phụ huynh (accounts.voice_pref.gender) > nữ.
export function voiceGender() {
  const child = state.children.find((c) => c.id === state.activeChildId);
  return child?.voice_gender ?? state.account?.voice_pref?.gender ?? "female";
}

// Nút nhỏ 👩 | 👨 để bé đổi giọng nghe (nhớ theo từng bé, lưu vào hồ sơ con).
export function voiceToggle() {
  const wrap = el("div", { class: "voice-toggle", role: "group", "aria-label": "Chọn giọng nghe" });
  const opts = [["female", "👩", "Giọng nữ"], ["male", "👨", "Giọng nam"]];
  const buttons = opts.map(([g, emoji, label]) =>
    el("button", { class: "vt-btn", type: "button", "aria-label": label, title: label, onclick: () => choose(g) }, emoji));
  const paint = () => buttons.forEach((b, i) => b.classList.toggle("on", opts[i][0] === voiceGender()));
  function choose(g) {
    const child = state.children.find((c) => c.id === state.activeChildId);
    if (!child) return;
    child.voice_gender = g;
    paint();
    sb.from("child_profiles").update({ voice_gender: g }).eq("id", child.id).then(({ error }) => { if (error) console.warn("voice_gender", error.message); });
  }
  paint();
  wrap.append(...buttons);
  return wrap;
}

// Phát âm thanh của 1 mục (tiếng Việt hoặc bản ngữ). Luật chọn giọng nằm ở pickAudio().
// Thứ tự: file TTS/người thật theo giới bé chọn → giọng của trình duyệt (chỉ khi mục chưa có file nào).
export function playItem(item, { lang = "vi", slow = false } = {}) {
  const prefs = state.account?.voice_pref ?? {};
  const rows = item.content_audio ?? [];
  const base = { lang, gender: voiceGender(), voiceKind: prefs.voiceKind, region: prefs.region };
  const row = pickAudio(rows, { ...base, speed: slow ? "slow" : "normal" }) ?? (slow ? pickAudio(rows, { ...base, speed: "normal" }) : null);
  if (row) return playUrl(contentUrl(row.file_path));
  return speakFallback(lang === "vi" ? spoken(item) : meaningOf(item, lang), lang, slow);
}

// Lời của linh vật (hướng dẫn, khen). Tạm dùng giọng trình duyệt như trên.
export const say = (text) => speakFallback(text, "vi");
