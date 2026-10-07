-- Số liệu từng BÀI của 1 chủ đề cho danh sách bài của Bài Bản, trong 1 lượt gọi (cùng cách bb_unit_stats của migration 034).
-- Security INVOKER (RLS vẫn áp dụng), chỉ bài đã duyệt; "chặng có dữ liệu" dùng bb_step_has_data (migration 032 — chạy 032 TRƯỚC).
-- steps = chặng có dữ liệu, done = chặng của p_child có trong bb_progress. Bài đã xong = steps > 0 và done = steps. Chạy lại nhiều lần không sao.
create or replace function public.bb_lesson_stats(p_child uuid, p_unit bigint)
returns table (lesson_id bigint, steps int, done int)
language sql stable set search_path = public as $$
  select l.id,
         count(st.id)::int,
         count(st.id) filter (where exists (select 1 from public.bb_progress p where p.step_id = st.id and p.child_id = p_child))::int
    from public.bb_lessons l
    left join public.bb_lesson_steps st
           on st.lesson_id = l.id and st.status = 'approved' and public.bb_step_has_data(st.id, st.step_type, st.config)
   where l.unit_id = p_unit and l.status = 'approved'
   group by l.id, l.sort_order
   order by l.sort_order, l.id;
$$;
revoke all on function public.bb_lesson_stats(uuid, bigint) from public;
grant execute on function public.bb_lesson_stats(uuid, bigint) to authenticated;
notify pgrst, 'reload schema';
