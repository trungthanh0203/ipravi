// Entry của Cloudflare Worker: phục vụ file tĩnh trong ./public và /api/config.
// /api/config trả cấu hình RIÊNG của bản triển khai (đọc từ biến môi trường), để mọi
// trung tâm dùng chung 1 mã nguồn. supabaseAnonKey là khoá CÔNG KHAI theo thiết kế
// của Supabase (bảo mật nằm ở RLS) — KHÔNG đưa service_role key vào đây.

import { handleTts, effectiveVoices } from "./tts.js";
import { handleSuggest } from "./suggest.js";

function parseLanguages(raw) {
  // "de:Deutsch,en:English" -> [{code:"de",label:"Deutsch"},{code:"en",label:"English"}]
  return (raw || "de:Deutsch")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [code, ...rest] = s.split(":");
      return { code: code.trim(), label: (rest.join(":") || code).trim() };
    });
}

function configResponse(env) {
  const body = {
    centerName: env.CENTER_NAME || "Tôi luyện tiếng Việt",
    supabaseUrl: env.SUPABASE_URL || "",
    supabaseAnonKey: env.SUPABASE_ANON_KEY || "",
    brandColor: env.BRAND_COLOR || "#e8590c",
    languages: parseLanguages(env.LANGUAGES),
    ttsProvider: String(env.TTS_PROVIDER || "").toLowerCase(), // chỉ tên nhà cung cấp (không bí mật) — để tab Cài đặt gợi ý giọng
    ttsVoices: effectiveVoices(env), // {lang:{female,male}} giọng có hiệu lực — app biết ngôn ngữ nào có TTS (không bí mật)
    aiEnabled: Boolean(env.AI_KEY), // chỉ cho biết đã cấu hình AI hay chưa (KHÔNG lộ khoá) — admin mới thấy nút "Dịch bằng AI"
  };
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/config") return configResponse(env);
    if (url.pathname === "/api/tts") return handleTts(request, env);
    if (url.pathname === "/api/suggest") return handleSuggest(request, env);
    return env.ASSETS.fetch(request);
  },
};
