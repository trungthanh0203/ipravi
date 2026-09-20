import { sb } from "./supabase.js";

// Trạng thái dùng chung. Trẻ không đăng nhập — mọi thứ chạy bằng phiên của phụ huynh.
export const state = {
  session: null,
  account: null, // hàng trong bảng accounts
  children: [], // hồ sơ con của phụ huynh này
  activeChildId: null, // trẻ đang học (chọn ở màn hình avatar)
  parentOpen: false, // đang ở khu phụ huynh (đã qua PIN)
};

export function resetState() {
  state.session = null;
  state.account = null;
  state.children = [];
  state.activeChildId = null;
  state.parentOpen = false;
}

export async function loadAccountAndChildren() {
  const uid = state.session.user.id;
  const { data: account, error } = await sb.from("accounts").select("*").eq("id", uid).single();
  if (error) throw error;
  state.account = account;
  state.children = [];
  if (account.role === "parent") {
    const { data: kids, error: e2 } = await sb
      .from("child_profiles")
      .select("*")
      .eq("parent_id", uid)
      .order("created_at");
    if (e2) throw e2;
    state.children = kids ?? [];
  }
}

// Hết hạn hoặc bị khoá => "khoá hết" (chỉ còn màn hình gia hạn). Admin/giáo viên không bị hạn.
export function isExpired(account) {
  if (account.role !== "parent") return false;
  return account.access_status === "suspended" || new Date(account.access_until) <= new Date();
}
