# Kế hoạch cải thiện giao diện Pinya Printing (cửa hàng + admin)

Trạng thái: **ĐÃ LÀM XONG 4 đợt theo kiểu Tiệm Dứa (màu xanh + hồng), có QR VietQR.** Bản kế hoạch có ảnh: https://claude.ai/artifact/JuYvk9xPVW5QfzKL36f5sL
Dùng bộ skill `impeccable` (quy trình: hỏi → chốt hướng → làm → tự kiểm).

## 1. Mình đã khám nhanh hiện trạng (chụp thật, điện thoại 390px + máy tính 1366px)

**Cửa hàng**
- Trang chủ: đẹp, sạch, nhưng khách phải bấm danh mục mới thấy sản phẩm. Trang chủ chưa có sản phẩm nổi bật, chưa có "vì sao chọn Pinya" (thời gian in, giao hàng, cách đặt).
- Trang sản phẩm: ảnh chỉ là ô màu với chữ cái (chưa có ảnh thật nên trông trống). Máy tính: cột trái ảnh, cột phải thông tin, phần dưới trống nhiều.
- Thanh menu trên điện thoại chỉ thấy 2/6 mục (mình đã làm mờ mép phải để gợi vuốt, vẫn chưa tốt).
- Đã sửa ngay 1 lỗi nhỏ mình gây ra: thanh menu bị cắt chữ trên máy tính (nút "Theo dõi đơn" chỉ còn biểu tượng). Đã đẩy lên nhánh.

**Admin**
- Trên điện thoại: thanh menu trên cùng cuộn ngang, 7 mục chỉ thấy khoảng 3. "Quản lý sản phẩm", "Xưởng", "Logistics", "Cài đặt" bị giấu, khó tìm.
- Các tab con (Sản phẩm · Phân loại · Danh mục) bị xuống 2 dòng, nhìn lộn xộn.
- Bảng đơn hàng trên máy tính khá dày chữ, mã xã hội và tên khách chiếm nhiều chỗ.
- Tổng quan: đủ số liệu nhưng 7 ô số có cùng độ nổi bật, khó thấy ngay "việc nào cần làm trước".

## 2. Tham khảo mã nguồn mở (chỉ lấy ý, không chép mã)
Mình mới tìm sơ trên web, **chưa mở đọc mã**. Sau khi bạn duyệt mình sẽ đọc kỹ rồi mới làm.
| Dự án | Dùng để tham khảo | Ghi chú giấy phép |
|---|---|---|
| Shopify **Dawn** (theme mẫu của Shopify) | Cách trình bày trang sản phẩm, chọn phân loại, giỏ hàng trượt | MIT, xem lại trước khi dùng |
| **Medusa** (admin + storefront mẫu) | Bố cục admin đơn hàng: bảng, bộ lọc, trang chi tiết đơn | MIT, xem lại |
| **webdevaminul/wda-mini-tshirt-shop** | Web bán hàng JS thuần: danh sách, chi tiết, giỏ lưu local | Chưa ghi giấy phép: chỉ xem ý, không chép |

## 3. Hướng đề xuất (chờ bạn chốt ở phần 5)

**Cửa hàng (mục tiêu: khách xem và đặt nhanh trên điện thoại)**
1. Thanh trên điện thoại: logo + tìm kiếm + giỏ; danh mục chuyển thành hàng chip dễ vuốt (hoặc ngăn kéo menu).
2. Trang chủ: thêm khối "Sản phẩm nổi bật" ngay dưới phần giới thiệu, và 3 ý ngắn "Cách đặt / Thời gian in / Giao hàng".
3. Trang sản phẩm: ảnh lớn vuốt được, giá và nút đặt luôn nhìn thấy trên điện thoại (thanh đặt hàng dính đáy như giỏ hàng).
4. Đồng bộ kiểu chữ, khoảng cách, bo góc; tăng độ tương phản chữ phụ.

**Admin (mục tiêu: nhìn là biết việc cần làm, thao tác một tay trên điện thoại)**
1. Điện thoại: thanh tab dưới đáy với 5 mục chính, phần còn lại vào "Thêm".
2. Tổng quan: đưa "Việc cần làm" lên đầu, số liệu tiền gom một hàng nhỏ.
3. Đơn hàng: dòng gọn hơn, trạng thái nổi bật, bấm vào xem chi tiết; trên điện thoại hiện dạng thẻ thay vì bảng.
4. Tab con (Sản phẩm/Phân loại/Danh mục): một hàng, vuốt ngang.

## 4. Phạm vi và an toàn
- **Không đụng**: dữ liệu, giá, Supabase, luật thanh toán, chức năng hiện có. Chỉ đổi cách hiển thị.
- Làm từng phần nhỏ: (A) cửa hàng điện thoại → (B) cửa hàng máy tính → (C) admin điện thoại → (D) admin máy tính. Mỗi phần tự kiểm trên 320/360/390/1366px, rồi merge.
- Rủi ro: sửa nhiều CSS dễ làm lệch chỗ khác; mình sẽ chụp trước/sau từng trang.
- Cần ảnh sản phẩm thật để trang sản phẩm đẹp (hiện chỉ có ô chữ cái).

## 5. Bạn đã trả lời
- Mức đổi: **tinh chỉnh**, giữ màu xanh trời nhạt, dấu cắt in, tên Pinya.
- Admin: **điện thoại và máy tính như nhau**, nên làm cả thẻ đơn hàng trên điện thoại lẫn bảng rộng trên máy tính.
- Ảnh thật: **sắp có**, trang sản phẩm xoay quanh ảnh lớn, ô chữ cái chỉ là chỗ tạm.
- Còn mở: shop/web nào bạn thích để mình lấy cảm hứng (không bắt buộc).

**Chưa làm gì cho tới khi bạn nói "duyệt".**

## Câu hỏi ban đầu (đã hỏi)
1. Muốn **tinh chỉnh** (giữ màu xanh trời nhạt, dấu cắt in, tên Pinya) hay **đổi hẳn phong cách**?
2. Khách của bạn xem chủ yếu bằng **điện thoại** đúng không? Còn bạn dùng admin bằng điện thoại hay máy tính nhiều hơn?
3. Bạn có ảnh sản phẩm thật chưa, hay còn dùng ô màu một thời gian?
4. Có shop/web nào bạn thích giao diện để mình lấy cảm hứng không (gửi link)?
