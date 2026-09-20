-- 008_phonics.sql — hỗ trợ Cấp 3 (học vần): kiểu mục letter/syllable, chữ đọc riêng (say_vi), 5 hoạt động mới.
-- Chạy TAY trong SQL Editor (sau 001–007). Chạy lại nhiều lần không hại.

-- 1) Kiểu mục: thêm 'letter' (chữ cái) và 'syllable' (tiếng/vần)
alter table public.content_items drop constraint if exists content_items_item_type_check;
alter table public.content_items add constraint content_items_item_type_check
  check (item_type in ('word', 'phrase', 'sentence', 'story', 'song', 'letter', 'syllable'));

-- 2) Chữ để ĐỌC thành tiếng khi khác chữ hiển thị (vd chữ "b" đọc là "bờ"). Null = đọc đúng text_vi.
alter table public.content_items add column if not exists say_vi text;

-- 3) Hoạt động mới: nghe–chọn thanh, ghép âm+vần, điền chữ còn thiếu, đọc–chọn hình, sắp xếp từ thành câu
alter table public.activities drop constraint if exists activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (kind in ('listen_pick', 'listen_repeat', 'match', 'sort', 'listen_pick_text',
                  'listen_pick_tone', 'build_syllable', 'fill_letter', 'read_pick', 'order_words'));
