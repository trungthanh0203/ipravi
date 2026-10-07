-- Số liệu từng Chủ đề của 1 Cấp cho màn danh sách chủ đề của Bài Bản, trong 1 lượt gọi (cùng cách bb_level_stats của migration 031).
-- Security INVOKER (RLS vẫn áp dụng), chỉ tính nội dung ĐÃ DUYỆT; "chặng có dữ liệu" dùng bb_step_has_data (migration 032 — chạy 032 TRƯỚC).
-- done = chặng của p_child có trong bb_progress; lessons_done = bài có ≥1 chặng có dữ liệu và MỌI chặng đó đều xong. Chạy lại nhiều lần không sao.
create or replace function public.bb_unit_stats(p_child uuid, p_level bigint)
returns table (unit_id bigint, lessons int, lessons_done int, steps int, done int)
language sql stable set search_path = public as $$
  with u as (select id, sort_order from public.bb_units where level_id = p_level and status = 'approved'),
  s as (
    select st.id, st.lesson_id, l.unit_id,
           exists (select 1 from public.bb_progress p where p.step_id = st.id and p.child_id = p_child) as is_done
      from public.bb_lesson_steps st
      join public.bb_lessons l on l.id = st.lesson_id and l.status = 'approved'
      join u on u.id = l.unit_id
     where st.status = 'approved' and public.bb_step_has_data(st.id, st.step_type, st.config)
  ),
  per_lesson as (select unit_id, lesson_id, count(*) as n, count(*) filter (where is_done) as d from s group by unit_id, lesson_id)
  select u.id,
         (select count(*) from public.bb_lessons l where l.unit_id = u.id and l.status = 'approved')::int,
         (select count(*) from per_lesson pl where pl.unit_id = u.id and pl.n = pl.d)::int,
         (select count(*) from s where s.unit_id = u.id)::int,
         (select count(*) from s where s.unit_id = u.id and s.is_done)::int
    from u
   order by u.sort_order, u.id;
$$;
revoke all on function public.bb_unit_stats(uuid, bigint) from public;
grant execute on function public.bb_unit_stats(uuid, bigint) to authenticated;
notify pgrst, 'reload schema';
