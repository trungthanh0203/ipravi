// Cấu hình riêng của bản triển khai, lấy từ Worker (/api/config).
export let CONFIG = null;

const KEY = "tltv-config";

function apply(cfg) {
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error("Thiếu SUPABASE_URL / SUPABASE_ANON_KEY trong biến môi trường của Worker");
  }
  CONFIG = cfg;
  document.documentElement.style.setProperty("--brand", cfg.brandColor);
  document.title = cfg.centerName;
  return cfg;
}

async function fetchConfig() {
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) throw new Error("Không tải được cấu hình");
  const cfg = await res.json();
  apply(cfg);
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* bị chặn: bỏ qua */ }
  return cfg;
}

// Cấu hình ít đổi → dùng bản đã lưu ngay (bớt 1 lượt chờ mạng lúc mở app) và làm mới ngầm cho lần sau.
// Chưa có bản lưu/bản lưu hỏng → tải như cũ.
export async function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved?.supabaseUrl && saved?.supabaseAnonKey) {
      apply(saved);
      fetchConfig().catch(() => {});
      return saved;
    }
  } catch { /* bản lưu hỏng: tải lại */ }
  return fetchConfig();
}
