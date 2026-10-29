-- Pinya Printing · Thanh toán trước khi đặt: giữ mã đơn, kho ảnh chuyển khoản, hàm đặt hàng mới
-- Chạy một lần trong Supabase › SQL Editor (đã gộp vào schema.sql).

-- Mã đơn giữ trước để khách chuyển khoản trước khi đặt (nội dung chuyển khoản = mã đơn)
create table if not exists public.order_codes (
  code text primary key,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.order_codes enable row level security;

create or replace function public.reserve_order_code() returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  delete from public.order_codes where used_at is null and created_at < now() - interval '7 days';
  v_code := 'PP-' || to_char(timezone('Asia/Ho_Chi_Minh', now()), 'YYMM') || '-' || lpad(nextval('public.order_seq')::text, 4, '0');
  insert into public.order_codes (code) values (v_code);
  return v_code;
end $$;
revoke all on function public.reserve_order_code() from public;
grant execute on function public.reserve_order_code() to anon, authenticated;

-- Kho ảnh chuyển khoản: khách (không cần tài khoản) chỉ được tải lên, admin mới xem/xóa được
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pinya_insert_payment_proofs" on storage.objects;
create policy "pinya_insert_payment_proofs" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-proofs' and name like 'proofs/%');
drop policy if exists "pinya_admin_read_payment_proofs" on storage.objects;
create policy "pinya_admin_read_payment_proofs" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (select public.is_admin()));
drop policy if exists "pinya_admin_delete_payment_proofs" on storage.objects;
create policy "pinya_admin_delete_payment_proofs" on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs' and (select public.is_admin()));

-- Hàm đặt hàng: bắt buộc ảnh chuyển khoản, dùng mã đơn đã giữ, đơn vào trạng thái "Khách báo đã chuyển"
create or replace function public.submit_order(p_order jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_set jsonb; v_it jsonb; v_prod jsonb; v_var jsonb;
  v_items jsonb := '[]'::jsonb; v_sub bigint := 0; v_lead int := 0;
  v_qty int; v_min int; v_price bigint;
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_phone  text := public.norm_phone(p_order->>'phone');
  v_name   text := btrim(coalesce(p_order->>'name', ''));
  v_addr   text := btrim(coalesce(p_order->>'address', ''));
  v_social text := btrim(coalesce(p_order->>'social', ''));
  v_file   text := btrim(coalesce(p_order->>'file', ''));
  v_note   text := btrim(coalesce(p_order->>'note', ''));
  v_city   text := btrim(coalesce(p_order->>'city', ''));
  v_code   text := btrim(coalesce(p_order->>'code', ''));
  v_proof  text := btrim(coalesce(p_order->>'proof', ''));
  v_thr bigint; v_dep int; v_pay int; v_id text; v_cid text; v_order jsonb; v_first bigint;
begin
  if v_name = '' or length(v_name) > 200 then raise exception 'Nhập họ tên người nhận.'; end if;
  if length(v_phone) < 9 or length(v_phone) > 15 then raise exception 'Số điện thoại chưa đúng.'; end if;
  if v_addr = '' or length(v_addr) > 500 then raise exception 'Nhập địa chỉ nhận hàng.'; end if;
  if v_file !~* '^https?://\S+\.\S+' or length(v_file) > 1000 then raise exception 'Link file thiết kế chưa đúng.'; end if;
  if length(v_social) > 500 or length(v_note) > 2000 or length(v_city) > 100 then raise exception 'Nội dung nhập quá dài.'; end if;
  if jsonb_typeof(p_order->'items') is distinct from 'array' or jsonb_array_length(p_order->'items') not between 1 and 30 then
    raise exception 'Giỏ hàng trống.';
  end if;

  -- Ảnh chụp chuyển khoản là bắt buộc: phải có trong kho payment-proofs và chưa dùng cho đơn khác
  if v_proof !~ '^proofs/[A-Za-z0-9._-]{8,80}$'
     or not exists (select 1 from storage.objects where bucket_id = 'payment-proofs' and name = v_proof) then
    raise exception 'Tải lên ảnh chụp chuyển khoản trước khi đặt hàng.';
  end if;
  if exists (select 1 from public.records where kind = 'order' and data->>'proof' = v_proof) then
    raise exception 'Ảnh chuyển khoản này đã dùng cho đơn khác.';
  end if;

  select data into v_set from public.records where kind = 'settings' and id = 'main';
  if v_set is null then raise exception 'Shop chưa mở bán.'; end if;

  for v_it in select * from jsonb_array_elements(p_order->'items') loop
    select data into v_prod from public.records where kind = 'product' and id = v_it->>'productId';
    if v_prod is null or coalesce((v_prod->>'active')::boolean, false) is not true then
      raise exception 'Có sản phẩm không còn bán.';
    end if;
    select x into v_var from jsonb_array_elements(coalesce(v_prod->'variants', '[]'::jsonb)) x
      where x->>'id' = v_it->>'variantId' limit 1;
    if v_var is null then raise exception 'Có phân loại không còn bán.'; end if;
    v_min := greatest(1, coalesce(nullif(v_var->>'minQty', '')::int, 1));
    v_qty := greatest(v_min, coalesce(nullif(v_it->>'qty', '')::int, 0));
    if v_qty > 1000000 then raise exception 'Số lượng quá lớn.'; end if;
    v_price := (v_var->>'price')::bigint;
    v_sub := v_sub + v_price * v_qty;
    v_lead := greatest(v_lead, coalesce(nullif((v_prod->>'leadDays')::int, 0), 7));
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', v_it->>'productId', 'productName', v_prod->>'name', 'catId', v_prod->>'catId',
      'variantId', v_it->>'variantId', 'variantName', v_var->>'name', 'price', v_price, 'qty', v_qty));
  end loop;

  v_thr := coalesce(nullif(v_set->>'payThreshold', '')::bigint, 1000000);
  v_dep := case when v_sub < v_thr then coalesce(nullif(v_set->>'depositLow', '')::int, 50)
                else coalesce(nullif(v_set->>'depositHigh', '')::int, 70) end;
  v_pay := coalesce(nullif(p_order->>'payPct', '')::int, 100);
  if v_pay <> 100 and v_pay <> v_dep then v_pay := 100; end if;

  -- Dùng mã đơn đã giữ lúc khách chuyển khoản (nội dung chuyển khoản là mã này)
  if v_code <> '' then
    update public.order_codes set used_at = now() where code = v_code and used_at is null returning code into v_id;
  end if;
  if v_id is null then
    v_id := 'PP-' || to_char(timezone('Asia/Ho_Chi_Minh', now()), 'YYMM') || '-' || lpad(nextval('public.order_seq')::text, 4, '0');
  end if;
  v_first := round(v_sub * v_pay / 100.0);

  select id into v_cid from public.records where kind = 'customer' and phone = v_phone limit 1;
  if v_cid is null then
    v_cid := 'kh' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    insert into public.records (kind, id, data, phone) values ('customer', v_cid,
      jsonb_build_object('id', v_cid, 'name', v_name, 'phone', v_phone, 'email', '', 'company', '',
                         'address', v_addr, 'city', v_city, 'createdAt', v_now), v_phone);
  end if;

  v_order := jsonb_build_object(
    'id', v_id, 'customerId', v_cid, 'status', 'cho_coc', 'createdAt', v_now, 'updatedAt', v_now,
    'items', v_items, 'name', v_name, 'phone', v_phone, 'social', v_social, 'address', v_addr,
    'city', case when v_city = '' then 'Hà Nội' else v_city end,
    'file', v_file, 'note', v_note, 'payPct', v_pay, 'leadDays', v_lead,
    'extraFee', 0, 'extraNote', '', 'paid1', false, 'paid1Amount', null, 'balancePaid', false,
    'paidNotice', v_now, 'proof', v_proof, 'payRef', nullif(v_code, ''), 'produceStart', null, 'shipping', null, 'deliveredAt', null, 'factoryId', null,
    'cancelReason', '',
    'messages', jsonb_build_array(jsonb_build_object('at', v_now, 'from', 'customer',
      'text', 'Mình đã chuyển khoản ' || translate(to_char(v_first, 'FM999,999,999,999'), ',', '.') || ' ₫, nội dung ghi '
              || coalesce(nullif(v_code, ''), v_id) || '. Ảnh chụp chuyển khoản gửi kèm đơn.')),
    'history', jsonb_build_array(jsonb_build_object('at', v_now, 'by', 'customer',
      'text', 'Đặt hàng, chọn ' || case when v_pay >= 100 then 'thanh toán 100%' else 'đặt cọc ' || v_pay || '%' end),
      jsonb_build_object('at', v_now, 'by', 'customer', 'text', 'Gửi ảnh chụp chuyển khoản')),
    'unreadAdmin', 1, 'unreadCustomer', 0);

  insert into public.records (kind, id, data, phone) values ('order', v_id, v_order, v_phone);
  return public.public_order(v_order);
end $$;

