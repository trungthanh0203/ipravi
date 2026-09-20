import { sb } from "./supabase.js";
import { el } from "./ui.js";
import { T } from "./strings.js";
import { levelProgress } from "./levels.js";

// Thống kê học tập của 1 bé: RPC child_stats (migration 007) — RLS lọc: phụ huynh chỉ xem con mình, chỉ tính nội dung đã duyệt.
export async function loadStats(childId) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { data, error } = await sb.rpc("child_stats", { p_child: childId, p_tz: tz });
  if (error) throw error;
  return data;
}

const tile = (icon, value, label) => el("div", { class: "tile" }, el("div", { class: "tile-icon" }, icon), el("b", null, String(value)), el("span", null, label));

const totals = (stats) => {
  const lv = levelProgress(stats);
  return { words: lv.reduce((a, l) => a + l.items_mastered, 0), lessons: lv.reduce((a, l) => a + l.lessons_done, 0), lv };
};

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
// Biểu đồ cột phút học mỗi ngày (mặc định 14 ngày gần nhất); hôm nay ở cuối, được tô đậm.
export function weekChart(days = [], count = 14) {
  const list = days.slice(-count);
  const max = Math.max(10, ...list.map((d) => d.minutes));
  return el("div", { class: "chart", role: "img", "aria-label": T.statsWeekTitle },
    list.map((d, i) => {
      const today = i === list.length - 1;
      const wd = WD[new Date(`${d.day}T12:00:00`).getDay()];
      return el("div", { class: "chart-col" + (today ? " today" : ""), title: `${d.day}: ${T.statsMinutes(d.minutes)}` },
        el("span", { class: "chart-val" }, d.minutes ? String(d.minutes) : ""),
        el("div", { class: "chart-bar", style: `height:${d.minutes ? Math.max(6, Math.round((100 * d.minutes) / max)) : 3}%` }),
        el("span", { class: "chart-day" }, today ? T.statsToday : wd));
    }));
}

// Thanh tiến độ từng cấp: từ đã thuộc / tổng, số bài xong, huy hiệu "Đạt cấp".
export function levelBars(progress) {
  return el("div", { class: "level-bars" }, progress.map((p) =>
    el("div", { class: "level-bar" + (p.hasContent ? "" : " soon") },
      el("div", { class: "row" },
        el("b", null, `${p.emoji} Cấp ${p.n} · ${p.name}`),
        p.passed ? el("span", { class: "pill good" }, T.levelPassed) : !p.hasContent ? el("span", { class: "pill" }, T.levelSoon) : null),
      p.hasContent
        ? [el("div", { class: "bar" }, el("div", { class: "bar-fill", style: `width:${p.percent}%` })),
           el("span", { class: "muted" }, `${T.levelWords(p.items_mastered, p.items_total)} · ${T.levelLessons(p.lessons_done, p.lessons_total)} (${p.percent}%)`)]
        : el("span", { class: "muted" }, p.focus))));
}

export function reviewList(review = []) {
  if (!review.length) return el("p", { class: "muted" }, T.statsReviewNone);
  return el("div", { class: "review" }, review.map((r) => el("span", { class: "chip" }, r.emoji ? r.emoji + " " : "", r.text_vi)));
}

// Bản cho bé: ít số, to, vui.
export function childStatsView(stats) {
  const t = totals(stats);
  return el("div", null,
    el("div", { class: "tiles big" }, tile("⭐", stats.stars, T.statsStars), tile("🔥", stats.streak, T.statsStreak), tile("📚", t.words, T.statsWords), tile("✅", t.lessons, T.statsLessons)),
    el("h2", null, T.statsWeek7Title), weekChart(stats.days, 7),
    el("h2", null, T.statsLevelsTitle), levelBars(t.lv));
}

// Bản cho phụ huynh: thêm phút học, điểm phát âm, từ cần ôn.
export function parentStatsView(stats) {
  const t = totals(stats);
  const pron = stats.pron?.count ? `${stats.pron.avg}` : T.statsPronNone;
  return el("div", null,
    el("div", { class: "tiles" },
      tile("⭐", stats.stars, T.statsStars), tile("🔥", stats.streak, T.statsStreak), tile("📚", t.words, T.statsWords), tile("✅", t.lessons, T.statsLessons),
      tile("⏱️", stats.week?.minutes ?? 0, T.statsWeekMin), tile("🎤", pron, T.statsPron)),
    el("h3", null, T.statsWeekTitle), weekChart(stats.days, 14),
    el("h3", null, T.statsLevelsTitle), levelBars(t.lv), el("p", { class: "muted" }, T.statsPassRule),
    el("h3", null, T.statsReviewTitle), reviewList(stats.review));
}
