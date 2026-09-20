import { sb, contentUrl } from "../supabase.js";
import { CONFIG } from "../config.js";
import { guessGender } from "../voice-names.js";
import { spoken } from "../viet.js";

// Âm thanh của nội dung: sinh bằng TTS (qua Worker /api/tts), tải giọng người thật lên, nghe thử, xoá.
// File lưu ở bucket "content", đường dẫn có mốc thời gian (sw.js cache-trước theo URL nên URL phải đổi khi sinh lại).
//
// Mỗi (mục, ngôn ngữ, tốc độ, giới nữ/nam) là 1 "ô" âm thanh:
//  - Tiếng Việt: nữ + nam, mỗi giới 2 tốc độ (thường, chậm) — bé chọn giọng nghe.
//  - Ngôn ngữ gốc: giọng nữ (thường); thêm giọng nam khi admin chọn giọng nam cho ngôn ngữ đó ở tab Cài đặt.
//  - Ngôn ngữ KHÔNG có TTS: không có ô nào → khu trẻ tự dùng giọng của trình duyệt.

export const GENDER_MARK = { female: "♀", male: "♂" };

// Giọng admin chọn ở tab Cài đặt: {lang:{female?,male?}}. Bản cũ lưu chuỗi: giới đoán từ TÊN giọng (NamMinh → nam), tên lạ → nữ.
let voicesCache = null;
export async function getVoices() {
  if (voicesCache) return voicesCache;
  const { data } = await sb.from("settings").select("tts_voices").eq("id", 1).single();
  const raw = data?.tts_voices ?? {};
  voicesCache = Object.fromEntries(Object.entries(raw).map(([lang, v]) => [lang, typeof v === "string" ? { [guessGender(v) ?? "female"]: v } : v ?? {}]));
  return voicesCache;
}
export const resetVoices = () => { voicesCache = null; };

// Giới nào được sinh TTS cho ngôn ngữ này (rỗng = không có TTS => dùng giọng trình duyệt).
export function ttsGenders(lang, voices = {}) {
  const eff = CONFIG.ttsVoices?.[lang] ?? {};
  const chosen = voices[lang] ?? {};
  const has = (g) => Boolean(chosen[g] || eff[g]);
  if (lang === "vi") return ["female", "male"].filter(has);
  const out = [];
  if (has("female")) out.push("female");
  if (chosen.male) out.push("male"); // giọng nam của ngôn ngữ gốc chỉ sinh khi admin CHỦ ĐỘNG chọn (tiết kiệm ký tự)
  return out;
}

// Tiếng Việt luôn có ô (kể cả khi chưa cấu hình TTS, để tải giọng người thật lên).
export function audioSlots(langs, voices = {}) {
  const slots = [];
  for (const lang of ["vi", ...langs.filter((l) => l !== "vi")]) {
    const genders = lang === "vi" ? ["female", "male"] : ttsGenders(lang, voices);
    for (const gender of genders) {
      const g = GENDER_MARK[gender];
      slots.push({ lang, speed: "normal", gender, label: `${lang.toUpperCase()}${g}` });
      if (lang === "vi") slots.push({ lang, speed: "slow", gender, label: `VI${g} 🐢` });
    }
  }
  return slots;
}

export const textFor = (item, lang) =>
  lang === "vi" ? spoken(item) : item.translations?.find((t) => t.lang === lang)?.meaning ?? "";

// Dòng cũ chưa có gender (vd file người thật tải lên trước đây) tính là giọng nữ.
export const findAudio = (item, slot) =>
  (item.content_audio ?? []).filter((a) => a.lang === slot.lang && a.speed === slot.speed && (a.gender ?? "female") === slot.gender);

async function token() {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token;
}

// voice: tên giọng cụ thể (tuỳ chọn); gender: "female" | "male" — Worker chọn giọng mặc định đúng giới nếu không có voice.
export async function synth(text, lang, speed, voice, gender = "female") {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
    body: JSON.stringify({ text, lang, speed, gender, ...(voice ? { voice } : {}) }),
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
// Không lọc giới: đổi chữ thì mọi giọng của chữ đó đều hết đúng.
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
  const chosen = (await getVoices())[slot.lang]?.[slot.gender];
  const { blob, provider, voice } = await synth(text, slot.lang, slot.speed, chosen, slot.gender);
  // Chặn gán nhãn sai: giọng thực tế dùng có giới khác ô (vd giọng nam nằm ở ô nữ) thì KHÔNG lưu, báo admin sửa cấu hình.
  const actual = guessGender(voice);
  if (actual && actual !== slot.gender) {
    throw new Error(`Giọng "${voice}" là giọng ${actual === "male" ? "nam" : "nữ"} nhưng đang dùng cho ô ${slot.gender === "male" ? "nam" : "nữ"} — sửa ở tab Cài đặt (hoặc biến TTS_VOICES) rồi thử lại.`);
  }
  const path = `audio/${item.id}/${slot.lang}-${slot.gender}-${slot.speed}-${Date.now()}.mp3`;
  await upload(path, blob, "audio/mpeg");
  const old = findAudio(item, slot).filter((a) => a.source === "tts");
  const { error } = await sb.from("content_audio").insert({
    item_id: item.id, lang: slot.lang, speed: slot.speed, gender: slot.gender, source: "tts", voice_kind: "adult",
    provider, voice_name: voice, file_path: path,
  });
  if (error) throw /column .*gender/i.test(error.message ?? "") ? new Error("CSDL chưa có cột gender — chạy migration 005 (rồi 006) trong Supabase SQL Editor.") : error;
  if (old.length) {
    await sb.storage.from("content").remove(old.map((a) => a.file_path));
    await sb.from("content_audio").delete().in("id", old.map((a) => a.id));
  }
}

// Thống kê file đã sinh theo (ngôn ngữ, giới, nguồn, giọng) — RPC admin_audio_summary (migration 006).
export async function audioSummary() {
  const { data, error } = await sb.rpc("admin_audio_summary");
  if (error) throw new Error(/admin_audio_summary/.test(error.message ?? "") ? "Chưa chạy migration 006 trong Supabase SQL Editor." : error.message);
  return data ?? [];
}

// Tải file giọng người thật lên ô này (giới lấy từ ô; voiceKind: adult | child), thay bản người thật cũ của cùng ô.
export async function uploadHuman(item, slot, file, voiceKind = "adult") {
  const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `audio/${item.id}/${slot.lang}-${slot.gender}-${slot.speed}-human-${Date.now()}.${ext}`;
  await upload(path, file, file.type || "audio/mpeg");
  const old = findAudio(item, slot).filter((a) => a.source === "human" && a.voice_kind === voiceKind);
  const { error } = await sb.from("content_audio").insert({
    item_id: item.id, lang: slot.lang, speed: slot.speed, gender: slot.gender, source: "human", voice_kind: voiceKind, file_path: path,
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
export async function previewVoice(lang, voice, text, gender = "female") {
  const { blob } = await synth(text, lang, "normal", voice, gender);
  player?.pause();
  player = new Audio(URL.createObjectURL(blob));
  return player.play().catch(() => {});
}

// Sinh mọi âm thanh còn thiếu của các mục (đồng thời tối đa 3 yêu cầu). Dừng ngay nếu TTS chưa cấu hình / không đủ quyền.
// replaceTts = true: sinh LẠI cả các ô đang dùng giọng TTS (để đổi giọng); ô có giọng người thật luôn được giữ nguyên.
// Ô mà nhà cung cấp không có giọng ("Chưa có giọng đọc…") được BỎ QUA (khu trẻ dùng giọng trình duyệt), không tính là lỗi.
export async function generateMissing(items, langs, onProgress = () => {}, { replaceTts = false } = {}) {
  const slots = audioSlots(langs, await getVoices());
  const tasks = [];
  for (const item of items) {
    for (const slot of slots) {
      if (!textFor(item, slot.lang)) continue;
      const rows = findAudio(item, slot);
      if (rows.length === 0 || (replaceTts && rows.every((r) => r.source === "tts"))) tasks.push({ item, slot });
    }
  }
  const failed = [];
  const skipped = new Set();
  let ok = 0;
  let done = 0;
  let fatal = null;
  let next = 0;
  onProgress(0, tasks.length);
  async function worker() {
    while (!fatal && next < tasks.length) {
      const t = tasks[next++];
      const key = `${t.slot.lang}${GENDER_MARK[t.slot.gender]}`;
      if (skipped.has(key)) { onProgress(++done, tasks.length); continue; }
      try {
        await generate(t.item, t.slot);
        ok++;
      } catch (e) {
        if (/Chưa có giọng đọc/.test(e.message)) skipped.add(key);
        else {
          if (/Chưa cấu hình|Chỉ admin|TTS_/.test(e.message)) fatal = e;
          failed.push({ text: textFor(t.item, t.slot.lang), slot: t.slot.label, message: e.message });
        }
      }
      onProgress(++done, tasks.length);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return { total: tasks.length, ok, failed, fatal, skipped: [...skipped] };
}
