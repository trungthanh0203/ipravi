import { sb } from "./supabase.js";

// Yêu cầu của phụ huynh (luôn vào ở trạng thái chờ — admin xác nhận sau khi nhận tiền). Giá học phí do
// trigger lấy từ mức học phí, phụ huynh không tự đặt giá được.
export async function requestTuition(planId) {
  const { error } = await sb.from("payments").insert({ kind: "tuition", plan_id: planId });
  if (error) throw error;
}

export async function requestExtraChild() {
  const { error } = await sb.from("payments").insert({ kind: "extra_child", extra_children: 1 });
  if (error) throw error;
}

export async function myPayments() {
  const { data, error } = await sb.from("payments")
    .select("id, kind, status, amount, currency, extra_children, created_at, confirmed_at, tuition_plans(name)")
    .order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return data ?? [];
}
