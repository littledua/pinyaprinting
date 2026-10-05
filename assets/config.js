/* Kết nối Supabase. Khóa "publishable" được phép công khai trong mã web:
 * quyền truy cập thật do Row Level Security bên Supabase quyết định (xem supabase/schema.sql).
 * Xóa hai dòng này (hoặc để trống) thì web quay về chế độ chạy thử, lưu trong trình duyệt. */
window.PINYA_CONFIG = {
  supabaseUrl: 'https://sdplwfpmbavcfjfxfecf.supabase.co',
  supabaseKey: 'sb_publishable_SUCM5H8OFZYV2nFKc-w9SA_SH8YAVaF'
};
