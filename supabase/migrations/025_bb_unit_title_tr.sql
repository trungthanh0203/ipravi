-- "Tiếng Việt Bài Bản": bb_units thiếu title_tr (tên dịch theo ngôn ngữ ở nhà) — bb_lessons đã có title_tr từ
-- migration 022 nhưng bb_units thì không, khác khu trẻ em (units.title_tr có từ migration 015) — chủ dự án phát
-- hiện lúc dùng thử, xem KE_HOACH_TIENG_VIET_BAI_BAN.md mục 20.
alter table public.bb_units add column if not exists title_tr jsonb not null default '{}'::jsonb;
