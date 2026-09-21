-- 015_title_tr.sql — tên chủ đề/bài bằng ngôn ngữ gốc, để khu bé có nút 🔊 đọc tên (Tiếng Việt + ngôn ngữ phụ huynh chọn).
-- title_tr = {"de": "Begrüßung", "en": "Greetings"}; trống = chưa có bản dịch (bé chỉ thấy nút tiếng Việt). Chạy TAY trong SQL Editor (sau 001–014). Chạy lại nhiều lần không hại.
alter table public.units add column if not exists title_tr jsonb not null default '{}'::jsonb;
alter table public.lessons add column if not exists title_tr jsonb not null default '{}'::jsonb;
alter table public.units drop constraint if exists units_title_tr_check;
alter table public.units add constraint units_title_tr_check check (jsonb_typeof(title_tr) = 'object');
alter table public.lessons drop constraint if exists lessons_title_tr_check;
alter table public.lessons add constraint lessons_title_tr_check check (jsonb_typeof(title_tr) = 'object');
