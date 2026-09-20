-- 009_reading.sql — hỗ trợ Cấp 4 (đọc hiểu, chính tả, viết): mục "câu hỏi", 5 hoạt động mới, thống kê không đếm câu hỏi.
-- Chạy TAY trong SQL Editor (sau 001–008). Chạy lại nhiều lần không hại.

-- 1) Kiểu mục 'question' (câu hỏi đọc hiểu) + cột extra: {"choices":["…","…"], "answer": 1}  (answer = số thứ tự đáp án đúng, đếm từ 1)
alter table public.content_items drop constraint if exists content_items_item_type_check;
alter table public.content_items add constraint content_items_item_type_check
  check (item_type in ('word', 'phrase', 'sentence', 'story', 'song', 'letter', 'syllable', 'question'));

alter table public.content_items add column if not exists extra jsonb;
-- coalesce: thiếu extra/answer cho NULL mà CHECK coi NULL là đạt → phải ép thành false.
alter table public.content_items drop constraint if exists content_items_question_extra_check;
alter table public.content_items add constraint content_items_question_extra_check
  check (item_type <> 'question' or coalesce(
    jsonb_typeof(extra -> 'choices') = 'array' and jsonb_array_length(extra -> 'choices') between 2 and 4
    and (extra ->> 'answer') ~ '^[1-4]$' and (extra ->> 'answer')::int <= jsonb_array_length(extra -> 'choices'), false));

-- 2) Hoạt động mới: đọc đoạn – trả lời câu hỏi, điền từ vào chỗ trống, chọn câu viết đúng, xếp chữ thành từ (chính tả), xếp câu thành chuyện
alter table public.activities drop constraint if exists activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (kind in ('listen_pick', 'listen_repeat', 'match', 'sort', 'listen_pick_text',
                  'listen_pick_tone', 'build_syllable', 'fill_letter', 'read_pick', 'order_words',
                  'read_quiz', 'fill_word', 'write_check', 'spell_word', 'order_story'));

-- 3) child_stats: câu hỏi đọc hiểu không tính là "từ đã thuộc" (giữ nguyên mọi thứ khác so với 007)
create or replace function public.child_stats(p_child uuid, p_tz text default 'UTC')
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  tz text := coalesce(nullif(p_tz, ''), 'UTC');
  today date;
  result jsonb;
begin
  if not exists (select 1 from public.child_profiles c where c.id = p_child) then
    raise exception 'Không tìm thấy hồ sơ con hoặc không có quyền xem';
  end if;
  begin
    today := (now() at time zone tz)::date;
  exception when others then
    tz := 'UTC';
    today := (now() at time zone tz)::date;
  end;

  with
  lv as (
    select u.level,
           count(distinct l.id) as lessons_total,
           count(distinct i.id) as items_total
      from public.units u
      join public.lessons l on l.unit_id = u.id and l.status = 'approved'
      left join public.content_items i on i.lesson_id = l.id and i.status = 'approved' and i.item_type <> 'question'
     where u.status = 'approved'
     group by u.level),
  mastered as (
    select u.level, count(*) as n
      from public.child_progress p
      join public.content_items i on i.id = p.item_id and i.status = 'approved' and i.item_type <> 'question'
      join public.lessons l on l.id = i.lesson_id and l.status = 'approved'
      join public.units u on u.id = l.unit_id and u.status = 'approved'
     where p.child_id = p_child and p.mastery >= 3
     group by u.level),
  best as (
    select a.lesson_id, max(a.score) as score
      from public.activity_log a
      join public.lessons l on l.id = a.lesson_id and l.status = 'approved'
      join public.units u on u.id = l.unit_id and u.status = 'approved'
     where a.child_id = p_child and a.kind = 'lesson'
     group by a.lesson_id),
  done as (
    select u.level, count(*) as n
      from best b
      join public.lessons l on l.id = b.lesson_id
      join public.units u on u.id = l.unit_id
     group by u.level),
  logs as (
    select (a.created_at at time zone tz)::date as day, a.duration_seconds, a.kind
      from public.activity_log a
     where a.child_id = p_child and a.created_at > now() - interval '400 days'),
  daily as (
    select day, round(sum(duration_seconds) / 60.0)::int as minutes, count(*) filter (where kind = 'lesson') as lessons
      from logs group by day),
  streak_days as (
    select day, day - (dense_rank() over (order by day))::int as grp from (select distinct day from logs) d),
  streak as (
    select count(*) as n from streak_days
     where grp = (select grp from streak_days where day in (today, today - 1) order by day desc limit 1)),
  rev as (
    select i.id, i.text_vi, i.emoji, p.mastery, p.wrong_count
      from public.child_progress p
      join public.content_items i on i.id = p.item_id and i.status = 'approved' and i.item_type <> 'question'
      join public.lessons l on l.id = i.lesson_id and l.status = 'approved'
      join public.units u on u.id = l.unit_id and u.status = 'approved'
     where p.child_id = p_child and p.wrong_count > 0 and p.mastery < 3
     order by p.mastery asc, p.wrong_count desc, p.last_seen_at desc
     limit 8),
  pr as (
    select score from public.pronunciation_attempts
     where child_id = p_child and score is not null order by created_at desc limit 30)
  select jsonb_build_object(
    'levels', coalesce((select jsonb_agg(jsonb_build_object(
        'level', lv.level, 'items_total', lv.items_total, 'lessons_total', lv.lessons_total,
        'items_mastered', coalesce(m.n, 0), 'lessons_done', coalesce(d.n, 0)) order by lv.level)
      from lv left join mastered m on m.level = lv.level left join done d on d.level = lv.level), '[]'::jsonb),
    'stars', coalesce((select sum(case when score >= 85 then 3 when score >= 60 then 2 else 1 end) from best), 0),
    'streak', coalesce((select n from streak), 0),
    'week', jsonb_build_object(
      'minutes', coalesce((select sum(minutes) from daily where day > today - 7), 0),
      'lessons', coalesce((select sum(lessons) from daily where day > today - 7), 0)),
    'days', (select jsonb_agg(jsonb_build_object('day', g.day::date, 'minutes', coalesce(dl.minutes, 0), 'lessons', coalesce(dl.lessons, 0)) order by g.day)
               from generate_series(today - 13, today, interval '1 day') as g(day) left join daily dl on dl.day = g.day::date),
    'pron', jsonb_build_object('avg', (select round(avg(score))::int from pr), 'count', (select count(*) from pr)),
    'review', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'text_vi', text_vi, 'emoji', emoji, 'mastery', mastery, 'wrong_count', wrong_count)) from rev), '[]'::jsonb)
  ) into result;
  return result;
end $$;

grant execute on function public.child_stats(uuid, text) to authenticated;
