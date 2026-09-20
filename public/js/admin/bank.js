import { sb } from "../supabase.js";
import { BANK_UNIT, bankPlan } from "../sounds.js";

// Tạo/bổ sung "ngân hàng âm": 1 chủ đề ẨN (bé không thấy) chứa các âm nhỏ cần giọng thu. Chạy lại an toàn (chỉ thêm cái còn thiếu).
const check = ({ error, data }) => { if (error) throw error; return data; };

export async function ensureBank() {
  const units = check(await sb.from("units").select("id, title_vi, hidden, sort_order"));
  let unit = units.find((u) => u.title_vi === BANK_UNIT);
  if (!unit) {
    const order = Math.max(0, ...units.map((u) => u.sort_order ?? 0)) + 1;
    const { data, error } = await sb.from("units").insert({ title_vi: BANK_UNIT, emoji: "🎙️", level: 1, hidden: true, status: "approved", sort_order: order }).select("id, title_vi, hidden").single();
    if (error) throw new Error(/hidden/.test(error.message ?? "") ? "CSDL chưa có cột units.hidden — chạy migration 010 trong Supabase SQL Editor." : error.message);
    unit = data;
  }
  const plan = bankPlan();
  const lessons = check(await sb.from("lessons").select("id, title_vi, sort_order").eq("unit_id", unit.id));
  const have = new Map(lessons.map((l) => [l.title_vi, l]));
  let order = Math.max(0, ...lessons.map((l) => l.sort_order ?? 0));
  const missing = plan.filter((p) => !have.has(p.lesson));
  if (missing.length) {
    const rows = check(await sb.from("lessons").insert(missing.map((p) => ({ unit_id: unit.id, title_vi: p.lesson, status: "approved", sort_order: ++order }))).select("id, title_vi"));
    rows.forEach((l) => have.set(l.title_vi, l));
  }
  let added = 0;
  for (const p of plan) {
    const lesson = have.get(p.lesson);
    const items = check(await sb.from("content_items").select("text_vi, sort_order").eq("lesson_id", lesson.id).range(0, 999));
    const has = new Set(items.map((i) => i.text_vi));
    let n = Math.max(0, ...items.map((i) => i.sort_order ?? 0));
    const fresh = p.items.filter((i) => !has.has(i.text));
    if (fresh.length) {
      check(await sb.from("content_items").insert(fresh.map((i) => ({ lesson_id: lesson.id, item_type: "syllable", text_vi: i.text, say_vi: i.say ?? null, status: "approved", sort_order: ++n }))));
      added += fresh.length;
    }
  }
  return { units: unit ? 1 : 0, lessons: missing.length, items: added };
}
