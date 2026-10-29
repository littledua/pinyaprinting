# Pinya Printing — quy tắc làm việc cho Claude

Chủ shop nhắn bằng tiếng Việt. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, không thuật ngữ nếu không cần.

## Quy tắc bắt buộc (chủ shop dặn)

### 1. Tính năng lạ, chưa từng làm: KHÔNG làm từ số 0
Với chức năng chưa quen thuộc hoặc chưa làm bao giờ trong repo này:
1. Tìm mã nguồn mở trên GitHub (và tài liệu chính thức) để **so sánh ý tưởng** trước.
2. Lập **plan** nêu rõ: tham khảo dự án nào, lấy ý gì, khác gì, các bước, rủi ro.
3. **Gửi plan cho chủ shop duyệt TRƯỚC khi viết code.** Chưa duyệt thì chưa làm.
4. Chỗ nào không chắc, **hỏi chủ shop**, đừng tự đoán.
Chỉ đọc ý tưởng; không chép nguyên mã nếu giấy phép không cho, và ghi nguồn tham khảo trong plan.

### 2. Cải thiện giao diện (cửa hàng + admin): dùng bộ skill `impeccable`
Gửi plan trước khi thực hiện, chờ duyệt, rồi mới sửa.

### 3. Merge
Sau khi chỉnh xong và đã tự kiểm tra thì tự merge vào `main` (chủ shop đã đồng ý "chỉnh xong thì auto merge"). Riêng việc lớn đã nằm trong plan chờ duyệt thì chỉ làm sau khi được duyệt. Trước khi đẩy `main`, luôn `git fetch origin main`, gộp `main` vào nhánh nếu có thay đổi mới.

### 4. Không nhắc lại
- Không giảng về bản quyền ảnh khi nhập ảnh từ link (chủ shop tự lấy từ shop mình nhập hàng).
- Khách không bao giờ được thấy link nguồn ảnh; không lưu link nguồn vào dữ liệu sản phẩm.

## Về dự án
- Web tĩnh HTML/CSS/JS thuần, **không build**, chạy trên GitHub Pages: https://littledua.github.io/pinyaprinting/ (admin: `admin.html`).
- Nhánh làm việc: `claude/pinya-printing-web-6xrt0s`. Đẩy lên nhánh rồi `git push origin HEAD:main`.
- `index.html` (cửa hàng), `admin.html`, `assets/` (`pinya.js` dữ liệu + logic, `shop.js`, `admin.js`, `base.css`, `shop.css`, `app.css`, `config.js`, `vendor/supabase.js`), `pearly/` (app chi tiêu cá nhân, một file `index.html`), `supabase/` (schema, Edge Function `import-images`), `HUONG-DAN.md`.
- Backend Supabase: bảng `records`, RLS, RPC cho khách (`submit_order`, `track_orders`, `customer_action`). Khóa publishable trong `assets/config.js`; không đưa khóa bí mật vào repo.
- Không có `config.js` điền sẵn thì chạy chế độ thử bằng localStorage.

## Cách kiểm tra
- Chạy thử bằng `python3 -m http.server <cổng>` rồi Playwright (Chromium có sẵn, `/opt/node22/lib/node_modules/playwright`). Thử cỡ điện thoại 390px (và 320/360) trước, rồi máy tính.
- Tắt server thử khi xong.
- Điện thoại: không để trang tự zoom khi chạm ô nhập (ô nhập tối thiểu 16px).
