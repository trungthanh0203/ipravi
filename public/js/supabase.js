// Bản supabase-js tải về sẵn (scripts/vendor-supabase.mjs) — cùng nguồn với app, không gọi CDN bên thứ ba lúc khởi động.
import { createClient } from "../vendor/supabase/supabase-supabase-js.js";

export let sb = null;

export function initSupabase(cfg) {
  // Phiên đăng nhập giữ lâu dài trên thiết bị (phụ huynh đăng nhập sẵn cho con).
  sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "tltv-auth" },
  });
  return sb;
}

// URL công khai của file trong bucket "content" (hình, âm thanh).
export function contentUrl(path) {
  return sb.storage.from("content").getPublicUrl(path).data.publicUrl;
}
