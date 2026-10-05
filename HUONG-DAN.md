# Pinya Printing · web đặt in

Web tĩnh (HTML/CSS/JS thuần), không cần cài đặt hay build. Mở `index.html` bằng trình duyệt là chạy.

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
2. Cũng ở Cài đặt → **Xóa dữ liệu mẫu, bắt đầu bán thật**: xóa sản phẩm, đơn, khách mẫu; giữ 4 danh mục.
3. Vào **Sản phẩm** → **Thêm sản phẩm**: tên, danh mục, mô tả, ảnh, rồi thêm từng phân loại với giá và số lượng tối thiểu.

## Quan trọng trước khi chạy thật

Bản này lưu dữ liệu trong **localStorage của trình duyệt**. Khách và shop chỉ thấy chung dữ liệu khi dùng cùng một máy, cùng trình duyệt. Đăng nhập admin cũng chỉ là giả lập.

Để khách ở máy khác đặt hàng mà shop nhận được, cần nối một backend (ví dụ Supabase: database, đăng nhập admin, lưu ảnh). Mọi chỗ đọc và ghi dữ liệu đã gom về `Pinya.load()`, `Pinya.update()` và `Pinya.act.*` trong `assets/pinya.js`, nên chỉ cần thay phần "LƯU TRỮ" trong file đó.

Ảnh sản phẩm hiện được thu nhỏ và lưu thẳng trong trình duyệt, nên giới hạn khoảng vài chục ảnh. Khi có backend thì chuyển sang lưu ảnh trên máy chủ.

## Cấu trúc file

- `assets/base.css`: màu (baby blue), font (Quicksand, Nunito), nút, ô nhập
- `assets/app.css`: khung trang admin và các khối dùng chung
- `assets/shop.css`, `assets/shop.js`: trang cửa hàng
- `assets/admin.js`: trang quản trị
- `assets/pinya.js`: dữ liệu, trạng thái đơn, tính tiền, dữ liệu mẫu

## Đưa lên mạng (bản tĩnh)

Kéo thả cả thư mục lên Netlify Drop, Vercel, Cloudflare Pages hoặc GitHub Pages. Không cần cấu hình gì thêm.
