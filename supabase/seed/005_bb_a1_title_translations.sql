-- 005_bb_a1_title_translations.sql — tên dịch (Deutsch + English) cho 2 chủ đề "Chào hỏi"/"Gia đình" (cấp A1) của
-- giáo trình "Tiếng Việt Bài Bản". Cần migration 025 (cột bb_units.title_tr).
--
-- CHỈ CẦN CHẠY FILE NÀY NẾU BẠN ĐÃ NHẬP CSV `giao-trinh/bai-ban/bai-ban-a1-chao-hoi-gia-dinh.csv` VÀO SUPABASE
-- TRƯỚC KHI CÓ MIGRATION 025 (tức trước 2026-09-28) — khi đó 2 chủ đề trên (và 6 bài của chúng) đã được tạo mà
-- KHÔNG có tên dịch, và CSV nhập lại từ giờ về sau chỉ điền title_tr lúc TẠO MỚI chủ đề/bài, không cập nhật chủ
-- đề/bài đã có sẵn (xem admin/bb-csv.js) — nên phải bù bằng UPDATE riêng ở đây, không nhập lại CSV.
-- Nếu bạn CHƯA từng nhập CSV này (dựng bản hoàn toàn mới), bỏ qua file này — CSV hiện tại đã có sẵn cột
-- unit_de/unit_en/lesson_de/lesson_en, tự đủ tên dịch ngay lúc nhập.
--
-- Chạy TAY trong SQL Editor (Supabase), sau migration 025. Chạy lại nhiều lần không hại: CHỈ BỔ SUNG — ngôn ngữ
-- nào chủ đề/bài đã có tên dịch (kể cả tự sửa tay qua ✎ Sửa) thì được GIỮ NGUYÊN, không bị ghi đè (`v.tr || …`).
-- Khớp theo mã cấp + tên chủ đề tiếng Việt (chủ đề) hoặc mã cấp + tên chủ đề + tên bài (bài); chủ đề/bài nào không
-- có trong CSDL thì UPDATE đó tự bỏ qua (không lỗi).
-- Bản dịch do AI soạn — nên đọc lại. Nếu bản triển khai dùng ngôn ngữ khác (biến LANGUAGES), thêm khoá ngôn ngữ đó
-- vào các dòng bên dưới.

begin;

-- ---- CHỦ ĐỀ (bb_units) ----
update public.bb_units u set title_tr = v.tr || u.title_tr
from (values
  ('A1', 'Chào hỏi', '{"de": "Begrüßung", "en": "Greetings"}'::jsonb),
  ('A1', 'Gia đình', '{"de": "Familie", "en": "Family"}'::jsonb)
) as v(level_code, title_vi, tr)
join public.bb_levels lv on lv.code = v.level_code
where u.level_id = lv.id and u.title_vi = v.title_vi;

-- ---- BÀI (bb_lessons) ----
update public.bb_lessons l set title_tr = v.tr || l.title_tr
from (values
  ('A1', 'Chào hỏi', 'Bài 1: Xin chào', '{"de": "Lektion 1: Hallo", "en": "Lesson 1: Hello"}'::jsonb),
  ('A1', 'Chào hỏi', 'Bài 2: Bạn tên gì?', '{"de": "Lektion 2: Wie heißt du?", "en": "Lesson 2: What''s Your Name?"}'::jsonb),
  ('A1', 'Chào hỏi', 'Bài 3: Ôn tập', '{"de": "Lektion 3: Wiederholung", "en": "Lesson 3: Review"}'::jsonb),
  ('A1', 'Gia đình', 'Bài 1: Gia đình tôi', '{"de": "Lektion 1: Meine Familie", "en": "Lesson 1: My Family"}'::jsonb),
  ('A1', 'Gia đình', 'Bài 2: Gia đình bạn có mấy người?', '{"de": "Lektion 2: Wie viele Personen sind in deiner Familie?", "en": "Lesson 2: How Many People Are in Your Family?"}'::jsonb),
  ('A1', 'Gia đình', 'Bài 3: Ôn tập', '{"de": "Lektion 3: Wiederholung", "en": "Lesson 3: Review"}'::jsonb)
) as v(level_code, unit_title, title_vi, tr)
join public.bb_levels lv on lv.code = v.level_code
join public.bb_units u on u.level_id = lv.id and u.title_vi = v.unit_title
where l.unit_id = u.id and l.title_vi = v.title_vi;

commit;
