-- Phụ huynh tự HUỶ yêu cầu của mình khi còn "pending" (đang chờ admin xác nhận). Policy payments chỉ cho admin UPDATE nên
-- đi qua hàm security definer này: chỉ đổi pending -> cancelled, chỉ giao dịch CỦA CHÍNH MÌNH; đã chốt (confirmed/cancelled) thì báo lỗi
-- (trigger payments_before_update cũng chặn sửa giao dịch đã chốt). Chạy lại nhiều lần không sao.
create or replace function public.cancel_my_payment(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.payments set status = 'cancelled'
   where id = p_id and account_id = auth.uid() and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Không huỷ được: yêu cầu không tồn tại hoặc đã được xử lý';
  end if;
end $$;
revoke all on function public.cancel_my_payment(bigint) from public;
grant execute on function public.cancel_my_payment(bigint) to authenticated;

-- Báo PostgREST nạp lại schema ngay (không thì hàm mới có thể báo "not found in the schema cache" tới khi cache tự làm mới).
notify pgrst, 'reload schema';
