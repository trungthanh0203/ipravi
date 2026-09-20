-- 011_spell_along.sql — hoạt động "đánh vần theo phần" (spell_along). Chạy TAY trong SQL Editor (sau 001–010). Chạy lại nhiều lần không hại.
alter table public.activities drop constraint if exists activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (kind in ('listen_pick', 'listen_repeat', 'match', 'sort', 'listen_pick_text',
                  'listen_pick_tone', 'build_syllable', 'fill_letter', 'read_pick', 'order_words',
                  'read_quiz', 'fill_word', 'write_check', 'spell_word', 'order_story',
                  'spell_along'));
