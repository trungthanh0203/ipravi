-- Số liệu từng Cấp cho màn "Chọn cấp độ" của Bài Bản trong 1 LƯỢT gọi (trước đây app phải gọi ~10 truy vấn nối tiếp từ trình duyệt).
-- Chạy với quyền NGƯỜI GỌI (security invoker) → RLS vẫn áp dụng; chỉ tính nội dung ĐÃ DUYỆT. "Chặng có dữ liệu" khớp bb/api.js visibleStepsOf():
-- minigame cần config.kind, các loại khác cần có ít nhất 1 dòng nội dung. done = chặng của p_child có trong bb_progress.
-- Chạy lại nhiều lần không sao.
create or replace function public.bb_level_stats(p_child uuid)
returns table (level_id bigint, units int, lessons int, steps int, done int)
language sql stable set search_path = public as $$
  with u as (select id, level_id from public.bb_units where status = 'approved'),
  l as (select bl.id, u.level_id from public.bb_lessons bl join u on u.id = bl.unit_id where bl.status = 'approved'),
  s as (
    select st.id, l.level_id
      from public.bb_lesson_steps st join l on l.id = st.lesson_id
     where st.status = 'approved' and (
       (st.step_type = 'minigame' and coalesce(st.config ->> 'kind', '') <> '')
       or exists (select 1 from public.bb_dialogue_lines x where x.step_id = st.id)
       or exists (select 1 from public.bb_vocab x where x.step_id = st.id)
       or exists (select 1 from public.bb_grammar x where x.step_id = st.id)
       or exists (select 1 from public.bb_phonics_pairs x where x.step_id = st.id)
       or exists (select 1 from public.bb_reading_passages x where x.step_id = st.id)
       or exists (select 1 from public.bb_listening_passages x where x.step_id = st.id)
       or exists (select 1 from public.bb_writing_tasks x where x.step_id = st.id))
  )
  select lv.id,
         (select count(*) from u where u.level_id = lv.id)::int,
         (select count(*) from l where l.level_id = lv.id)::int,
         (select count(*) from s where s.level_id = lv.id)::int,
         (select count(*) from s join public.bb_progress p on p.step_id = s.id and p.child_id = p_child where s.level_id = lv.id)::int
    from public.bb_levels lv
   where lv.status = 'approved'
   order by lv.sort_order, lv.id;
$$;
revoke all on function public.bb_level_stats(uuid) from public;
grant execute on function public.bb_level_stats(uuid) to authenticated;
notify pgrst, 'reload schema';
