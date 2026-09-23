-- 021_unit_description.sql — nội dung diễn giải của CHỦ ĐỀ (giải thích ngắn chủ đề dạy gì), hiện ngay dưới tên chủ đề
-- ở màn danh sách bài của chủ đề đó (child/pages/child-home.js, hàm showLessons). Tuỳ chọn — chủ đề chưa có thì không
-- hiện dòng này, không lỗi. Cùng kiểu với lessons.description (migration 020) nhưng cho units.
-- Nội dung cho giáo trình hiện có: chạy supabase/seed/004_unit_descriptions.sql sau migration này.
-- Chạy TAY trong SQL Editor (sau 001–020). Chạy lại nhiều lần không hại.
alter table public.units add column if not exists description text;
