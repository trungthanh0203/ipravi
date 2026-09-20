-- 012_case_activities.sql — hoạt động chữ hoa: ghép hoa–thường (match_case), chọn chữ tương ứng (pick_case), chạm từ cần viết hoa (fix_capital).
-- Chạy TAY trong SQL Editor (sau 001–011). Chạy lại nhiều lần không hại.
alter table public.activities drop constraint if exists activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (kind in ('listen_pick', 'listen_repeat', 'match', 'sort', 'listen_pick_text',
                  'listen_pick_tone', 'build_syllable', 'fill_letter', 'read_pick', 'order_words',
                  'read_quiz', 'fill_word', 'write_check', 'spell_word', 'order_story',
                  'spell_along', 'match_case', 'pick_case', 'fix_capital'));
