-- 006_voice_repair_summary.sql — vá dữ liệu giọng bị gán SAI giới + hàm thống kê để admin tự kiểm tra.
-- Bối cảnh: bản trước coi mọi tên giọng dạng chuỗi là giọng NỮ, nên giọng nam (vd vi-VN-NamMinhNeural) bị đưa vào ô nữ và mọi file
-- "nữ" thực ra đọc bằng giọng nam. Migration này: (1) đưa tên giọng về đúng ô nam/nữ, (2) sửa nhãn giới của file âm thanh đã sinh theo TÊN giọng
-- thật đã dùng, (3) xoá bản trùng cùng 1 ô, (4) thêm RPC admin_audio_summary. Chạy TAY trong SQL Editor (sau 001–005). Chạy lại nhiều lần không hại.
-- LƯU Ý: file mp3 của các dòng bị xoá ở bước (3) vẫn còn trong Storage (vô hại, có thể xoá tay ở Storage → content → audio).
-- Sau khi chạy: vào app → tab Nội dung → "Sinh lại TTS bằng giọng hiện tại" cho từng bài để sinh đủ giọng nữ đúng.

-- 1) Cài đặt: giọng nam nhập nhầm ô nữ → chuyển sang ô nam (và ngược lại)
update public.settings
   set tts_voices = (
     select coalesce(jsonb_object_agg(k,
              case when jsonb_typeof(v) = 'object' and (v->>'female') ~* '(NamMinh|InJoon|Keita|Conrad|Guy|Davis|Henri|Alvaro|Diego|Yunxi|Antonio|Maarten|Marek|Dmitry|Niwat|Antonin|Wavenet-B|Neural2-A)'
                   then (v - 'female') || jsonb_build_object('male', coalesce(v->'male', v->'female'))
                   else v end), '{}'::jsonb)
       from jsonb_each(tts_voices) as t(k, v))
 where id = 1;

update public.settings
   set tts_voices = (
     select coalesce(jsonb_object_agg(k,
              case when jsonb_typeof(v) = 'object' and (v->>'male') ~* '(HoaiMy|Katja|Jenny|Ana|Aria|SunHi|Nanami|Denise|Elvira|Elsa|Xiaoxiao|Francisca|Colette|Zofia|Svetlana|Premwadee|Vlasta|Wavenet-A|Neural2-C)'
                   then (v - 'male') || jsonb_build_object('female', coalesce(v->'female', v->'male'))
                   else v end), '{}'::jsonb)
       from jsonb_each(tts_voices) as t(k, v))
 where id = 1;

-- 2) File TTS đã sinh: nhãn giới theo TÊN giọng thật đã dùng (chỉ đổi khi tên giọng thuộc danh sách đã biết)
update public.content_audio set gender = 'male'
 where source = 'tts' and gender is distinct from 'male'   and voice_name ~* '(NamMinh|InJoon|Keita|Conrad|Guy|Davis|Henri|Alvaro|Diego|Yunxi|Antonio|Maarten|Marek|Dmitry|Niwat|Antonin|Wavenet-B|Neural2-A)';
update public.content_audio set gender = 'female'
 where source = 'tts' and gender is distinct from 'female' and voice_name ~* '(HoaiMy|Katja|Jenny|Ana|Aria|SunHi|Nanami|Denise|Elvira|Elsa|Xiaoxiao|Francisca|Colette|Zofia|Svetlana|Premwadee|Vlasta|Wavenet-A|Neural2-C)' and voice_name !~* '(NamMinh|InJoon|Keita|Conrad|Guy|Davis|Henri|Alvaro|Diego|Yunxi|Antonio|Maarten|Marek|Dmitry|Niwat|Antonin|Wavenet-B|Neural2-A)';

-- 3) Sau khi đổi nhãn có thể có 2 file TTS cùng 1 ô (mục, ngôn ngữ, tốc độ, giới): giữ file mới nhất
delete from public.content_audio a
 using public.content_audio b
 where a.source = 'tts' and b.source = 'tts'
   and a.item_id = b.item_id and a.lang = b.lang and a.speed = b.speed
   and a.gender is not distinct from b.gender
   and a.id < b.id;

-- 4) Thống kê: mỗi (ngôn ngữ, giới, nguồn, tên giọng) có bao nhiêu file — để nhìn ra giọng gán sai. Chỉ admin gọi được.
create or replace function public.admin_audio_summary()
returns table (lang text, gender text, source text, voice_name text, files bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được xem';
  end if;
  return query
  select a.lang, a.gender, a.source, a.voice_name, count(*)
    from public.content_audio a
   group by a.lang, a.gender, a.source, a.voice_name
   order by a.lang, a.gender, a.source, a.voice_name;
end $$;
