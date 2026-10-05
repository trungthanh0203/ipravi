-- Gộp nhiều truy vấn nối tiếp của khu Bài Bản thành MỖI MÀN 1 LƯỢT gọi (trình duyệt → Supabase xa nên mỗi lượt tốn 100–300ms):
--   bb_completed_lessons(child, unit)  — danh sách bài (✓ bài đã xong)
--   bb_lesson_content(lesson, child)   — vào 1 bài: các chặng + nội dung + chặng đã xong
--   bb_practice_content()              — màn Luyện tập: toàn bộ nội dung đã duyệt
-- Tất cả security INVOKER (RLS vẫn áp dụng: chỉ nội dung đã duyệt, hết hạn thì không đọc được), chỉ ĐỌC. Kết quả có cùng hình dạng
-- với các hàm cũ trong public/js/bb/api.js (hàm cũ giữ làm đường lùi khi chưa chạy migration này). Chạy lại nhiều lần không sao.

-- "Chặng có dữ liệu" (khớp bb/api.js visibleStepsOf() và migration 031): minigame cần config.kind, loại khác cần ≥1 dòng nội dung.
create or replace function public.bb_step_has_data(p_id bigint, p_type text, p_config jsonb)
returns boolean language sql stable set search_path = public as $$
  select (p_type = 'minigame' and coalesce(p_config ->> 'kind', '') <> '')
      or exists (select 1 from public.bb_dialogue_lines x where x.step_id = p_id)
      or exists (select 1 from public.bb_vocab x where x.step_id = p_id)
      or exists (select 1 from public.bb_grammar x where x.step_id = p_id)
      or exists (select 1 from public.bb_phonics_pairs x where x.step_id = p_id)
      or exists (select 1 from public.bb_reading_passages x where x.step_id = p_id)
      or exists (select 1 from public.bb_listening_passages x where x.step_id = p_id)
      or exists (select 1 from public.bb_writing_tasks x where x.step_id = p_id);
$$;

-- Bài đã xong trong 1 chủ đề = có ≥1 chặng có dữ liệu và MỌI chặng đó đều có trong bb_progress của p_child.
create or replace function public.bb_completed_lessons(p_child uuid, p_unit bigint)
returns setof bigint language sql stable set search_path = public as $$
  select l.id
    from public.bb_lessons l
   where l.unit_id = p_unit and l.status = 'approved'
     and exists (select 1 from public.bb_lesson_steps s where s.lesson_id = l.id and s.status = 'approved' and public.bb_step_has_data(s.id, s.step_type, s.config))
     and not exists (
       select 1 from public.bb_lesson_steps s
        where s.lesson_id = l.id and s.status = 'approved' and public.bb_step_has_data(s.id, s.step_type, s.config)
          and not exists (select 1 from public.bb_progress p where p.step_id = s.id and p.child_id = p_child));
$$;

-- Nội dung 1 bài: { steps: [{...bb_lesson_steps, content}], done: [step_id đã xong] }.
-- content: dialogue/vocab/grammar/phonics/writing = mảng dòng (sort_order); reading/listening = {passage, questions} hoặc null; minigame = null.
create or replace function public.bb_lesson_content(p_lesson bigint, p_child uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'steps', coalesce((select jsonb_agg(to_jsonb(st) || jsonb_build_object('content', case st.step_type
        when 'dialogue' then (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.id), '[]'::jsonb) from public.bb_dialogue_lines x where x.step_id = st.id)
        when 'vocab'    then (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.id), '[]'::jsonb) from public.bb_vocab x where x.step_id = st.id)
        when 'grammar'  then (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.id), '[]'::jsonb) from public.bb_grammar x where x.step_id = st.id)
        when 'phonics'  then (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.id), '[]'::jsonb) from public.bb_phonics_pairs x where x.step_id = st.id)
        when 'writing'  then (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.id), '[]'::jsonb) from public.bb_writing_tasks x where x.step_id = st.id)
        when 'reading'  then (select jsonb_build_object('passage', to_jsonb(p), 'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.sort_order, q.id) from public.bb_reading_questions q where q.passage_id = p.id), '[]'::jsonb))
                                from public.bb_reading_passages p where p.step_id = st.id order by p.id limit 1)
        when 'listening' then (select jsonb_build_object('passage', to_jsonb(p), 'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.sort_order, q.id) from public.bb_listening_questions q where q.passage_id = p.id), '[]'::jsonb))
                                from public.bb_listening_passages p where p.step_id = st.id order by p.id limit 1)
        else null end) order by st.sort_order, st.id)
        from public.bb_lesson_steps st where st.lesson_id = p_lesson and st.status = 'approved'), '[]'::jsonb),
    'done', coalesce((select jsonb_agg(p.step_id) from public.bb_progress p
                       join public.bb_lesson_steps s2 on s2.id = p.step_id
                      where p.child_id = p_child and s2.lesson_id = p_lesson), '[]'::jsonb));
$$;

-- Toàn bộ nội dung ĐÃ DUYỆT (cấp → chủ đề → bài → chặng đều approved) cho màn Luyện tập.
create or replace function public.bb_practice_content()
returns jsonb language sql stable set search_path = public as $$
  with lv as (select * from public.bb_levels where status = 'approved'),
  un as (select u.* from public.bb_units u join lv on lv.id = u.level_id where u.status = 'approved'),
  ls as (select l.* from public.bb_lessons l join un on un.id = l.unit_id where l.status = 'approved'),
  st as (select s.* from public.bb_lesson_steps s join ls on ls.id = s.lesson_id where s.status = 'approved'),
  rp as (select p.* from public.bb_reading_passages p join st on st.id = p.step_id),
  lp as (select p.* from public.bb_listening_passages p join st on st.id = p.step_id)
  select jsonb_build_object(
    'levels',   coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order, x.id) from lv x), '[]'::jsonb),
    'units',    coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order, x.id) from un x), '[]'::jsonb),
    'lessons',  coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order, x.id) from ls x), '[]'::jsonb),
    'steps',    coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order, x.id) from st x), '[]'::jsonb),
    'vocab',    coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order, x.id) from public.bb_vocab x join st on st.id = x.step_id), '[]'::jsonb),
    'grammar',  coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order, x.id) from public.bb_grammar x join st on st.id = x.step_id), '[]'::jsonb),
    'phonics',  coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order, x.id) from public.bb_phonics_pairs x join st on st.id = x.step_id), '[]'::jsonb),
    'dialogue', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order, x.id) from public.bb_dialogue_lines x join st on st.id = x.step_id), '[]'::jsonb),
    'reading',  coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from rp x), '[]'::jsonb),
    'listening', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from lp x), '[]'::jsonb),
    'readingQuestions',   coalesce((select jsonb_agg(to_jsonb(q) order by q.sort_order, q.id) from public.bb_reading_questions q join rp on rp.id = q.passage_id), '[]'::jsonb),
    'listeningQuestions', coalesce((select jsonb_agg(to_jsonb(q) order by q.sort_order, q.id) from public.bb_listening_questions q join lp on lp.id = q.passage_id), '[]'::jsonb));
$$;

revoke all on function public.bb_step_has_data(bigint, text, jsonb), public.bb_completed_lessons(uuid, bigint),
  public.bb_lesson_content(bigint, uuid), public.bb_practice_content() from public;
grant execute on function public.bb_step_has_data(bigint, text, jsonb), public.bb_completed_lessons(uuid, bigint),
  public.bb_lesson_content(bigint, uuid), public.bb_practice_content() to authenticated;
notify pgrst, 'reload schema';
