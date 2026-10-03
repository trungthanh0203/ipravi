-- Đăng ký "làm phụ huynh" (tick ở form đăng ký): accounts.parent_signup đánh dấu tài khoản đăng ký với tư cách phụ
-- huynh của 1 học sinh. role vẫn 'parent' như cũ (không đổi phân quyền). Admin thấy danh sách "phụ huynh đăng ký
-- chưa gán con" ở tab Phụ huynh rồi gán 1 hồ sơ học sinh cho họ bằng cách đổi child_profiles.parent_id (admin đã có
-- quyền sửa qua child_profiles_all, trigger child_profiles_limit chỉ chạy lúc INSERT nên không chặn).
alter table public.accounts add column if not exists parent_signup boolean not null default false;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lang text;
  days int;
begin
  lang := coalesce(new.raw_user_meta_data ->> 'content_language', 'de');
  if lang !~ '^[a-z]{2}$' then lang := 'de'; end if;
  select trial_days into days from public.settings where id = 1;
  insert into public.accounts (id, email, content_language, access_status, access_until, parent_signup)
  values (new.id, new.email, lang, 'trial', now() + make_interval(days => coalesce(days, 7)),
          coalesce(new.raw_user_meta_data ->> 'parent_signup', '') = 'true');
  return new;
end $$;

-- Thêm cột parent_signup vào tổng quan phụ huynh (đổi kiểu trả về nên phải drop rồi tạo lại).
drop function if exists public.admin_parent_overview();
create or replace function public.admin_parent_overview()
returns table (
  id uuid,
  email text,
  content_language text,
  access_status text,
  access_until timestamptz,
  child_slots int,
  children int,
  words_learned bigint,
  last_activity timestamptz,
  paid_count bigint,
  created_at timestamptz,
  parent_signup boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được xem';
  end if;
  return query
  select
    a.id, a.email, a.content_language, a.access_status, a.access_until, a.child_slots,
    (select count(*)::int from public.child_profiles c where c.parent_id = a.id),
    (select count(*) from public.child_progress p join public.child_profiles c on c.id = p.child_id
      where c.parent_id = a.id and p.mastery >= 3),
    (select max(l.created_at) from public.activity_log l join public.child_profiles c on c.id = l.child_id
      where c.parent_id = a.id),
    (select count(*) from public.payments pm where pm.account_id = a.id and pm.status = 'confirmed'),
    a.created_at,
    a.parent_signup
  from public.accounts a
  where a.role = 'parent'
  order by a.created_at desc;
end $$;
