-- Khu TRẺ EM: gộp truy vấn nối tiếp thành 1 lượt gọi mỗi màn (cùng cách migration 031/032 làm cho Bài Bản):
--   child_lesson_bundle(lesson, child)   — vào 1 bài: mục (+nghĩa +âm thanh) + hoạt động + tiến độ các mục
--   child_lesson_scores(child, unit)     — điểm cao nhất từng bài của 1 chủ đề (sao ở danh sách bài)
--   child_practice_data()                — Luyện tập: mục đã duyệt + câu hỏi + bài giao tiếp (thay ~10 truy vấn ở 3 hàm tải)
--   child_sound_bank()                   — ngân hàng âm (chủ đề ẩn) cho hoạt động đánh vần theo phần
-- Tất cả security INVOKER (RLS vẫn áp dụng — hết hạn thì không đọc được), chỉ ĐỌC. Hình dạng kết quả khớp các hàm cũ trong
-- public/js/child/api.js (hàm cũ giữ làm đường lùi khi chưa chạy migration này). Cần migration 010 (units.hidden). Chạy lại nhiều lần không sao.

create or replace function public.child_lesson_bundle(p_lesson bigint, p_child uuid)
returns jsonb language sql stable set search_path = public as $$
  with it as (select * from public.content_items where lesson_id = p_lesson)
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(i)
        || jsonb_build_object(
             'translations', coalesce((select jsonb_agg(to_jsonb(t)) from public.translations t where t.item_id = i.id), '[]'::jsonb),
             'content_audio', coalesce((select jsonb_agg(to_jsonb(a)) from public.content_audio a where a.item_id = i.id), '[]'::jsonb))
        order by i.sort_order, i.id) from it i), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(a) order by a.sort_order, a.id) from public.activities a where a.lesson_id = p_lesson), '[]'::jsonb),
    'progress', coalesce((select jsonb_agg(to_jsonb(p)) from public.child_progress p where p.child_id = p_child and p.item_id in (select id from it)), '[]'::jsonb));
$$;

create or replace function public.child_lesson_scores(p_child uuid, p_unit bigint)
returns table (lesson_id bigint, score numeric) language sql stable set search_path = public as $$
  select l.lesson_id, max(l.score)
    from public.activity_log l
    join public.lessons ls on ls.id = l.lesson_id and ls.unit_id = p_unit
   where l.child_id = p_child and l.kind = 'lesson'
   group by l.lesson_id;
$$;

-- Mục ĐÃ DUYỆT của các bài đã duyệt thuộc chủ đề đã duyệt, không ẩn (khớp child/api.js loadCatalog) + câu hỏi đọc hiểu + bài giao tiếp.
create or replace function public.child_practice_data()
returns jsonb language sql stable set search_path = public as $$
  with ls as (
    select l.id, l.unit_id from public.lessons l join public.units u on u.id = l.unit_id
     where l.status = 'approved' and u.status = 'approved' and not u.hidden),
  it as (select i.* from public.content_items i join ls on ls.id = i.lesson_id where i.status = 'approved')
  select jsonb_build_object(
    'lessons', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'unit_id', unit_id)) from ls), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'lesson_id', i.lesson_id, 'item_type', i.item_type, 'text_vi', i.text_vi, 'say_vi', i.say_vi, 'emoji', i.emoji,
        'image_path', i.image_path, 'pic', i.pic, 'sort_order', i.sort_order,
        'translations', coalesce((select jsonb_agg(jsonb_build_object('lang', t.lang, 'meaning', t.meaning)) from public.translations t where t.item_id = i.id), '[]'::jsonb))
        order by i.id) from it i where i.item_type <> 'question'), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'lesson_id', i.lesson_id) order by i.id) from it i where i.item_type = 'question'), '[]'::jsonb),
    'dialogue_lessons', coalesce((select jsonb_agg(distinct a.lesson_id) from public.activities a join ls on ls.id = a.lesson_id where a.kind = 'dialogue'), '[]'::jsonb));
$$;

create or replace function public.child_sound_bank()
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'text_vi', i.text_vi, 'say_vi', i.say_vi,
      'content_audio', coalesce((select jsonb_agg(to_jsonb(a)) from public.content_audio a where a.item_id = i.id), '[]'::jsonb))), '[]'::jsonb)
    from public.content_items i
    join public.lessons l on l.id = i.lesson_id
    join public.units u on u.id = l.unit_id and u.hidden;
$$;

revoke all on function public.child_lesson_bundle(bigint, uuid), public.child_lesson_scores(uuid, bigint),
  public.child_practice_data(), public.child_sound_bank() from public;
grant execute on function public.child_lesson_bundle(bigint, uuid), public.child_lesson_scores(uuid, bigint),
  public.child_practice_data(), public.child_sound_bank() to authenticated;
notify pgrst, 'reload schema';
