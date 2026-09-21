-- 017_skill_stats.sql — thống kê THEO KỸ NĂNG cho huy hiệu của bé và báo cáo của phụ huynh (kế hoạch: KE_HOACH_LUYEN_TAP_THEO_KY_NANG.md, giai đoạn 2).
-- Chạy TAY trong SQL Editor (sau 001–016). Chạy lại nhiều lần không hại. Không thêm bảng/cột; chỉ đọc activity_log.

-- Mỗi kỹ năng trả về:
--   sessions / good   số PHIÊN luyện tập (kind='practice') từ trước tới nay, và số phiên đạt ≥ 85 điểm (cơ sở của huy hiệu 🥉🥈🥇)
--   last_at           phiên luyện tập gần nhất
--   activities_30     số lượt chơi (từng trò, cả bài học lẫn luyện tập) trong 30 ngày qua
--   avg_30 / avg_prev điểm trung bình 30 ngày qua / 30 ngày trước đó (để hiện xu hướng)
--   minutes_30        phút chơi trong 30 ngày qua (cộng thời lượng từng trò, KHÔNG cộng dòng cả phiên → không đếm đôi)
-- Dòng cũ chưa có cột skill (trước migration 016) được suy ra từ kind bằng skill_of().
create or replace function public.child_skill_stats(p_child uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.child_profiles c where c.id = p_child) then
    raise exception 'Không tìm thấy hồ sơ con hoặc không có quyền xem';
  end if;

  with
  acts as (
    select coalesce(a.skill, public.skill_of(a.kind)) as skill, a.score, a.duration_seconds, a.created_at
      from public.activity_log a
     where a.child_id = p_child and a.kind not in ('lesson', 'practice') and a.created_at > now() - interval '60 days'),
  cur as (
    select skill, count(*) as n, round(avg(score))::int as avg, round(sum(duration_seconds) / 60.0)::int as minutes
      from acts where skill is not null and created_at > now() - interval '30 days' group by skill),
  prev as (
    select skill, round(avg(score))::int as avg
      from acts where skill is not null and created_at <= now() - interval '30 days' group by skill),
  sess as (
    select a.skill, count(*) as sessions, count(*) filter (where a.score >= 85) as good, max(a.created_at) as last_at
      from public.activity_log a
     where a.child_id = p_child and a.kind = 'practice' and a.source = 'practice' and a.skill is not null
     group by a.skill),
  names as (select skill from cur union select skill from prev union select skill from sess)
  select coalesce(jsonb_agg(jsonb_build_object(
      'skill', n.skill,
      'sessions', coalesce(se.sessions, 0), 'good', coalesce(se.good, 0), 'last_at', se.last_at,
      'activities_30', coalesce(c.n, 0), 'avg_30', c.avg, 'avg_prev', p.avg, 'minutes_30', coalesce(c.minutes, 0)
    ) order by n.skill), '[]'::jsonb)
    into result
    from names n
    left join sess se on se.skill = n.skill
    left join cur c on c.skill = n.skill
    left join prev p on p.skill = n.skill;

  return jsonb_build_object('skills', result);
end $$;

grant execute on function public.child_skill_stats(uuid) to authenticated;
