-- 003_admin_overview.sql — RPC cho dashboard admin: tổng quan phụ huynh + tiến độ các bé.
-- Dùng hàm tổng hợp (không tải cả child_progress về trình duyệt: PostgREST cắt âm thầm ở 1000 dòng).
-- Chỉ admin gọi được (kiểm ngay trong hàm). Chạy TAY trong SQL Editor.
create or replace function public.admin_parent_overview()
returns table (
  id uuid,
  email text,
  content_language text,
  access_status text,
  access_until timestamptz,
  child_slots int,
  children int,
  words_learned bigint,     -- số từ đạt mức thuộc >= 3 (cộng dồn các con)
  last_activity timestamptz,
  paid_count bigint,        -- số giao dịch đã xác nhận
  created_at timestamptz
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
    a.created_at
  from public.accounts a
  where a.role = 'parent'
  order by a.created_at desc;
end $$;

-- Vá: MỌI giao dịch mới (kể cả do admin tạo) luôn vào ở trạng thái 'pending'. Việc gia hạn / tăng số con chỉ
-- chạy khi cập nhật pending -> confirmed; nếu cho chèn thẳng 'confirmed' thì tiền được ghi nhận nhưng tài khoản
-- KHÔNG được gia hạn (lệch dữ liệu âm thầm). Giá + thời gian học phí vẫn luôn lấy từ mức học phí (phụ huynh)
-- hoặc do admin nhập (số tiền).
create or replace function public.payments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p record;
  s record;
begin
  select * into s from public.settings where id = 1;
  new.status := 'pending';
  new.confirmed_at := null;
  new.confirmed_by := null;
  if auth.uid() is not null and not public.is_admin() then
    new.account_id := auth.uid();
    new.amount := null;
  end if;
  if new.kind = 'tuition' then
    select * into p from public.tuition_plans where id = new.plan_id and active;
    if not found then raise exception 'Mức học phí không tồn tại hoặc đã ẩn'; end if;
    new.amount := coalesce(new.amount, p.price);
    new.currency := coalesce(new.currency, p.currency);
    new.duration_days := p.duration_days;
    new.extra_children := 0;
  else
    new.currency := coalesce(new.currency, s.currency);
    new.plan_id := null;
    new.duration_days := null;
  end if;
  return new;
end $$;
