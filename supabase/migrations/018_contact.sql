-- 018_contact.sql — thêm số điện thoại + địa chỉ (không bắt buộc) cho tài khoản phụ huynh.
-- Hỏi lúc đặt PIN (setup-pin.js), sửa lại được sau ở khu phụ huynh (Cài đặt). Không cần sửa trigger
-- accounts_guard (001_init.sql): trigger chỉ chặn id/role/access_status/access_until/child_slots,
-- 2 cột mới phụ huynh tự sửa được qua policy accounts_update đã có sẵn. Chạy TAY (sau 001–017). Chạy lại nhiều lần không hại.
alter table public.accounts add column if not exists phone text;
alter table public.accounts add column if not exists address text;
