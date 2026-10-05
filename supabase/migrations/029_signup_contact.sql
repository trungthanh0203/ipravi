-- Điện thoại + địa chỉ nhập NGAY lúc đăng ký (form đăng ký gửi qua metadata signUp). handle_new_user chép vào accounts.phone/address
-- (cắt gọn, rỗng thì NULL) — cần làm ở trigger vì lúc đăng ký chưa có phiên (còn chờ xác nhận email) nên client chưa UPDATE accounts được.
-- Phụ huynh vẫn sửa lại được ở khu phụ huynh (contactCard). Chạy lại nhiều lần không sao.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lang text;
  days int;
  ph text;
  ad text;
begin
  lang := coalesce(new.raw_user_meta_data ->> 'content_language', 'de');
  if lang !~ '^[a-z]{2}$' then lang := 'de'; end if;
  ph := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 40), '');
  ad := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'address', '')), 300), '');
  select trial_days into days from public.settings where id = 1;
  insert into public.accounts (id, email, content_language, access_status, access_until, parent_signup, phone, address)
  values (new.id, new.email, lang, 'trial', now() + make_interval(days => coalesce(days, 7)),
          coalesce(new.raw_user_meta_data ->> 'parent_signup', '') = 'true', ph, ad);
  return new;
end $$;
