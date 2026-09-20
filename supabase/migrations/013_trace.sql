-- 013_trace.sql — hoạt động "tô chữ" (trace). Chạy TAY trong SQL Editor (sau 001–012). Chạy lại nhiều lần không hại.
alter table public.activities drop constraint if exists activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (kind in ('listen_pick', 'listen_repeat', 'match', 'sort', 'listen_pick_text',
                  'listen_pick_tone', 'build_syllable', 'fill_letter', 'read_pick', 'order_words',
                  'read_quiz', 'fill_word', 'write_check', 'spell_word', 'order_story',
                  'spell_along', 'match_case', 'pick_case', 'fix_capital', 'trace'));
