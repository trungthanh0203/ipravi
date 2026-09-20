import { sb } from "./supabase.js";

// Trạng thái dùng chung. Trẻ không đăng nhập — mọi thứ chạy bằng phiên của phụ huynh.
export const state = {
  session: null,
  account: null, // hàng trong bảng accounts
  children: [], // hồ sơ con của phụ huynh này
  // activeChildId: trẻ đang học (chọn ở màn hình avatar) — định nghĩa bên dưới (nhớ trong sessionStorage của tab)
  parentOpen: false, // đang ở khu phụ huynh (đã qua PIN)
};

// Nhớ bé đang học trong PHIÊN của tab (sessionStorage: mất khi đóng tab/app) để khi hệ điều hành thu hồi trang nền rồi nạp lại,
// bé vào lại khu học thay vì phải chọn avatar lại. Bé bị xoá/khác tài khoản thì loadAccountAndChildren() bỏ đi.
const ACTIVE_KEY = "tltv-active-child";
let activeChild = null;
try { activeChild = sessionStorage.getItem(ACTIVE_KEY); } catch { /* bị chặn: bỏ qua */ }
Object.defineProperty(state, "activeChildId", {
  enumerable: true,
  get: () => activeChild,
  set(v) {
    activeChild = v || null;
    try { activeChild ? sessionStorage.setItem(ACTIVE_KEY, activeChild) : sessionStorage.removeItem(ACTIVE_KEY); } catch { /* bỏ qua */ }
  },
});

export function resetState() {
  state.session = null;
  state.account = null;
  state.children = [];
  state.activeChildId = null;
  state.parentOpen = false;
}

export async function loadAccountAndChildren() {
  const uid = state.session.user.id;
  // Tài khoản + hồ sơ con tải SONG SONG (bớt 1 lượt chờ mạng); admin không có con nên kết quả con bị bỏ.
  const [acc, kidsRes] = await Promise.all([
    sb.from("accounts").select("*").eq("id", uid).single(),
    sb.from("child_profiles").select("*").eq("parent_id", uid).order("created_at"),
  ]);
  if (acc.error) throw acc.error;
  const account = acc.data;
  state.account = account;
  state.children = [];
  if (account.role === "parent") {
    if (kidsRes.error) throw kidsRes.error;
    state.children = kidsRes.data ?? [];
  }
  if (state.activeChildId && !state.children.some((c) => c.id === state.activeChildId)) state.activeChildId = null;
}

// Hết hạn hoặc bị khoá => "khoá hết" (chỉ còn màn hình gia hạn). Admin/giáo viên không bị hạn.
export function isExpired(account) {
  if (account.role !== "parent") return false;
  return account.access_status === "suspended" || new Date(account.access_until) <= new Date();
}
