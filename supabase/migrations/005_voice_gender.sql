-- 005_voice_gender.sql — giọng NỮ / NAM cho âm thanh; bé (hoặc phụ huynh) chọn giọng nghe.
-- Chạy TAY trong SQL Editor (sau 001–004). Chạy lại nhiều lần không hại.

-- 1) Âm thanh: giới của giọng (null = chưa rõ, vd file người thật chưa đánh dấu).
alter table public.content_audio
  add column if not exists gender text check (gender in ('female', 'male'));

-- Các file TTS đã sinh trước đây: suy ra giới từ tên giọng (mặc định là nữ vì giọng mặc định trước giờ đều là nữ).
update public.content_audio
   set gender = case
     when voice_name ~* '(NamMinh|InJoon|Keita|Conrad|Guy|Davis|Henri|Alvaro|Diego|Yunxi|Antonio|Maarten|Marek|Dmitry|Niwat|Antonin|Wavenet-B|Neural2-A)'
       then 'male' else 'female' end
 where gender is null and source = 'tts';

-- 2) Hồ sơ con: giọng bé chọn (null = theo mặc định của phụ huynh: accounts.voice_pref.gender, rồi đến nữ).
alter table public.child_profiles
  add column if not exists voice_gender text check (voice_gender in ('female', 'male'));

-- 3) Cài đặt giọng TTS: đổi từ {"vi":"tên-giọng"} sang {"vi":{"female":"tên-giọng"}} (giá trị chuỗi cũ = giọng nữ).
update public.settings
   set tts_voices = (
     select coalesce(jsonb_object_agg(k, case when jsonb_typeof(v) = 'string' then jsonb_build_object('female', v) else v end), '{}'::jsonb)
       from jsonb_each(tts_voices) as t(k, v))
 where id = 1;
