import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

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
