-- 004_tts_voices.sql — giọng đọc TTS do admin chọn trong tab Cài đặt (theo ngôn ngữ), vd {"vi":"vi-VN-NamMinhNeural"}.
-- Thứ tự ưu tiên khi sinh âm thanh: giọng admin chọn > biến TTS_VOICES của Worker > giọng mặc định trong tts.js.
-- Chạy TAY trong SQL Editor. Chạy lại nhiều lần không hại.
alter table public.settings
  add column if not exists tts_voices jsonb not null default '{}'::jsonb check (jsonb_typeof(tts_voices) = 'object');
