import { sb } from "./supabase.js";
import { el } from "./ui.js";
import { T } from "./strings.js";
import { levelProgress } from "./levels.js";
import { SKILLS, groupById, badgeProgress, skillMap, suggestSkills, trendOf, kindAllowed } from "./child/skills.js";
import { summarizePron } from "./pronunciation.js";

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
        ? [el("div", { class: "meter" }, el("div", { class: "meter-fill", style: `width:${p.percent}%` })),
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

// ---- Theo kỹ năng (RPC child_skill_stats, migration 017) ----
// Trả về mảng dòng theo kỹ năng, hoặc null nếu chưa chạy migration 017 / lỗi (báo cáo vẫn hiện các phần khác).
export async function loadSkillStats(childId) {
  const { data, error } = await sb.rpc("child_skill_stats", { p_child: childId });
  return error ? null : (data?.skills ?? []);
}

// Báo cáo đọc to: các lượt chấm gần nhất (kèm chữ của từng mục) → summarizePron. Lỗi/chưa có bảng thì trả null.
export async function loadPronReport(childId, limit = 60) {
  const { data, error } = await sb.from("pronunciation_attempts").select("item_id, score, detail, created_at").eq("child_id", childId).order("created_at", { ascending: false }).limit(limit);
  if (error) return null;
  const ids = [...new Set((data ?? []).map((r) => r.item_id))];
  let texts = new Map();
  if (ids.length) {
    const r = await sb.from("content_items").select("id, text_vi").in("id", ids);
    texts = new Map((r.data ?? []).map((x) => [x.id, x.text_vi]));
  }
  return summarizePron(data ?? [], texts);
}

const TREND = { up: ["▲", "up"], down: ["▼", "down"] };

// Thẻ "Luyện tập theo kỹ năng": mỗi kỹ năng 1 hàng — biểu tượng + tên (màu nhóm), thanh điểm 30 ngày, huy hiệu, xu hướng. Kèm gợi ý luyện thêm.
export function skillStatsView(rows, age = null) {
  if (rows == null) return el("p", { class: "muted" }, T.statsError);
  const by = skillMap(rows);
  const list = SKILLS.filter((s) => by.has(s.id) && (by.get(s.id).activities_30 > 0 || by.get(s.id).sessions > 0));
  if (!list.length) return el("p", { class: "muted" }, T.statsSkillNone);
  const allowed = SKILLS.filter((s) => s.kinds.some((k) => kindAllowed(k, age))).map((s) => s.id);
  const sug = suggestSkills(rows, allowed);
  return el("div", null,
    el("div", { class: "sk-rows" }, list.map((s) => {
      const r = by.get(s.id);
      const g = groupById(s.group);
      const { cur, next, remaining } = badgeProgress(r.good ?? 0);
      const tr = trendOf(r.avg_30, r.avg_prev);
      return el("div", { class: "sk-row", style: `--c:${g.color}` },
        el("div", { class: "sk-head" },
          el("b", null, s.emoji + " " + s.name),
          cur ? el("span", { class: "sk-medal", title: cur.name }, cur.emoji) : null,
          tr ? el("span", { class: "trend " + TREND[tr][1], title: T.statsSkillHelp }, TREND[tr][0]) : null),
        el("div", { class: "meter" }, el("div", { class: "meter-fill", style: `width:${r.avg_30 ?? 0}%;background:${g.color}` })),
        el("span", { class: "muted" }, T.statsSkillMeta(r.avg_30, r.activities_30 ?? 0, r.minutes_30 ?? 0)),
        el("span", { class: "muted" }, next ? T.statsBadgeNext(next.name, remaining) : T.statsBadgeMax));
    })),
    el("p", { class: "muted" }, T.statsSkillHelp),
    sug.length ? el("div", null, el("h4", null, T.statsSuggestTitle), el("ul", { class: "sk-sug" }, sug.map((x) => {
      const s = SKILLS.find((k) => k.id === x.skill);
      return el("li", null, s.emoji + " ", x.reason === "low" ? T.statsSuggestLow(s.name, x.avg) : T.statsSuggestUnused(s.name));
    }))) : null);
}

// Thẻ "Đánh giá đọc to": mức nhận xét + điểm trung bình + phân bố kiểu lỗi + từ hay đọc chưa đúng + lời khuyên + lưu ý giới hạn.
export function pronReportView(rep, enabled) {
  if (!enabled && !rep?.count) return el("p", { class: "muted" }, T.statsPronOff);
  if (rep == null) return el("p", { class: "muted" }, T.statsError);
  if (!rep.count) return el("p", { class: "muted" }, T.statsPronEmpty);
  const order = ["ok", "tone", "initial", "close", "wrong", "missing"];
  const tr = rep.trend ? TREND[rep.trend] : null;
  return el("div", null,
    el("div", { class: "pron-head" },
      el("span", { class: "pill lv-" + rep.level }, T.statsPronLevels[rep.level]),
      tr ? el("span", { class: "trend " + tr[1] }, tr[0]) : null,
      el("span", { class: "muted" }, T.statsPronSummary(rep.avg, rep.count))),
    rep.syllables ? el("div", { class: "pron-bars" }, order.filter((k) => rep.percent[k] > 0).map((k) =>
      el("div", { class: "pron-bar" }, el("span", null, T.statsPronKinds[k]),
        el("div", { class: "meter" }, el("div", { class: "meter-fill " + k, style: `width:${rep.percent[k]}%` })), el("b", null, rep.percent[k] + "%")))) : null,
    rep.mainIssue ? el("p", { class: "note-soft" }, "💡 " + T.statsPronIssue[rep.mainIssue]) : null,
    rep.weakWords.length ? el("div", null, el("h4", null, T.statsPronWeak), el("div", { class: "review" }, rep.weakWords.map((w) => el("span", { class: "chip" }, w.text || "—", " ", el("small", { class: "muted" }, w.avg))))) : null,
    el("p", { class: "muted" }, T.statsPronNote));
}

// Bản cho phụ huynh: thêm phút học, điểm phát âm, từ cần ôn; extra = { skills (loadSkillStats), pron (loadPronReport), pronEnabled, age }.
export function parentStatsView(stats, extra = {}) {
  const t = totals(stats);
  const pron = stats.pron?.count ? `${stats.pron.avg}` : T.statsPronNone;
  return el("div", null,
    el("div", { class: "tiles" },
      tile("⭐", stats.stars, T.statsStars), tile("🔥", stats.streak, T.statsStreak), tile("📚", t.words, T.statsWords), tile("✅", t.lessons, T.statsLessons),
      tile("⏱️", stats.week?.minutes ?? 0, T.statsWeekMin), tile("🎤", pron, T.statsPron)),
    el("h3", null, T.statsWeekTitle), weekChart(stats.days, 14),
    el("h3", null, T.statsLevelsTitle), levelBars(t.lv), el("p", { class: "muted" }, T.statsPassRule),
    "skills" in extra ? [el("h3", null, T.statsSkillTitle), skillStatsView(extra.skills, extra.age)] : null,
    "pron" in extra ? [el("h3", null, T.statsPronTitle), pronReportView(extra.pron, extra.pronEnabled)] : null,
    el("h3", null, T.statsReviewTitle), reviewList(stats.review));
}
