-- "Tiếng Việt Bài Bản": 2 thay đổi nhỏ để làm chuyên đề "Bảng chữ cái, Ngữ âm & Thanh điệu căn bản" (tiền-A1, xem
-- KE_HOACH_TIENG_VIET_BAI_BAN.md mục 19).
-- 1) bb_levels.code nới thêm mã "A0" (ngoài mã CEFR chuẩn A1/A2/B1…) cho cấp tiền-A1 này — cấp CÓ SẴN trong CSDL
--    chạy migration này KHÔNG bị ảnh hưởng (chỉ nới điều kiện, không đổi giá trị cũ).
alter table public.bb_levels drop constraint if exists bb_levels_code_check;
alter table public.bb_levels add constraint bb_levels_code_check check (code = 'A0' or code ~ '^[ABC][12]$');

-- 2) bb_vocab.say_vi (tuỳ chọn) — CÙNG vai trò với content_items.say_vi bên khu trẻ em: chữ hiển thị khác chữ ĐỌC
--    thành tiếng (vd hiển thị "b" nhưng đọc "bờ") — cần cho TTS/thu âm đọc đúng tên chữ cái/phụ âm ghép. Mục khác
--    (từ vựng thường) để trống = đọc đúng chữ hiển thị.
alter table public.bb_vocab add column if not exists say_vi text;
