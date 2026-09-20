-- 002_emoji.sql — thêm cột emoji làm "hình" nhẹ cho chủ đề và mục học.
-- Dùng khi chưa có ảnh thật (admin/AI soạn nội dung chỉ cần gợi ý 1 emoji); có image_path thì ưu tiên ảnh.
-- Chạy TAY trong SQL Editor (sau 001_init.sql). Chạy lại nhiều lần không hại.
alter table public.units add column if not exists emoji text;
alter table public.content_items add column if not exists emoji text;
