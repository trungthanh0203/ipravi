// POST /api/tts — sinh giọng đọc (TTS) cho công cụ admin. CHỈ admin gọi được (kiểm bằng phiên Supabase
// của người gọi qua RPC is_admin, không cần service_role key). Khoá TTS nằm ở biến bí mật của Worker.
//
// Biến môi trường:
//   TTS_PROVIDER  "azure" | "google"
//   TTS_KEY       khoá API (đặt dạng Secret)
//   TTS_REGION    (azure) vd "westeurope"
//   TTS_VOICES    (tuỳ chọn) JSON ghi đè giọng theo ngôn ngữ, vd {"vi":"vi-VN-NamMinhNeural","de":"de-DE-ConradNeural"}
// Tên giọng mặc định bên dưới CHƯA được kiểm chứng với nhà cung cấp — nếu báo lỗi, xem danh sách giọng
// của nhà cung cấp và ghi đè bằng TTS_VOICES. Locale lấy từ tiền tố tên giọng ("vi-VN-...").

const DEFAULT_VOICES = {
  azure: { vi: "vi-VN-HoaiMyNeural", de: "de-DE-KatjaNeural", en: "en-US-JennyNeural" },
  google: { vi: "vi-VN-Neural2-A", de: "de-DE-Neural2-A", en: "en-US-Neural2-C" },
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const xmlEscape = (s) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
const locale = (voice) => voice.split("-").slice(0, 2).join("-");

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

  let overrides = {};
  try {
    overrides = env.TTS_VOICES ? JSON.parse(env.TTS_VOICES) : {};
  } catch {
    return json({ error: "TTS_VOICES không phải JSON hợp lệ" }, 500);
  }
  const voice = overrides[lang] || DEFAULT_VOICES[provider][lang];
  if (!voice) return json({ error: `Chưa có giọng đọc cho ngôn ngữ "${lang}" — thêm vào TTS_VOICES` }, 400);

  try {
    const bytes = provider === "azure" ? await synthAzure(env, voice, text, slow) : await synthGoogle(env, voice, text, slow);
    return new Response(bytes, {
      headers: { "content-type": "audio/mpeg", "x-tts-provider": provider, "x-tts-voice": voice, "cache-control": "no-store" },
    });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
