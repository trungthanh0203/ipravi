-- 019_dialogue.sql — hoạt động "bài giao tiếp" (dialogue): nhiều lượt hỏi-đáp nối tiếp trong 1 bài, hệ thống nói rồi bé
-- đọc câu trả lời có sẵn (chấm phát âm như listen_repeat). Vai trò dòng KHÔNG lưu ở cột riêng — quy ước theo VỊ TRÍ trong
-- bài (item.sort_order): dòng lẻ (1,3,5…) = hệ thống nói, dòng chẵn (2,4,6…) = bé đọc (xem public/js/child/activities/dialogue.js).
-- Chỉ đăng ký thêm 1 loại hoạt động (giống các migration 008/009/011/012/013 trước đó) — không đổi cấu trúc content_items.
-- Chạy TAY trong SQL Editor (sau 001–018). Chạy lại nhiều lần không hại.
alter table public.activities drop constraint if exists activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (kind in ('listen_pick', 'listen_repeat', 'match', 'sort', 'listen_pick_text',
                  'listen_pick_tone', 'build_syllable', 'fill_letter', 'read_pick', 'order_words',
                  'read_quiz', 'fill_word', 'write_check', 'spell_word', 'order_story',
                  'spell_along', 'match_case', 'pick_case', 'fix_capital', 'trace', 'dialogue'));
