import { sb } from "../supabase.js";
import { el } from "../ui.js";
import { T } from "../strings.js";
import { SKILLS, groupById, badgeOf, GOOD_SCORE } from "../child/skills.js";
import { isWeakReview } from "./adapter.js";

// Thống kê học tập của 1 người học "Tiếng Việt Bài Bản" cho PHỤ HUYNH (khu phụ huynh). Tách khỏi stats.js (khu Trẻ em: RPC
// child_stats gắn với content_items/child_progress) vì Bài Bản có dữ liệu riêng: bb_progress (chặng xong), bb_srs_state (hộp nhớ
// từng mục), bb_practice_log (phiên luyện tập, migration 028). RLS cho phụ huynh ĐỌC dữ liệu con mình (023/028).
// summarizeBb() là hàm thuần (test ở tests/bb.test.mjs).
const DAY = 86_400_000;
const dayKey = (d, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(d)); // YYYY-MM-DD theo múi giờ máy

export function summarizeBb({ progress = [], totalSteps = 0, srs = [], log = [], now = new Date(), tz = "UTC", days = 14 } = {}) {
  const practice = log.filter((r) => r.kind === "practice");
  const stamps = [...progress.map((p) => p.completed_at), ...practice.map((r) => r.created_at)].filter(Boolean);
  const perDay = new Map();
  for (const t of stamps) perDay.set(dayKey(t, tz), (perDay.get(dayKey(t, tz)) ?? 0) + 1);
  const series = Array.from({ length: days }, (_, i) => {
    const day = dayKey(new Date(now).getTime() - (days - 1 - i) * DAY, tz);
    return { day, count: perDay.get(day) ?? 0 };
  });
  // Chuỗi ngày: đếm lùi từ hôm nay (nếu hôm nay chưa học thì tính từ hôm qua) tới khi gặp ngày trống.
  let streak = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].count > 0) streak++;
    else if (i === series.length - 1) continue;
    else break;
  }
  const bySkill = new Map();
  for (const r of practice) {
    const s = bySkill.get(r.skill) ?? { skill: r.skill, sessions: 0, total: 0, good: 0 };
    s.sessions++; s.total += r.score ?? 0; if ((r.score ?? 0) >= GOOD_SCORE) s.good++;
    bySkill.set(r.skill, s);
  }
  const scored = practice.filter((r) => r.score != null);
  return {
    stepsDone: new Set(progress.map((p) => p.step_id)).size, totalSteps,
    learned: srs.filter((s) => s.box >= 3).length, reviewing: srs.filter((s) => s.box < 3).length,
    dueNow: srs.filter((s) => new Date(s.due_at) <= new Date(now)).length, weak: srs.filter(isWeakReview).length,
    sessions: practice.length, avgScore: scored.length ? Math.round(scored.reduce((a, r) => a + r.score, 0) / scored.length) : null,
    minutes: Math.round(practice.reduce((a, r) => a + (r.duration_seconds ?? 0), 0) / 60),
    streak, series, last: stamps.length ? stamps.reduce((a, b) => (a > b ? a : b)) : null,
    skills: [...bySkill.values()].map((s) => ({ ...s, avg: Math.round(s.total / s.sessions) })).sort((a, b) => b.sessions - a.sessions),
  };
}

async function allRows(table, cols, childId, extra = (q) => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await extra(sb.from(table).select(cols).eq("child_id", childId)).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

export async function loadBbStats(childId) {
  const [progress, srs, log] = await Promise.all([
    allRows("bb_progress", "step_id, completed_at", childId),
    allRows("bb_srs_state", "box, due_at, reviewed_count, correct_count", childId),
    allRows("bb_practice_log", "skill, kind, score, duration_seconds, created_at", childId, (q) => q.order("created_at", { ascending: false })).catch(() => []), // chưa chạy migration 028 → bỏ phần luyện tập
  ]);
  return summarizeBb({ progress, srs, log, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
}

const tile = (icon, value, label) => el("div", { class: "tile" }, el("div", { class: "tile-icon" }, icon), el("b", null, String(value)), el("span", null, label));
const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function bbStatsView(s) {
  const max = Math.max(3, ...s.series.map((d) => d.count));
  return el("div", null,
    el("div", { class: "tiles" },
      tile("✅", s.stepsDone, T.bbStatSteps), tile("📚", s.learned, T.bbStatLearned), tile("🔁", s.dueNow, T.bbStatDue),
      tile("🎯", s.weak, T.bbStatWeak), tile("🎮", s.sessions, T.bbStatSessions), tile("🔥", s.streak, T.statsStreak)),
    el("p", { class: "muted" }, T.bbStatProgress(s.reviewing, s.avgScore, s.minutes)),
    el("h3", null, T.bbStatWeekTitle),
    el("div", { class: "chart", role: "img", "aria-label": T.bbStatWeekTitle },
      s.series.map((d, i) => {
        const today = i === s.series.length - 1;
        return el("div", { class: "chart-col" + (today ? " today" : ""), title: `${d.day}: ${T.bbStatActs(d.count)}` },
          el("span", { class: "chart-val" }, d.count ? String(d.count) : ""),
          el("div", { class: "chart-bar", style: `height:${d.count ? Math.max(6, Math.round((100 * d.count) / max)) : 3}%` }),
          el("span", { class: "chart-day" }, today ? T.statsToday : WD[new Date(`${d.day}T12:00:00`).getDay()]));
      })),
    s.skills.length ? el("div", null, el("h3", null, T.bbStatSkillsTitle), el("div", { class: "sk-rows" }, s.skills.map((r) => {
      const sk = SKILLS.find((k) => k.id === r.skill);
      if (!sk) return null;
      const g = groupById(sk.group), medal = badgeOf(r.good);
      return el("div", { class: "sk-row", style: `--c:${g.color}` },
        el("div", { class: "sk-head" }, el("b", null, sk.emoji + " " + sk.name), medal ? el("span", { class: "sk-medal", title: medal.name }, medal.emoji) : null),
        el("div", { class: "meter" }, el("div", { class: "meter-fill", style: `width:${r.avg}%;background:${g.color}` })),
        el("span", { class: "muted" }, T.bbStatSkillMeta(r.avg, r.sessions)));
    }))) : el("p", { class: "muted" }, T.bbStatNoPractice));
}
