-- 020_lesson_description.sql — nội dung diễn giải của bài (giải thích ngắn các thành phần trong bài), hiện NGAY DƯỚI tên bài
-- ở màn "Bắt đầu" trước khi bé vào học (child/lesson.js). Tuỳ chọn — bài chưa có thì không hiện dòng này, không lỗi.
-- Nội dung cho giáo trình hiện có: chạy supabase/seed/003_lesson_descriptions.sql sau migration này.
-- Chạy TAY trong SQL Editor (sau 001–019). Chạy lại nhiều lần không hại.
alter table public.lessons add column if not exists description text;
