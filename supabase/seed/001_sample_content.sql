-- Nội dung MẪU để thử giao diện học của trẻ: 2 chủ đề, 3 bài, 21 mục từ (nghĩa Đức + Anh), 12 hoạt động.
-- Chạy TAY trong SQL Editor SAU 001_init.sql và 002_emoji.sql. Chạy lại không tạo trùng.
-- Chưa có file âm thanh: app tạm đọc bằng giọng của trình duyệt cho tới khi có TTS sinh sẵn.

create or replace function pg_temp.add_item(p_lesson bigint, p_ord int, p_vi text, p_emoji text, p_de text, p_en text)
returns void language plpgsql as $$
declare i bigint;
begin
  insert into public.content_items (lesson_id, item_type, text_vi, emoji, sort_order, status)
  values (p_lesson, 'word', p_vi, p_emoji, p_ord, 'approved') returning id into i;
  insert into public.translations (item_id, lang, meaning) values (i, 'de', p_de), (i, 'en', p_en);
end $$;

create or replace function pg_temp.add_activities(p_lesson bigint)
returns void language sql as $$
  insert into public.activities (lesson_id, kind, config, sort_order, status) values
    (p_lesson, 'listen_pick',      '{"rounds":5,"choices":3}', 1, 'approved'),
    (p_lesson, 'match',            '{"pairs":4}',              2, 'approved'),
    (p_lesson, 'listen_pick_text', '{"rounds":4,"choices":3}', 3, 'approved'),
    (p_lesson, 'listen_repeat',    '{"rounds":3}',             4, 'approved');
$$;

do $$
declare u1 bigint; u2 bigint; l1 bigint; l2 bigint; l3 bigint;
begin
  if exists (select 1 from public.units where title_vi in ('Con vật', 'Màu sắc')) then
    raise notice 'Đã có dữ liệu mẫu, bỏ qua.';
    return;
  end if;

  insert into public.units (title_vi, emoji, sort_order, status) values ('Con vật', '🐾', 1, 'approved') returning id into u1;
  insert into public.units (title_vi, emoji, sort_order, status) values ('Màu sắc', '🎨', 2, 'approved') returning id into u2;

  insert into public.lessons (unit_id, title_vi, sort_order, status) values (u1, 'Con vật quanh nhà', 1, 'approved') returning id into l1;
  perform pg_temp.add_item(l1, 1, 'con chó',  '🐶', 'Hund',    'dog');
  perform pg_temp.add_item(l1, 2, 'con mèo',  '🐱', 'Katze',   'cat');
  perform pg_temp.add_item(l1, 3, 'con gà',   '🐔', 'Huhn',    'chicken');
  perform pg_temp.add_item(l1, 4, 'con vịt',  '🦆', 'Ente',    'duck');
  perform pg_temp.add_item(l1, 5, 'con heo',  '🐷', 'Schwein', 'pig');
  perform pg_temp.add_item(l1, 6, 'con bò',   '🐮', 'Kuh',     'cow');
  perform pg_temp.add_item(l1, 7, 'con cá',   '🐟', 'Fisch',   'fish');
  perform pg_temp.add_activities(l1);

  insert into public.lessons (unit_id, title_vi, sort_order, status) values (u1, 'Con vật ở sở thú', 2, 'approved') returning id into l2;
  perform pg_temp.add_item(l2, 1, 'con voi',   '🐘', 'Elefant', 'elephant');
  perform pg_temp.add_item(l2, 2, 'con hổ',    '🐯', 'Tiger',   'tiger');
  perform pg_temp.add_item(l2, 3, 'con khỉ',   '🐵', 'Affe',    'monkey');
  perform pg_temp.add_item(l2, 4, 'con gấu',   '🐻', 'Bär',     'bear');
  perform pg_temp.add_item(l2, 5, 'con thỏ',   '🐰', 'Hase',    'rabbit');
  perform pg_temp.add_item(l2, 6, 'con hươu',  '🦌', 'Hirsch',  'deer');
  perform pg_temp.add_activities(l2);

  insert into public.lessons (unit_id, title_vi, sort_order, status) values (u2, 'Các màu cơ bản', 1, 'approved') returning id into l3;
  perform pg_temp.add_item(l3, 1, 'màu đỏ',         '🔴', 'rot',     'red');
  perform pg_temp.add_item(l3, 2, 'màu xanh dương', '🔵', 'blau',    'blue');
  perform pg_temp.add_item(l3, 3, 'màu xanh lá',    '🟢', 'grün',    'green');
  perform pg_temp.add_item(l3, 4, 'màu vàng',       '🟡', 'gelb',    'yellow');
  perform pg_temp.add_item(l3, 5, 'màu cam',        '🟠', 'orange',  'orange');
  perform pg_temp.add_item(l3, 6, 'màu tím',        '🟣', 'lila',    'purple');
  perform pg_temp.add_item(l3, 7, 'màu đen',        '⚫', 'schwarz', 'black');
  perform pg_temp.add_item(l3, 8, 'màu trắng',      '⚪', 'weiß',    'white');
  perform pg_temp.add_activities(l3);
end $$;
