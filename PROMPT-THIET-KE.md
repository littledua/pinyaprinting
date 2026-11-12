# Prompt thiết kế lại giao diện Pinya Printing

Dán nguyên phần dưới đây cho người thiết kế hoặc công cụ AI.

---

## 1. Pinya Printing là gì
Pinya Printing là một tiệm in nhỏ tại Việt Nam, do **một người** vận hành. Shop nhận in theo đơn và giao toàn quốc:
- **In giấy:** name card, hộp giấy cứng, túi giấy, tem nhãn, catalogue.
- **In nhựa, mica:** móc khóa acrylic, standee mica, kệ mica, huy hiệu.
- **In 3D:** figure resin, mô hình, mẫu thử sản phẩm.
- **In vải:** áo thun in DTF, túi tote canvas, cờ, băng rôn vải.

Khẩu hiệu hiện tại: "In ấn tại xưởng, giao tận tay". Câu giới thiệu: "Pinya nhận in giấy, nhựa mica, in 3D và in vải tại xưởng với giá xưởng."

Cách làm việc: đơn được gửi cho các **xưởng in đối tác ở Trung Quốc** (nhiều thành phố khác nhau; chủ shop tự thêm và tùy chỉnh thông tin từng xưởng trong admin). Hàng in xong về kho trung chuyển, qua đơn vị **logistics** về Việt Nam, rồi giao tận tay khách. Thời gian in khoảng 5–10 ngày tùy sản phẩm, cộng thời gian vận chuyển.

Web gồm 2 phần:
- **Cửa hàng** cho khách: https://littledua.github.io/pinyaprinting/
- **Trang quản trị** cho chủ shop: https://littledua.github.io/pinyaprinting/admin.html

## 2. Người dùng

**Khách mua (cửa hàng)**
- **Mọi khách hàng có nhu cầu in ấn**: cá nhân in đồ riêng, đồ fan (móc khóa, standee, figure, áo, túi tote), shop nhỏ và người bán online cần name card, hộp, túi, tem nhãn, doanh nghiệp nhỏ in số lượng vừa.
- **Tệp chính là người dùng mạng xã hội.** Kênh chính shop dùng để tiếp cận khách là **Threads**; khách bấm link từ bài Threads (và Facebook, Instagram, Zalo) vào web.
- Vì vậy gần như luôn xem bằng **điện thoại**, mở trong trình duyệt của app mạng xã hội, ghé nhanh, cần hiểu ngay trong vài giây.
- Họ cần thấy nhanh: có in được món mình muốn không, giá bao nhiêu, đặt tối thiểu bao nhiêu, bao lâu có hàng, đặt và trả tiền thế nào.

**Chủ shop (trang quản trị)**
- Một người làm hết: nhận đơn, xác nhận tiền, đặt in với xưởng, theo dõi hàng về, giao hàng, trả lời tin nhắn khách.
- Dùng cả **điện thoại** (khi đang ở ngoài) và **máy tính** (khi xử lý nhiều đơn).
- Cần thấy ngay "việc nào phải làm trước" và thao tác nhanh, ít bấm.

## 3. Sản phẩm và giá
- Mỗi sản phẩm có nhiều **phân loại** (kích thước, chất liệu, số mặt in, size áo…). Mỗi phân loại có **giá riêng** và **số lượng tối thiểu** riêng (VD: hộp giấy 15×15×5 cm giá 18.000 ₫/cái, tối thiểu 200).
- Ví dụ sản phẩm: Name card (theo hộp 100 cái), Hộp giấy cứng nắp rời, Móc khóa acrylic, Standee mica, Figure resin, Túi tote canvas, Áo thun cotton in DTF.
- Ảnh sản phẩm là ảnh thật shop nhập từ link mạng xã hội. Ảnh đầu tiên là ảnh bìa. Sản phẩm chưa có ảnh thì hiện ô màu theo danh mục.
- Khách **không cần tài khoản**. Theo dõi đơn bằng số điện thoại.

## 4. Luồng mua hàng (phải giữ)
1. **Xem sản phẩm:** trang chủ, danh mục, tìm kiếm.
2. **Trang sản phẩm:** chọn phân loại, nhập số lượng (không dưới mức tối thiểu), xem thành tiền. Có nút Thêm vào giỏ và Mua ngay.
3. **Giỏ hàng:** sửa số lượng, xóa.
4. **Gửi file thiết kế:** dán link Google Drive chứa file in, kèm ghi chú cho shop.
5. **Thanh toán:**
   - Điền họ tên, số điện thoại, link mạng xã hội, địa chỉ, tỉnh thành.
   - Chọn **thanh toán 100%** hoặc **đặt cọc**. Đơn dưới 1 triệu cọc 50%, từ 1 triệu cọc 70%; các mức này chỉnh được trong admin.
   - Hiện **mã QR chuyển khoản** (VietQR) ngay tại đây, đã điền sẵn số tiền và nội dung là mã đơn (VD: PP-2611-0012).
   - Khách chuyển khoản, **tải ảnh chụp chuyển khoản lên (bắt buộc)**, rồi mới bấm **Đặt hàng**.
6. **Đã đặt hàng:** báo shop đã nhận ảnh chuyển khoản, có link xem tiến độ.
7. **Theo dõi đơn:**
   - Nhập số điện thoại để xem các đơn.
   - Thanh tiến độ 5 bước: Đặt hàng → Thanh toán → Đang in → Vận chuyển → Nhận hàng.
   - Nhắn tin với shop, đổi link file, hủy đơn khi chưa thanh toán, trả phần còn lại sau khi nhận hàng.

## 5. Trang quản trị (phải giữ chức năng)
- **Tổng quan:**
  - Các ô "Việc cần làm": khách báo đã chuyển, chưa đặt in, tin nhắn mới, quá ngày dự kiến, thu phần còn lại, nhắc thanh toán.
  - Tiền 30 ngày, số đơn theo trạng thái, sản phẩm bán chạy.
- **Đơn hàng:**
  - Danh sách có tìm kiếm, lọc theo trạng thái và danh mục, chọn nhiều đơn để đổi trạng thái hàng loạt.
  - Trang chi tiết đơn: xem ảnh chuyển khoản, xác nhận tiền, nhắn tin với khách, lịch sử đơn.
  - Trạng thái: Chờ thanh toán → Đang in → Đang vận chuyển → Đã giao (hoặc Đã hủy).
- **Đơn in:**
  - Gom nhiều đơn khách thành một đơn gửi xưởng.
  - Theo dõi mã vận đơn, cân nặng và phụ phí chia theo cân nặng.
- **Sản phẩm:**
  - Danh sách sản phẩm.
  - Trang sửa sản phẩm: tên, danh mục, thời gian in, mô tả, ảnh có sắp xếp thứ tự, lấy ảnh từ link mạng xã hội, nhóm phân loại và bảng giá theo tổ hợp.
  - Thư viện **Phân loại** dùng chung.
  - **Danh mục**.
- **Xưởng:** danh sách xưởng đối tác ở Trung Quốc, chủ shop **tự thêm, sửa thông tin** từng xưởng (tên, thành phố, danh mục nhận in, liên hệ, đánh giá, ghi chú).
- **Logistics:** kho trung chuyển, tuyến, giá theo kg.
- **Cài đặt:**
  - **Cửa hàng:** tên, khẩu hiệu, mô tả, liên hệ (Zalo, email, giờ làm, địa chỉ, Facebook, Instagram), luật thanh toán, ngân hàng nhận tiền, tên hiển thị khi nhắn khách.
  - **Giao diện:** ảnh đại diện/logo, màu chủ đạo, màu nhấn, sáng/tối, font, cỡ chữ, bật tắt từng mục trên web.

## 6. Giao diện hiện tại (để tham khảo, có thể thay)
- **Phong cách:** pastel, mềm, bo tròn nhiều, theo kiểu web Little Store of Dứa (tiemdua.netlify.app) của cùng chủ.
- **Màu:** xanh baby blue (#8FCBF0) là màu chính, hồng phấn (#F7C6D9) là màu nhấn, nền gần trắng xanh nhạt, chữ xanh than (#1E3A52), giá tiền màu xanh xám (#3F6E92). Chủ shop đổi được màu chính và màu nhấn trong Cài đặt.
- **Font:** Quicksand (tròn, có tiếng Việt).
- **Cửa hàng:**
  - **Đầu trang:** logo tròn, tên và khẩu hiệu. Máy tính có ô tìm kiếm và menu chữ. Điện thoại có ô tìm ở hàng dưới và nút ☰.
  - **Trang chủ:** bong bóng danh mục tròn, dải "Nổi bật tuần này", lưới "Tất cả sản phẩm" có chip lọc và sắp xếp.
  - **Thẻ sản phẩm:** ảnh dọc 4:5, nhãn "Tối thiểu …", nút "+".
  - **Trang sản phẩm:** ảnh tràn viền vuốt được, thanh mua nổi ở đáy màn hình điện thoại.
- **Admin:** thanh bên trái trên máy tính, menu ngăn kéo trên điện thoại. Đơn hàng là bảng trên máy tính, thẻ trên điện thoại.
- **Dấu riêng của nghề in** có thể dùng làm điểm nhấn: dấu canh chỉnh (registration mark) làm logo mặc định, dải màu CMYK, dấu xén góc, mỗi danh mục một màu mực (xanh C, hồng M, vàng Y, xám K).

## 7. Yêu cầu bắt buộc khi thiết kế lại
- **Tối giản, dễ dùng, dễ thao tác.** Ít chữ, ít bước, mỗi màn hình một việc chính, nút hành động rõ ràng, không trang trí thừa. Người lần đầu vào từ Threads phải tự đặt được đơn mà không cần hỏi shop.
- **Tra đơn bằng số điện thoại** là chức năng nổi bật, dễ thấy ở mọi trang (không chỉ ở chân trang): khách nhập số điện thoại là thấy **tất cả đơn in** của mình và **trạng thái từng đơn** (chờ thanh toán, đang in, đang vận chuyển, đã giao), mở từng đơn xem chi tiết tiến độ.
- **Điện thoại trước**, rồi máy tính. Thử ở bề ngang 320, 360, 390 px và 1366 px. Không được cuộn ngang.
- Ô nhập chữ tối thiểu 16px để iPhone không tự phóng to. Nút bấm cao ít nhất 44px.
- Toàn bộ chữ trên web bằng **tiếng Việt**, giọng thân thiện, ngắn gọn, không thuật ngữ.
- Có cả **giao diện sáng và tối**. Chủ shop vẫn đổi được màu chính, màu nhấn và font trong admin, nên màu phải đi qua biến chứ không cố định.
- Giữ nguyên mọi chức năng và luồng ở mục 4 và 5. Chỉ đổi cách trình bày.
- **Kỹ thuật:** web là HTML/CSS/JS thuần, không có bước build, chạy trên GitHub Pages, dữ liệu trên Supabase. Không dùng React hay Tailwind; thư viện ngoài chỉ khi thật cần.
- Khách **không bao giờ** được thấy link nguồn ảnh sản phẩm.

## 8. Cần đề xuất
1. Hướng phong cách mới, kèm 2–3 phương án để chọn: bảng màu, font, cách dùng hình ảnh, cảm giác thương hiệu, và lý do hợp với khách của tiệm in.
2. Bố cục điện thoại và máy tính cho các trang cửa hàng:
   - Trang chủ, danh mục, tìm kiếm, sản phẩm.
   - Giỏ hàng, gửi file, thanh toán (có QR và tải ảnh chuyển khoản), đã đặt hàng.
   - Theo dõi đơn, chi tiết đơn, liên hệ.
3. Bố cục admin: tổng quan, danh sách đơn, chi tiết đơn, đơn in, sửa sản phẩm, cài đặt.
4. Hệ thống thành phần dùng chung: nút, ô nhập, chip, nhãn trạng thái, thẻ, bảng, thông báo, trạng thái trống, đang tải, lỗi.
5. Cách thể hiện sản phẩm khi **chưa có ảnh** cho đẹp, và khi có nhiều ảnh.
