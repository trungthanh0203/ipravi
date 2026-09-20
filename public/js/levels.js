// 4 cấp của chú gà (khung giáo trình: giao-trinh/GIAO_TRINH_TIENG_VIET_3-8_TUOI.md). Hàm thuần — có test trong tests/unit.test.mjs.
export const LEVELS = [
  { n: 1, emoji: "🥚", name: "Trứng", age: "3–4 tuổi", focus: "Nghe – nhận biết – nói từ" },
  { n: 2, emoji: "🐣", name: "Gà con", age: "4–6 tuổi", focus: "Nói câu ngắn, lễ phép, đồng dao" },
  { n: 3, emoji: "🐥", name: "Gà choai", age: "5–7 tuổi", focus: "Học vần: thanh điệu, chữ cái, đọc" },
  { n: 4, emoji: "🐓", name: "Gà trống", age: "6–8 tuổi", focus: "Đọc hiểu, viết câu, kể chuyện" },
];

// "Qua cấp" khi ≥ 80% số từ đã thuộc (mastery ≥ 3/5) — đúng tiêu chí trong giáo trình.
export const PASS_RATIO = 0.8;

export const levelOf = (unit) => Math.min(4, Math.max(1, Number(unit?.level) || 1));
// Số thứ tự của chủ đề TRONG CẤP của nó (1, 2, 3…) theo sort_order (hoà thì theo id). Tính lúc hiển thị, KHÔNG lưu — đổi thứ tự ▲▼ là số tự đổi.
// Truyền vào các chủ đề cần đánh số (bỏ chủ đề ẩn). Trả Map id → số. Khu bé chỉ thấy chủ đề đã duyệt nên số ở đó liền nhau, không bỏ cách.
export function numberUnits(units) {
  const per = new Map();
  const out = new Map();
  [...units].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id).forEach((u) => {
    const lv = levelOf(u);
    per.set(lv, (per.get(lv) ?? 0) + 1);
    out.set(u.id, per.get(lv));
  });
  return out;
}
export const percent = (part, whole) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

// Ghép khung 4 cấp với kết quả RPC child_stats (stats.levels chỉ có cấp đã có nội dung được duyệt).
export function levelProgress(stats) {
  const by = new Map((stats?.levels ?? []).map((l) => [l.level, l]));
  return LEVELS.map((L) => {
    const s = by.get(L.n) ?? {};
    const items_total = s.items_total ?? 0, items_mastered = s.items_mastered ?? 0;
    return {
      ...L, items_total, items_mastered,
      lessons_total: s.lessons_total ?? 0, lessons_done: s.lessons_done ?? 0,
      hasContent: (s.lessons_total ?? 0) > 0,
      percent: percent(items_mastered, items_total),
      passed: items_total > 0 && items_mastered / items_total >= PASS_RATIO,
    };
  });
}

// Cấp gợi ý "Con đang ở đây": cấp có nội dung ĐẦU TIÊN chưa qua; qua hết thì cấp cuối có nội dung. Không khoá — chỉ gợi ý.
export function recommendedLevel(progress) {
  const withContent = progress.filter((p) => p.hasContent);
  if (!withContent.length) return null;
  return (withContent.find((p) => !p.passed) ?? withContent[withContent.length - 1]).n;
}
