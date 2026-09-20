// POST /api/tts — sinh giọng đọc (TTS) cho công cụ admin. CHỈ admin gọi được (kiểm bằng phiên Supabase
// của người gọi qua RPC is_admin, không cần service_role key). Khoá TTS nằm ở biến bí mật của Worker.
//
// Biến môi trường:
//   TTS_PROVIDER  "azure" | "google"
//   TTS_KEY       khoá API (đặt dạng Secret)
//   TTS_REGION    (azure) vd "westeurope"
//   TTS_VOICES    (tuỳ chọn) JSON ghi đè giọng mặc định, vd {"vi":{"male":"vi-VN-NamMinhNeural"},"de":"de-DE-ConradNeural"}
//                 Nên dùng dạng {female,male}. Nếu ghi CHUỖI thì giới được đoán từ TÊN giọng (NamMinh → chỉ dùng cho giọng nam).
//
// Giọng mỗi ngôn ngữ có 2 giới: nữ (female) và nam (male). Chọn giọng theo thứ tự ưu tiên:
//   giọng admin chọn ở tab Cài đặt (gửi kèm yêu cầu) > TTS_VOICES > giọng mặc định bên dưới.
// Ngôn ngữ KHÔNG có giọng => trả lỗi 400 "Chưa có giọng đọc…" và app tự dùng giọng của trình duyệt.
//
// Độ tin cậy của tên giọng mặc định (đối chiếu 2026-09): vi (HoaiMy/NamMinh), de (Katja/Conrad), en-US-Jenny, ko (SunHi/InJoon),
// ja (Nanami/Keita) đã đối chiếu tài liệu/danh sách giọng. Các giọng còn lại (fr, es, it, zh, pt, nl, pl, ru, th, cs, en-US-Guy và
// toàn bộ giọng Google) là tên phổ biến nhưng CHƯA được kiểm chứng từng giọng — nếu nhà cung cấp báo lỗi giọng thì đổi ở tab Cài đặt.
// Giọng TRẺ EM: Azure có (vd en-US-AnaNeural) nhưng KHÔNG có cho tiếng Việt — muốn giọng trẻ em tiếng Việt phải thu giọng người thật.

import { guessGender } from "./public/js/voice-names.js";

const DEFAULT_VOICES = {
  azure: {
    vi: { female: "vi-VN-HoaiMyNeural", male: "vi-VN-NamMinhNeural" },
    de: { female: "de-DE-KatjaNeural", male: "de-DE-ConradNeural" },
    en: { female: "en-US-JennyNeural", male: "en-US-GuyNeural" },
    ko: { female: "ko-KR-SunHiNeural", male: "ko-KR-InJoonNeural" },
    ja: { female: "ja-JP-NanamiNeural", male: "ja-JP-KeitaNeural" },
    fr: { female: "fr-FR-DeniseNeural", male: "fr-FR-HenriNeural" },
    es: { female: "es-ES-ElviraNeural", male: "es-ES-AlvaroNeural" },
    it: { female: "it-IT-ElsaNeural", male: "it-IT-DiegoNeural" },
    zh: { female: "zh-CN-XiaoxiaoNeural", male: "zh-CN-YunxiNeural" },
    pt: { female: "pt-BR-FranciscaNeural", male: "pt-BR-AntonioNeural" },
    nl: { female: "nl-NL-ColetteNeural", male: "nl-NL-MaartenNeural" },
    pl: { female: "pl-PL-ZofiaNeural", male: "pl-PL-MarekNeural" },
    ru: { female: "ru-RU-SvetlanaNeural", male: "ru-RU-DmitryNeural" },
    th: { female: "th-TH-PremwadeeNeural", male: "th-TH-NiwatNeural" },
    cs: { female: "cs-CZ-VlastaNeural", male: "cs-CZ-AntoninNeural" },
  },
  google: {
    vi: { female: "vi-VN-Wavenet-A", male: "vi-VN-Wavenet-B" },
    de: { female: "de-DE-Wavenet-A", male: "de-DE-Wavenet-B" },
    en: { female: "en-US-Neural2-C", male: "en-US-Neural2-A" },
  },
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const xmlEscape = (s) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
const locale = (voice) => voice.split("-").slice(0, 2).join("-");
// Tên giọng được đưa vào SSML/JSON nên chỉ nhận đúng dạng "vi-VN-HoaiMyNeural" (chữ, số, gạch) — không cho chèn mã.
const VOICE_RE = /^[a-z]{2,3}-[A-Za-z0-9]{2,8}-[A-Za-z0-9-]{2,64}$/;

function parseOverrides(env) {
  try {
    const o = env.TTS_VOICES ? JSON.parse(env.TTS_VOICES) : {};
    return o && typeof o === "object" && !Array.isArray(o) ? o : null;
  } catch {
    return null;
  }
}

// Dạng {female, male}: lấy đúng giới. Dạng CHUỖI (bản cũ, không nói giới): đoán giới từ TÊN giọng — chuỗi "vi-VN-NamMinhNeural"
// chỉ dùng cho giọng NAM, không bao giờ được dùng cho giọng nữ (lỗi cũ: coi mọi chuỗi là giọng nữ nên mọi file "nữ" đọc bằng giọng nam).
// Tên lạ (không đoán được) coi là giọng nữ như trước.
const fromOverride = (v, gender) => {
  if (!v) return "";
  if (typeof v === "string") return (guessGender(v) ?? "female") === gender ? v : "";
  return v[gender] || "";
};

// Giọng có hiệu lực (mặc định + TTS_VOICES) theo ngôn ngữ — đưa vào /api/config để app biết ngôn ngữ nào có TTS. Không bí mật.
export function effectiveVoices(env) {
  const provider = String(env.TTS_PROVIDER || "").toLowerCase();
  const out = {};
  for (const [lang, g] of Object.entries(DEFAULT_VOICES[provider] || {})) out[lang] = { ...g };
  const o = provider ? parseOverrides(env) || {} : {};
  for (const lang of Object.keys(o)) {
    out[lang] = { female: fromOverride(o[lang], "female") || out[lang]?.female || "", male: fromOverride(o[lang], "male") || out[lang]?.male || "" };
  }
  return out;
}

export async function isAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth)) return false;
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth, "content-type": "application/json" },
    body: "{}",
  });
  return r.ok && (await r.json()) === true;
}

async function synthAzure(env, voice, text, slow) {
  const region = env.TTS_REGION;
  if (!region) throw new Error("Thiếu TTS_REGION cho Azure");
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale(voice)}">` +
    `<voice name="${voice}"><prosody rate="${slow ? "-30%" : "0%"}">${xmlEscape(text)}</prosody></voice></speak>`;
  const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.TTS_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "toi-luyen-tieng-viet",
    },
    body: ssml,
  });
  if (!r.ok) throw new Error(`Azure TTS ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function synthGoogle(env, voice, text, slow) {
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(env.TTS_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: locale(voice), name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate: slow ? 0.7 : 1.0 },
    }),
  });
  if (!r.ok) throw new Error(`Google TTS ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const { audioContent } = await r.json();
  if (!audioContent) throw new Error("Google TTS không trả về âm thanh");
  return Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0));
}

export async function handleTts(request, env) {
  if (request.method !== "POST") return json({ error: "Chỉ hỗ trợ POST" }, 405);
  if (!(await isAdmin(request, env))) return json({ error: "Chỉ admin được dùng chức năng này" }, 403);

  const provider = String(env.TTS_PROVIDER || "").toLowerCase();
  if (!provider || !env.TTS_KEY) return json({ error: "Chưa cấu hình TTS (TTS_PROVIDER, TTS_KEY) cho Worker" }, 501);
  if (!DEFAULT_VOICES[provider]) return json({ error: `TTS_PROVIDER "${provider}" chưa được hỗ trợ (azure | google)` }, 501);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON không hợp lệ" }, 400);
  }
  const text = String(body?.text ?? "").trim();
  const lang = String(body?.lang ?? "");
  const slow = body?.speed === "slow";
  if (!text || text.length > 300) return json({ error: "Văn bản trống hoặc dài quá 300 ký tự" }, 400);
  if (body?.gender != null && !["female", "male"].includes(body.gender)) return json({ error: 'gender phải là "female" hoặc "male"' }, 400);
  const gender = body?.gender === "male" ? "male" : "female";

  const overrides = parseOverrides(env);
  if (overrides === null) return json({ error: "TTS_VOICES không phải JSON hợp lệ" }, 500);

  // Ưu tiên: giọng admin chọn (gửi kèm yêu cầu) > TTS_VOICES > giọng mặc định
  const requested = body?.voice ? String(body.voice).trim() : "";
  if (requested && (!VOICE_RE.test(requested) || requested.split("-")[0] !== lang)) {
    return json({ error: `Tên giọng "${requested.slice(0, 40)}" không hợp lệ cho ngôn ngữ "${lang}" (ví dụ đúng: ${lang}-XX-TênGiọng)` }, 400);
  }
  const voice = requested || fromOverride(overrides[lang], gender) || DEFAULT_VOICES[provider][lang]?.[gender] || "";
  if (!voice) {
    return json({ error: `Chưa có giọng đọc ${gender === "male" ? "nam" : "nữ"} cho ngôn ngữ "${lang}" — chọn giọng ở tab Cài đặt hoặc thêm vào TTS_VOICES` }, 400);
  }
  if (!VOICE_RE.test(voice)) return json({ error: `Giọng "${voice.slice(0, 40)}" (từ TTS_VOICES) không hợp lệ` }, 500);

  try {
    const bytes = provider === "azure" ? await synthAzure(env, voice, text, slow) : await synthGoogle(env, voice, text, slow);
    return new Response(bytes, {
      headers: { "content-type": "audio/mpeg", "x-tts-provider": provider, "x-tts-voice": voice, "x-tts-gender": gender, "cache-control": "no-store" },
    });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
