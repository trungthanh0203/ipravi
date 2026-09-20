// Cấu hình riêng của bản triển khai, lấy từ Worker (/api/config).
export let CONFIG = null;

export async function loadConfig() {
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) throw new Error("Không tải được cấu hình");
  const cfg = await res.json();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error("Thiếu SUPABASE_URL / SUPABASE_ANON_KEY trong biến môi trường của Worker");
  }
  CONFIG = cfg;
  document.documentElement.style.setProperty("--brand", cfg.brandColor);
  document.title = cfg.centerName;
  return cfg;
}
