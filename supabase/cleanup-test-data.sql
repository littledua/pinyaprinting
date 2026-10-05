-- Xóa dữ liệu thử (đơn, khách, sản phẩm, cài đặt thử) trong lúc nối Supabase, và đặt lại số thứ tự đơn.
-- Chạy trong Supabase → SQL Editor. Chỉ chạy TRƯỚC KHI có dữ liệu thật, vì lệnh này xóa hết bảng records.
delete from public.records;
select setval('public.order_seq', 1, false);
