-- Pinya Printing · cấu trúc Supabase
-- Chạy một lần trong Supabase → SQL Editor (hoặc đã được áp dụng qua migration).
--
-- Mô hình:
--   records   mọi dữ liệu dạng tài liệu JSON: kind = loại, id = mã.
--             Công khai (ai cũng đọc): settings, category, product.
--             Riêng tư (chỉ admin): order, customer, factory, logistic, printjob, jobfee, preset, meta.
--   admins    những tài khoản đăng nhập được quyền quản trị.
--   Khách (chưa đăng nhập) chỉ làm việc qua 3 hàm: submit_order, track_orders, customer_action.
--   Các hàm này tự kiểm tra, tự tính lại giá từ bảng sản phẩm và giấu thông tin nội bộ.

create table if not exists public.records (
  kind        text        not null,
  id          text        not null,
  data        jsonb       not null,
  phone       text,
  pos         integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (kind, id)
);
create index if not exists records_phone_idx   on public.records (phone) where kind = 'order';
create index if not exists records_updated_idx on public.records (updated_at);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create sequence if not exists public.order_seq;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before update on public.records
  for each row execute function public.touch_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- ==== Quyền truy cập ====
alter table public.records enable row level security;
alter table public.admins  enable row level security;

drop policy if exists records_public_read on public.records;
create policy records_public_read on public.records
  for select to anon, authenticated
  using (kind in ('settings', 'category', 'product'));

drop policy if exists records_admin_all on public.records;
create policy records_admin_all on public.records
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete on public.records from anon;
revoke all on public.admins from anon, authenticated;

-- ==== Hàm hỗ trợ ====
-- "+84 912 345 678" → "0912345678"
create or replace function public.norm_phone(p text) returns text
language sql immutable as $$
  select case when d like '84%' and length(d) = 11 then '0' || substr(d, 3) else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) s
$$;

-- Bỏ thông tin nội bộ (xưởng, kho, cân nặng, phí ship) trước khi trả đơn cho khách
create or replace function public.public_order(o jsonb) returns jsonb
language sql immutable as $$
  select jsonb_set(
    (o - 'factoryId' - 'customerId' - 'demo' - 'unreadAdmin')
      || case when jsonb_typeof(o->'shipping') = 'object'
              then jsonb_build_object('shipping', (o->'shipping') - 'cost' - 'warehouseId' - 'warehouseName' - 'kg')
              else '{}'::jsonb end,
    '{history}',
    coalesce((
      select jsonb_agg(
        case when h->>'text' like 'Hàng rời xưởng%'
             then jsonb_set(h, '{text}', to_jsonb(regexp_replace(h->>'text', ' qua .*$', '')))
             else h end
        order by ord)
      from jsonb_array_elements(coalesce(o->'history', '[]'::jsonb)) with ordinality as t(h, ord)
      where h->>'jobId' is null and (h->>'text') !~ '^(Giao cho xưởng|Bỏ chọn xưởng)'
    ), '[]'::jsonb))
$$;

-- ==== Khách: xem đơn theo số điện thoại ====
create or replace function public.track_orders(p_phone text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.public_order(r.data) order by (r.data->>'createdAt')::bigint desc), '[]'::jsonb)
  from public.records r
  where r.kind = 'order'
    and length(public.norm_phone(p_phone)) >= 9
    and r.phone = public.norm_phone(p_phone)
$$;

-- ==== Khách: đặt hàng ====
-- Giá, tên sản phẩm, thời gian in đều lấy từ bảng sản phẩm, không tin dữ liệu khách gửi lên.
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
  v_thr bigint; v_dep int; v_pay int; v_id text; v_cid text; v_order jsonb;
begin
  if v_name = '' or length(v_name) > 200 then raise exception 'Nhập họ tên người nhận.'; end if;
  if length(v_phone) < 9 or length(v_phone) > 15 then raise exception 'Số điện thoại chưa đúng.'; end if;
  if v_addr = '' or length(v_addr) > 500 then raise exception 'Nhập địa chỉ nhận hàng.'; end if;
  if v_file !~* '^https?://\S+\.\S+' or length(v_file) > 1000 then raise exception 'Link file thiết kế chưa đúng.'; end if;
  if length(v_social) > 500 or length(v_note) > 2000 or length(v_city) > 100 then raise exception 'Nội dung nhập quá dài.'; end if;
  if jsonb_typeof(p_order->'items') is distinct from 'array' or jsonb_array_length(p_order->'items') not between 1 and 30 then
    raise exception 'Giỏ hàng trống.';
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

  v_id := 'PP-' || to_char(timezone('Asia/Ho_Chi_Minh', now()), 'YYMM') || '-' || lpad(nextval('public.order_seq')::text, 4, '0');

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
    'paidNotice', null, 'produceStart', null, 'shipping', null, 'deliveredAt', null, 'factoryId', null,
    'cancelReason', '', 'messages', '[]'::jsonb,
    'history', jsonb_build_array(jsonb_build_object('at', v_now, 'by', 'customer',
      'text', 'Đặt hàng, chọn ' || case when v_pay >= 100 then 'thanh toán 100%' else 'đặt cọc ' || v_pay || '%' end)),
    'unreadAdmin', 0, 'unreadCustomer', 0);

  insert into public.records (kind, id, data, phone) values ('order', v_id, v_order, v_phone);
  return public.public_order(v_order);
end $$;

-- ==== Khách: thao tác trên đơn của mình ====
-- p_action: message | notify_paid | set_file | cancel | mark_read
create or replace function public.customer_action(p_id text, p_phone text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o jsonb; v_txt text; v_total bigint; v_first bigint;
  v_now bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select data into o from public.records
    where kind = 'order' and id = p_id and length(public.norm_phone(p_phone)) >= 9
      and phone = public.norm_phone(p_phone)
    for update;
  if o is null then raise exception 'Không tìm thấy đơn này.'; end if;

  if p_action = 'mark_read' then
    if coalesce((o->>'unreadCustomer')::int, 0) = 0 then return public.public_order(o); end if;
    o := jsonb_set(o, '{unreadCustomer}', '0'::jsonb);

  elsif p_action = 'message' then
    v_txt := btrim(coalesce(p_payload->>'text', ''));
    if v_txt = '' or length(v_txt) > 2000 then raise exception 'Tin nhắn trống hoặc quá dài.'; end if;
    o := jsonb_set(o, '{messages}', coalesce(o->'messages', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('at', v_now, 'from', 'customer', 'text', v_txt)));
    o := jsonb_set(o, '{unreadAdmin}', to_jsonb(coalesce((o->>'unreadAdmin')::int, 0) + 1));
    o := jsonb_set(o, '{updatedAt}', to_jsonb(v_now));

  elsif p_action = 'notify_paid' then
    if o->>'status' <> 'cho_coc' then raise exception 'Đơn này không còn chờ thanh toán.'; end if;
    select coalesce(sum((i->>'price')::bigint * (i->>'qty')::bigint), 0) + coalesce((o->>'extraFee')::bigint, 0)
      into v_total from jsonb_array_elements(o->'items') i;
    v_first := round(v_total * coalesce((o->>'payPct')::numeric, 100) / 100.0);
    o := jsonb_set(o, '{paidNotice}', to_jsonb(v_now));
    o := jsonb_set(o, '{history}', coalesce(o->'history', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('at', v_now, 'by', 'customer', 'text', 'Báo đã chuyển khoản')));
    o := jsonb_set(o, '{messages}', coalesce(o->'messages', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('at', v_now, 'from', 'customer',
                'text', 'Mình đã chuyển khoản ' || translate(to_char(v_first, 'FM999,999,999,999'), ',', '.') || ' ₫, nội dung ghi ' || p_id || '.')));
    o := jsonb_set(o, '{unreadAdmin}', to_jsonb(coalesce((o->>'unreadAdmin')::int, 0) + 1));
    o := jsonb_set(o, '{updatedAt}', to_jsonb(v_now));

  elsif p_action = 'set_file' then
    v_txt := btrim(coalesce(p_payload->>'file', ''));
    if v_txt !~* '^https?://\S+\.\S+' or length(v_txt) > 1000 then raise exception 'Link file chưa đúng.'; end if;
    if o->>'status' in ('da_giao', 'huy') then raise exception 'Đơn này không đổi file được nữa.'; end if;
    o := jsonb_set(o, '{file}', to_jsonb(v_txt));
    o := jsonb_set(o, '{history}', coalesce(o->'history', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('at', v_now, 'by', 'customer', 'text', 'Cập nhật link file thiết kế')));
    o := jsonb_set(o, '{unreadAdmin}', to_jsonb(coalesce((o->>'unreadAdmin')::int, 0) + 1));
    o := jsonb_set(o, '{updatedAt}', to_jsonb(v_now));

  elsif p_action = 'cancel' then
    if o->>'status' <> 'cho_coc' then raise exception 'Đơn đã thanh toán, nhắn shop để hủy.'; end if;
    if coalesce(o->>'paidNotice', '') <> '' then raise exception 'Bạn đã báo chuyển khoản, nhắn shop để hủy.'; end if;
    o := jsonb_set(o, '{status}', '"huy"'::jsonb);
    o := jsonb_set(o, '{cancelReason}', '"Khách hủy đơn"'::jsonb);
    o := jsonb_set(o, '{history}', coalesce(o->'history', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('at', v_now, 'by', 'customer', 'text', 'Hủy đơn: Khách hủy đơn')));
    o := jsonb_set(o, '{updatedAt}', to_jsonb(v_now));

  else
    raise exception 'Thao tác không hợp lệ.';
  end if;

  update public.records set data = o where kind = 'order' and id = p_id;
  return public.public_order(o);
end $$;

grant execute on function public.is_admin()                             to anon, authenticated;
grant execute on function public.track_orders(text)                     to anon, authenticated;
grant execute on function public.submit_order(jsonb)                    to anon, authenticated;
grant execute on function public.customer_action(text, text, text, jsonb) to anon, authenticated;

-- ==== Ảnh sản phẩm: kho công khai, chỉ admin tải lên ====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists product_images_read   on storage.objects;
drop policy if exists product_images_insert on storage.objects;
drop policy if exists product_images_update on storage.objects;
drop policy if exists product_images_delete on storage.objects;
create policy product_images_read   on storage.objects for select using (bucket_id = 'product-images');
create policy product_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_update on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy product_images_delete on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
