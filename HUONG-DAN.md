# Pinya Printing · web đặt in

Web tĩnh (HTML/CSS/JS thuần), không cần cài đặt hay build. Mở `index.html` bằng trình duyệt là chạy (dữ liệu trên Supabase nếu `assets/config.js` có khóa).

## Các trang

| File | Dành cho | Có gì |
|---|---|---|
| `index.html` | Khách | Thanh ngang: **Giới thiệu · các danh mục · Liên hệ**, nút **Theo dõi đơn** và giỏ hàng. Xem sản phẩm, chọn phân loại, đặt hàng. Nhập số điện thoại để xem tiến độ in, chuyển cọc, duyệt ảnh mẫu, nhắn shop |
| `admin.html` | Shop | Xem chi tiết từng mục ở phần "Trang quản trị" bên dưới |

## Trang quản trị

- **Tổng quan**: số đơn chờ thanh toán, đang in, đang chuyển, việc cần làm, doanh số.
- **Đơn hàng**: bảng gồm mã đơn, tên + SĐT, link mạng xã hội rút gọn, trạng thái, sản phẩm × số lượng, tổng đơn (tag **CKF** nếu chuyển khoản đủ; nếu cọc thì ghi số tiền đã cọc). Tích ô đầu dòng để **đổi trạng thái hàng loạt**. Trong từng đơn có nút **Sửa đơn** (thông tin khách, file, số lượng, đơn giá, cách thanh toán).
- **Đơn in**: đơn shop đặt xưởng Trung. Gồm mã vận đơn, loại sản phẩm, số lượng in, đơn giá tệ, tỷ giá, quy đổi VNĐ (tự tính), cân nặng (điền ngay trên bảng khi hàng về), kho trung chuyển và phí ship ước tính.
- **Sản phẩm**: mỗi sản phẩm nhiều phân loại, mỗi phân loại một giá.
- **Danh mục**: thêm, sửa, xóa, đổi thứ tự (hiện trên thanh ngang cửa hàng).
- **Xưởng**: xưởng đối tác (chỉ shop thấy).
- **Logistics**: kho trung chuyển TQ–VN kèm bảng giá cân theo mức kg, phí tối thiểu, ô tính thử để so giá giữa các kho.
- **Cài đặt**: tên shop, mô tả, liên hệ, mốc 1 triệu và tỷ lệ cọc, tài khoản nhận tiền.

## Tài khoản chạy thử

- Quản trị: email `admin@example.com`, mật khẩu `demo`
- Theo dõi đơn mẫu: nhập số `0912 345 678`

## Khách đặt hàng (3 bước)

1. **Giỏ hàng**: chọn sản phẩm, phân loại, số lượng.
2. **Gửi file**: dán link Google Drive chứa file thiết kế (bắt buộc), kèm ghi chú.
3. **Thanh toán**: điền thông tin nhận hàng (kèm link mạng xã hội để shop liên hệ), chọn cách thanh toán:
   - Đơn **dưới 1 triệu**: thanh toán 100% hoặc đặt cọc 50%
   - Đơn **từ 1 triệu trở lên**: thanh toán 100% hoặc đặt cọc 70%

   Mốc 1 triệu và các tỷ lệ cọc sửa được trong admin → Cài đặt.

## Luồng một đơn

Chờ thanh toán → Shop bấm "Đã nhận tiền, bắt đầu in" → Đang in → Vận chuyển (Kho TQ → Lạng Sơn → Kho VN → Giao) → Đã giao → Thu phần còn lại (nếu khách chọn cọc).

Khách gửi nhầm file thì tự dán link mới trong trang theo dõi đơn. Có phát sinh thêm (chỉnh file, ship gấp): thêm **Phụ phí** trong trang chi tiết đơn.

## Bắt đầu bán thật

1. Vào admin → **Cài đặt**: sửa tên shop, mô tả, Zalo, email, tài khoản ngân hàng, tỷ lệ cọc.
2. (Chỉ chế độ chạy thử) Cũng ở Cài đặt → **Xóa dữ liệu mẫu, bắt đầu bán thật**. Bản nối Supabase bắt đầu trống, không có dữ liệu mẫu.
3. Vào **Sản phẩm** → **Thêm sản phẩm**: tên, danh mục, mô tả, ảnh, rồi thêm từng phân loại với giá và số lượng tối thiểu.

## Dữ liệu và máy chủ (Supabase)

Web có hai chế độ, chọn bằng `assets/config.js`:

- **Có địa chỉ và khóa Supabase** (đang dùng): dữ liệu nằm trên Supabase, khách ở máy nào đặt hàng shop cũng nhận được. Admin đăng nhập bằng tài khoản Supabase thật. Ảnh sản phẩm lưu ở kho ảnh `product-images`.
- **Để trống `config.js`**: chế độ chạy thử, dữ liệu lưu trong trình duyệt, đăng nhập admin giả lập (`admin@example.com` / `demo`).

Khóa `sb_publishable_...` được phép nằm trong mã web. Quyền thật do Row Level Security quyết định (xem `supabase/schema.sql`):

- Ai cũng đọc được cài đặt, danh mục, sản phẩm. Chỉ admin đọc và ghi được mọi thứ còn lại (đơn, khách, xưởng, đơn in, kho).
- Khách chưa đăng nhập chỉ làm được 3 việc, qua hàm trên máy chủ: đặt hàng, xem đơn theo số điện thoại, nhắn tin hoặc báo chuyển khoản hoặc đổi link file hoặc hủy đơn của chính mình. Giá luôn do máy chủ tính lại từ bảng sản phẩm. Thông tin nội bộ (xưởng, kho, cân nặng, phí ship) không gửi cho khách.
- Admin mở nhiều thiết bị: web tự cập nhật mỗi 20 giây. Nếu khách vừa cập nhật đúng đơn bạn đang sửa, web tải lại dữ liệu mới và báo bạn làm lại, không ghi đè tin nhắn của khách.

### Thiết lập lần đầu

1. Chạy `supabase/schema.sql` trong Supabase → SQL Editor (nếu chưa chạy).
2. Supabase → Authentication → Users → **Add user**, nhập email và mật khẩu, tích Auto Confirm.
3. Cấp quyền quản trị cho tài khoản đó, chạy trong SQL Editor:
   `insert into public.admins (user_id) select id from auth.users where email = 'email-cua-ban@...';`
4. Authentication → Sign In / Providers: tắt **Allow new users to sign up** (shop không cần khách có tài khoản).
5. Mở `admin.html`, đăng nhập. Lần đầu web tự tạo cài đặt và 4 danh mục.

### Lấy ảnh từ link bài đăng

Trong **Sản phẩm → sửa sản phẩm → Ảnh sản phẩm** có nút **Lấy ảnh từ link**. Dán link một bài đăng hoặc trang có ảnh, bấm Tìm ảnh, tích chọn ảnh cần lấy. Ảnh được tải về kho ảnh của shop, link nguồn không lưu ở đâu và khách không nhìn thấy.

- Chạy bằng Edge Function `import-images` (mã ở `supabase/functions/import-images/`). Chỉ tài khoản admin gọi được, và chặn địa chỉ nội bộ.
- Lấy được ảnh khi trang trả ảnh trong HTML: Pinterest, TikTok, web bán hàng thường, blog, báo. **Facebook, Instagram, Shopee, Xiaohongshu** thường chặn hoặc chỉ hiện ảnh sau khi đăng nhập, khi đó dùng nút Thêm ảnh hoặc dán link ảnh trực tiếp.
- Dán nguyên đoạn chia sẻ (có chữ và biểu tượng) cũng được, web tự tách link. Dán nhiều link một lúc (tối đa 6) thì web quét từng link rồi gộp ảnh.
- Mỗi lần tối đa 12 ảnh, mỗi ảnh tối đa 5MB, định dạng JPG, PNG, WEBP.
- Chỉ lấy ảnh bạn có quyền dùng.
- Sửa hàm xong cần triển khai lại: Supabase → Edge Functions → import-images, hoặc nhờ Claude triển khai.

### Lưu ý

- Gói miễn phí của Supabase tự **tạm dừng nếu 7 ngày không có truy cập**. Dự án bị dừng thì web báo "Chưa tải được cửa hàng". Vào dashboard bấm Restore là chạy lại, dữ liệu không mất.
- Khách xem đơn bằng số điện thoại, ai biết số cũng xem được đơn của số đó. Nếu cần chặt hơn, thêm bước xác minh (mã đơn hoặc OTP) sau.
- Nên tắt hoặc xóa các đơn thử trước khi bán thật.

## Cấu trúc file

- `assets/base.css`: màu (baby blue), font (Quicksand, Nunito), nút, ô nhập
- `assets/app.css`: khung trang admin và các khối dùng chung
- `assets/shop.css`, `assets/shop.js`: trang cửa hàng
- `assets/admin.js`: trang quản trị
- `assets/pinya.js`: dữ liệu, trạng thái đơn, tính tiền, giao diện tùy chỉnh, đồng bộ Supabase, dữ liệu mẫu (chế độ thử)
- `assets/config.js`: địa chỉ và khóa Supabase
- `assets/vendor/supabase.js`: thư viện kết nối Supabase (bản ghim, không cần CDN)
- `supabase/schema.sql`: bảng, quyền truy cập, hàm cho khách, kho ảnh

## Đưa lên mạng (bản tĩnh)

Kéo thả cả thư mục lên Netlify Drop, Vercel, Cloudflare Pages hoặc GitHub Pages. Không cần cấu hình gì thêm.
