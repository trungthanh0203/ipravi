-- ============================================================================
-- 001_init.sql — Schema khởi tạo "Tôi luyện tiếng Việt" (1 CSDL = 1 trung tâm/admin)
-- Chạy TAY trong Supabase SQL Editor, 1 lần cho mỗi dự án Supabase mới.
-- BẢN NHÁP — chưa chạy thật, cần soát trước khi chạy.
--
-- Sau khi chạy: đăng ký 1 tài khoản qua app, rồi biến nó thành admin (SQL Editor chạy
-- với quyền postgres nên qua được trigger bảo vệ):
--   update public.accounts set role = 'admin' where email = 'email-admin@example.com';
--
-- Ghi chú thiết kế:
--  * Trẻ KHÔNG đăng nhập; app chạy bằng phiên của phụ huynh → mọi bảng của trẻ phân quyền
--    qua parent_id = auth.uid().
--  * "Hết hạn = khoá hết": nội dung học chỉ đọc được khi has_access(); ghi tiến độ cũng vậy.
--    Đọc lại dữ liệu của con (xuất/xoá) KHÔNG bị chặn khi hết hạn (quyền GDPR).
--  * Không có bảng sessions riêng — thời gian học nằm ở activity_log.duration_seconds.
--  * Cột id dạng identity dùng "BY DEFAULT" (cho phép nhập lại CSV/upsert sau này).
-- ============================================================================

-- ---------- settings (đúng 1 dòng) ------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  center_name text not null default 'Tôi luyện tiếng Việt',
  payment_instructions text not null default '',
  extra_child_percent numeric(5,2) not null default 20 check (extra_child_percent >= 0),
  max_children int not null default 6 check (max_children between 1 and 20),
  trial_days int not null default 7 check (trial_days >= 0),
  currency text not null default 'EUR',
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------- accounts (phụ huynh / admin / giáo viên hỗ trợ) ------------------
create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'parent' check (role in ('parent', 'admin', 'teacher')),
  content_language text not null default 'de' check (content_language ~ '^[a-z]{2}$'),
  pin_hash text,
  pin_salt text,
  access_status text not null default 'trial' check (access_status in ('trial', 'active', 'suspended')),
  access_until timestamptz not null default now(),
  child_slots int not null default 1 check (child_slots >= 1),
  pronunciation_enabled boolean not null default false,
  voice_pref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- hàm phân quyền dùng chung ---------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.accounts where id = auth.uid() and role = 'admin');
$$;

-- Còn hạn dùng (admin/giáo viên luôn có quyền). Hết hạn hoặc bị khoá = false.
create or replace function public.has_access()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.accounts
    where id = auth.uid()
      and (role in ('admin', 'teacher')
           or (access_status <> 'suspended' and access_until > now()))
  );
$$;

-- ---------- tự tạo accounts khi có người đăng ký (dùng thử) ------------------
-- Vai trò LUÔN là 'parent' — không đọc từ metadata do client gửi (tránh tự phong admin).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lang text;
  days int;
begin
  lang := coalesce(new.raw_user_meta_data ->> 'content_language', 'de');
  if lang !~ '^[a-z]{2}$' then lang := 'de'; end if;
  select trial_days into days from public.settings where id = 1;
  insert into public.accounts (id, email, content_language, access_status, access_until)
  values (new.id, new.email, lang, 'trial', now() + make_interval(days => coalesce(days, 7)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- chặn phụ huynh tự sửa các cột đặc quyền --------------------------
-- Cho qua khi: admin, chạy từ SQL Editor/service role (auth.uid() null), hoặc bị gọi từ
-- trigger khác (pg_trigger_depth() > 1, vd trigger xác nhận thanh toán).
create or replace function public.accounts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.access_status is distinct from old.access_status
     or new.access_until is distinct from old.access_until
     or new.child_slots is distinct from old.child_slots then
    raise exception 'Không được sửa các trường quản trị của tài khoản';
  end if;
  return new;
end $$;

create trigger accounts_guard_trg
  before update on public.accounts
  for each row execute function public.accounts_guard();

-- ---------- mức học phí -------------------------------------------------------
create table public.tuition_plans (
  id bigint generated by default as identity primary key,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'EUR',
  duration_days int not null check (duration_days > 0),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- giao dịch học phí / phí thêm con ----------------------------------
create table public.payments (
  id bigint generated by default as identity primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null check (kind in ('tuition', 'extra_child')),
  plan_id bigint references public.tuition_plans (id),
  amount numeric(10,2) check (amount is null or amount >= 0),
  currency text,
  duration_days int,                              -- chụp lại từ mức học phí (kind = tuition)
  extra_children int not null default 0 check (extra_children >= 0), -- kind = extra_child
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.accounts (id),
  constraint payments_kind_shape check (
    (kind = 'tuition' and plan_id is not null)
    or (kind = 'extra_child' and extra_children >= 1)
  )
);
create index payments_account_idx on public.payments (account_id, created_at desc);

-- Trước khi thêm: phụ huynh chỉ tạo được giao dịch 'pending' của chính mình; giá/thời gian
-- của học phí LUÔN lấy từ mức học phí (phụ huynh không tự đặt giá).
create or replace function public.payments_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p record;
  s record;
begin
  select * into s from public.settings where id = 1;
  if auth.uid() is not null and not public.is_admin() then
    new.account_id := auth.uid();
    new.status := 'pending';
    new.confirmed_at := null;
    new.confirmed_by := null;
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

create trigger payments_before_insert_trg
  before insert on public.payments
  for each row execute function public.payments_before_insert();

-- Khi admin xác nhận (pending -> confirmed): tự gia hạn / tăng số con.
-- Giao dịch đã xác nhận/huỷ thì không sửa được nữa.
create or replace function public.payments_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mx int;
  slots int;
begin
  if old.status <> 'pending' then
    raise exception 'Giao dịch đã chốt, không sửa được';
  end if;
  if new.status = 'confirmed' then
    if new.amount is null then
      raise exception 'Cần nhập số tiền trước khi xác nhận';
    end if;
    new.confirmed_at := now();
    new.confirmed_by := auth.uid();
    if new.kind = 'tuition' then
      update public.accounts
         set access_until = greatest(now(), access_until) + make_interval(days => new.duration_days),
             access_status = case when access_status = 'suspended' then 'suspended' else 'active' end
       where id = new.account_id;
    else
      select max_children into mx from public.settings where id = 1;
      select child_slots into slots from public.accounts where id = new.account_id for update;
      if slots + new.extra_children > mx then
        raise exception 'Vượt trần % con mỗi tài khoản', mx;
      end if;
      update public.accounts set child_slots = slots + new.extra_children where id = new.account_id;
    end if;
  end if;
  return new;
end $$;

create trigger payments_before_update_trg
  before update on public.payments
  for each row execute function public.payments_before_update();

-- ---------- hồ sơ con ---------------------------------------------------------
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.accounts (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  avatar_id text not null,
  birth_year smallint check (birth_year between 2000 and 2100),
  level smallint,
  daily_limit_minutes int check (daily_limit_minutes between 5 and 240),
  created_at timestamptz not null default now(),
  unique (parent_id, avatar_id)
);

-- Số hồ sơ con không vượt child_slots (RLS không tự đếm số lượng nên phải dùng trigger).
create or replace function public.child_profiles_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  slots int;
  cnt int;
begin
  select child_slots into slots from public.accounts where id = new.parent_id for update;
  select count(*) into cnt from public.child_profiles where parent_id = new.parent_id;
  if cnt >= slots then
    raise exception 'Đã đủ số con được cấp (%). Liên hệ admin để thêm.', slots;
  end if;
  return new;
end $$;

create trigger child_profiles_limit_trg
  before insert on public.child_profiles
  for each row execute function public.child_profiles_limit();

-- ---------- nội dung học ------------------------------------------------------
create table public.units (
  id bigint generated by default as identity primary key,
  title_vi text not null,
  image_path text,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now()
);

create table public.lessons (
  id bigint generated by default as identity primary key,
  unit_id bigint not null references public.units (id) on delete cascade,
  title_vi text not null,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now()
);
create index lessons_unit_idx on public.lessons (unit_id);

create table public.content_items (
  id bigint generated by default as identity primary key,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  item_type text not null default 'word' check (item_type in ('word', 'phrase', 'sentence', 'story', 'song')),
  text_vi text not null,
  image_path text,
  min_age smallint,
  max_age smallint,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now()
);
create index content_items_lesson_idx on public.content_items (lesson_id);

create table public.translations (
  id bigint generated by default as identity primary key,
  item_id bigint not null references public.content_items (id) on delete cascade,
  lang text not null check (lang ~ '^[a-z]{2}$'),
  meaning text not null,
  example text,
  unique (item_id, lang)
);

-- Âm thanh: chừa sẵn chỗ cho giọng người thật / trẻ em / người lớn / vùng miền.
create table public.content_audio (
  id bigint generated by default as identity primary key,
  item_id bigint not null references public.content_items (id) on delete cascade,
  lang text not null check (lang ~ '^[a-z]{2}$'),          -- 'vi' hoặc ngôn ngữ của bản dịch
  source text not null default 'tts' check (source in ('tts', 'human')),
  voice_kind text not null default 'adult' check (voice_kind in ('adult', 'child')),
  region text check (region in ('bac', 'nam', 'trung')),   -- chỉ với tiếng Việt
  speed text not null default 'normal' check (speed in ('normal', 'slow')),
  provider text,
  voice_name text,
  file_path text not null,                                 -- đường dẫn trong bucket 'content'
  created_at timestamptz not null default now()
);
create index content_audio_item_idx on public.content_audio (item_id, lang);

create table public.activities (
  id bigint generated by default as identity primary key,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  kind text not null check (kind in ('listen_pick', 'listen_repeat', 'match', 'sort', 'listen_pick_text')),
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now()
);
create index activities_lesson_idx on public.activities (lesson_id);

-- ---------- tiến độ của trẻ ---------------------------------------------------
create table public.child_progress (
  id bigint generated by default as identity primary key,
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  item_id bigint not null references public.content_items (id) on delete cascade,
  mastery smallint not null default 0 check (mastery between 0 and 5),
  correct_count int not null default 0,
  wrong_count int not null default 0,
  last_seen_at timestamptz not null default now(),
  unique (child_id, item_id)
);

create table public.activity_log (
  id bigint generated by default as identity primary key,
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  activity_id bigint references public.activities (id) on delete set null,
  lesson_id bigint references public.lessons (id) on delete set null,
  kind text,
  score numeric(5,2),
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);
create index activity_log_child_idx on public.activity_log (child_id, created_at desc);

-- Không lưu file ghi âm — chỉ lưu điểm + chữ nhận dạng được.
create table public.pronunciation_attempts (
  id bigint generated by default as identity primary key,
  child_id uuid not null references public.child_profiles (id) on delete cascade,
  item_id bigint not null references public.content_items (id) on delete cascade,
  score smallint check (score between 0 and 100),
  transcript text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index pronunciation_attempts_child_idx on public.pronunciation_attempts (child_id, created_at desc);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.settings enable row level security;
alter table public.accounts enable row level security;
alter table public.tuition_plans enable row level security;
alter table public.payments enable row level security;
alter table public.child_profiles enable row level security;
alter table public.translations enable row level security;
alter table public.content_audio enable row level security;
alter table public.child_progress enable row level security;
alter table public.activity_log enable row level security;
alter table public.pronunciation_attempts enable row level security;

-- settings
create policy settings_read on public.settings for select to authenticated using (true);
create policy settings_admin_write on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- accounts: xem/sửa hàng của mình (cột đặc quyền đã có trigger chặn); admin xem/sửa tất cả.
create policy accounts_read on public.accounts for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy accounts_update on public.accounts for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- tuition_plans: ai đăng nhập cũng xem được mức đang bán (cần cả khi hết hạn để gia hạn).
create policy tuition_plans_read on public.tuition_plans for select to authenticated
  using (active or public.is_admin());
create policy tuition_plans_admin_write on public.tuition_plans for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- payments: phụ huynh xem + tạo (pending) của mình; chỉ admin sửa/xác nhận.
create policy payments_read on public.payments for select to authenticated
  using (account_id = auth.uid() or public.is_admin());
create policy payments_insert on public.payments for insert to authenticated
  with check (account_id = auth.uid() or public.is_admin());
create policy payments_admin_update on public.payments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- child_profiles: chủ tài khoản hoặc admin.
create policy child_profiles_all on public.child_profiles for all to authenticated
  using (parent_id = auth.uid() or public.is_admin())
  with check (parent_id = auth.uid() or public.is_admin());

-- Nội dung học: admin xem/sửa hết; người dùng chỉ đọc mục 'approved' khi còn hạn dùng.
do $$
declare t text;
begin
  foreach t in array array['units', 'lessons', 'content_items', 'activities'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin() or (status = ''approved'' and public.has_access()))',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_write', t);
  end loop;
end $$;

-- translations / content_audio: đọc được khi còn hạn và mục cha đọc được (RLS của content_items tự lọc).
do $$
declare t text;
begin
  foreach t in array array['translations', 'content_audio'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin() or (public.has_access() and exists (select 1 from public.content_items i where i.id = item_id)))',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_write', t);
  end loop;
end $$;

-- Dữ liệu của trẻ: đọc luôn được (xuất/xoá dữ liệu); GHI chỉ khi còn hạn (hoặc admin).
do $$
declare t text;
begin
  foreach t in array array['child_progress', 'activity_log', 'pronunciation_attempts'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin() or exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid()))',
      t || '_read', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_admin() or (public.has_access() and exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_admin() or (public.has_access() and exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid()))) with check (public.is_admin() or (public.has_access() and exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid())))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin() or exists (select 1 from public.child_profiles c where c.id = child_id and c.parent_id = auth.uid()))',
      t || '_delete', t);
  end loop;
end $$;

-- ---------- Storage: hình + âm thanh nội dung ---------------------------------
-- Bucket công khai (đọc bằng URL công khai, dễ cache cho PWA); chỉ admin được ghi.
insert into storage.buckets (id, name, public) values ('content', 'content', true)
  on conflict (id) do nothing;

create policy content_bucket_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'content' and public.is_admin())
  with check (bucket_id = 'content' and public.is_admin());
