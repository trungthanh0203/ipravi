import { sb, contentUrl } from "../supabase.js";

// Âm thanh của nội dung: sinh bằng TTS (qua Worker /api/tts), tải giọng người thật lên, nghe thử, xoá.
// File lưu ở bucket "content", đường dẫn có mốc thời gian (sw.js cache-trước theo URL nên URL phải đổi khi sinh lại).

export const audioSlots = (langs) => [
  { lang: "vi", speed: "normal", label: "VI" },
  { lang: "vi", speed: "slow", label: "VI 🐢" },
  ...langs.map((l) => ({ lang: l, speed: "normal", label: l.toUpperCase() })),
];

export const textFor = (item, lang) =>
  lang === "vi" ? item.text_vi : item.translations?.find((t) => t.lang === lang)?.meaning ?? "";

export const findAudio = (item, slot) =>
  (item.content_audio ?? []).filter((a) => a.lang === slot.lang && a.speed === slot.speed);

async function token() {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token;
}

// Giọng do admin chọn ở tab Cài đặt (settings.tts_voices), lưu đệm để khỏi hỏi CSDL mỗi lần sinh.
let voicesCache = null;
export async function getVoices() {
  if (voicesCache) return voicesCache;
  const { data } = await sb.from("settings").select("tts_voices").eq("id", 1).single();
  voicesCache = data?.tts_voices ?? {};
  return voicesCache;
}
export const resetVoices = () => { voicesCache = null; };

// voice: tên giọng cụ thể (tuỳ chọn) — bỏ trống thì Worker dùng TTS_VOICES / giọng mặc định.
export async function synth(text, lang, speed, voice) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ text, lang, speed, ...(voice ? { voice } : {}) }),
  });
  if (!res.ok) {
    let message = "";
    try { message = (await res.json()).error; } catch { /* không phải JSON */ }
    throw new Error(message || `TTS lỗi ${res.status}`);
  }
  return { blob: await res.blob(), provider: res.headers.get("x-tts-provider"), voice: res.headers.get("x-tts-voice") };
}

async function upload(path, blob, contentType) {
  const { error } = await sb.storage.from("content").upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error("Tải file lên thất bại: " + error.message);
}

// Xoá dòng + file của 1 mục (lang, speed tuỳ chọn). Dùng khi đổi chữ (âm thanh cũ không còn đúng) hoặc sinh lại.
export async function dropAudio(itemId, lang, speed, onlySource) {
  let q = sb.from("content_audio").select("id, file_path").eq("item_id", itemId).eq("lang", lang);
  if (speed) q = q.eq("speed", speed);
  if (onlySource) q = q.eq("source", onlySource);
  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) return;
  await sb.storage.from("content").remove(data.map((r) => r.file_path));
  await sb.from("content_audio").delete().in("id", data.map((r) => r.id));
}

// Sinh 1 âm thanh bằng TTS cho (mục, ô) — thay thế bản TTS cũ của đúng ô đó (không đụng giọng người thật).
export async function generate(item, slot) {
  const text = textFor(item, slot.lang);
  if (!text) throw new Error(`Chưa có chữ "${slot.lang}" để đọc`);
  const chosen = (await getVoices())[slot.lang];
  const { blob, provider, voice } = await synth(text, slot.lang, slot.speed, chosen);
  const path = `audio/${item.id}/${slot.lang}-${slot.speed}-${Date.now()}.mp3`;
  await upload(path, blob, "audio/mpeg");
  const old = findAudio(item, slot).filter((a) => a.source === "tts");
  const { error } = await sb.from("content_audio").insert({
    item_id: item.id, lang: slot.lang, speed: slot.speed, source: "tts", voice_kind: "adult",
    provider, voice_name: voice, file_path: path,
  });
  if (error) throw error;
  if (old.length) {
    await sb.storage.from("content").remove(old.map((a) => a.file_path));
    await sb.from("content_audio").delete().in("id", old.map((a) => a.id));
  }
}

// Tải file giọng người thật lên (adult | child), thay bản người thật cũ của cùng ô.
export async function uploadHuman(item, slot, file, voiceKind = "adult") {
  const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `audio/${item.id}/${slot.lang}-${slot.speed}-human-${Date.now()}.${ext}`;
  await upload(path, file, file.type || "audio/mpeg");
  const old = findAudio(item, slot).filter((a) => a.source === "human" && a.voice_kind === voiceKind);
  const { error } = await sb.from("content_audio").insert({
    item_id: item.id, lang: slot.lang, speed: slot.speed, source: "human", voice_kind: voiceKind, file_path: path,
  });
  if (error) throw error;
  if (old.length) {
    await sb.storage.from("content").remove(old.map((a) => a.file_path));
    await sb.from("content_audio").delete().in("id", old.map((a) => a.id));
  }
}

let player = null;
export function play(row) {
  player?.pause();
  player = new Audio(contentUrl(row.file_path));
  return player.play().catch(() => {});
}

// Nghe thử 1 giọng (không lưu gì): dùng ở tab Cài đặt để chọn giọng nam/nữ trước khi sinh hàng loạt.
export async function previewVoice(lang, voice, text) {
  const { blob } = await synth(text, lang, "normal", voice);
  player?.pause();
  player = new Audio(URL.createObjectURL(blob));
  return player.play().catch(() => {});
}

// Sinh mọi âm thanh còn thiếu của các mục (đồng thời tối đa 3 yêu cầu). Dừng ngay nếu TTS chưa cấu hình / không đủ quyền.
// replaceTts = true: sinh LẠI cả các ô đang dùng giọng TTS (để đổi giọng); ô có giọng người thật luôn được giữ nguyên.
export async function generateMissing(items, langs, onProgress = () => {}, { replaceTts = false } = {}) {
  const tasks = [];
  for (const item of items) {
    for (const slot of audioSlots(langs)) {
      if (!textFor(item, slot.lang)) continue;
      const rows = findAudio(item, slot);
      if (rows.length === 0 || (replaceTts && rows.every((r) => r.source === "tts"))) tasks.push({ item, slot });
    }
  }
  const failed = [];
  let ok = 0;
  let done = 0;
  let fatal = null;
  let next = 0;
  onProgress(0, tasks.length);
  async function worker() {
    while (!fatal && next < tasks.length) {
      const t = tasks[next++];
      try {
        await generate(t.item, t.slot);
        ok++;
      } catch (e) {
        if (/Chưa cấu hình|Chỉ admin|TTS_/.test(e.message)) fatal = e;
        failed.push({ text: textFor(t.item, t.slot.lang), slot: t.slot.label, message: e.message });
      }
      onProgress(++done, tasks.length);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return { total: tasks.length, ok, failed, fatal };
}
