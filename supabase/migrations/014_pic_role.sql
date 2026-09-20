-- 014_pic_role.sql — vai trò của hình trong mục: 'literal' (hình ĐÚNG NGHĨA, được dùng để chọn/ghép/đoán) hay 'decor' (chỉ trang trí).
-- null = literal (mặc định, tương thích dữ liệu cũ). Hoạt động chọn/ghép theo hình chỉ dùng mục literal. Chạy TAY trong SQL Editor (sau 001–013). Chạy lại nhiều lần không hại.
alter table public.content_items add column if not exists pic text;
alter table public.content_items drop constraint if exists content_items_pic_check;
alter table public.content_items add constraint content_items_pic_check check (pic is null or pic in ('literal', 'decor'));
