# Tiến Nga Home CRM — v2.1 (B2C, lấy Next Action làm trung tâm)

CRM bán hàng B2C cho Tiến Nga Home (gạch ốp lát & thiết bị phòng tắm). Triết lý: sale mở CRM lên là biết ngay **khách nào cần chăm, đang ở giai đoạn nào, phải làm gì tiếp theo, khi nào, ai chịu trách nhiệm**. Trung tâm không phải "trạng thái khách", mà là **NEXT ACTION + DEADLINE + OWNER** — một cơ hội không có việc tiếp theo coi như chưa được quản lý.

## Các module chính (P0)

- **Dashboard điều hành**: thẻ tổng hợp (lead chưa xử lý, việc quá hạn, khách HOT, showroom/khảo sát hôm nay, giá trị pipeline, doanh thu chốt), phễu pipeline, danh sách việc quá hạn / khách HOT / lead mới.
- **Việc hôm nay** (màn hình mặc định của sale): gom việc theo 5 nhóm — Quá hạn · Lead mới chưa xử lý · Việc hôm nay · Khách nóng cần ưu tiên · Việc sắp tới. Nút **Hoàn thành** trên mỗi việc **bắt buộc** mở modal "Việc tiếp theo là gì?".
- **Pipeline (Kanban)**: 9 giai đoạn (Lead mới → … → Hoàn thành/Hậu mãi) + Tạm hoãn/Mất khách, **kéo thả** khách giữa các cột. Thẻ cảnh báo đỏ khi quá hạn, cảnh báo cam "CHƯA CÓ VIỆC TIẾP THEO".
- **Khách hàng**: bảng + tìm kiếm + lọc theo giai đoạn / mức độ / sale / nguồn. Hồ sơ chi tiết có khối **Việc tiếp theo** nổi bật, timeline tương tác, đổi giai đoạn, quick action Gọi/Zalo.
- **Lịch, Việc đã làm, Công trình, Báo cáo (chỉ số vận hành), Nhà cung cấp**.

### Cơ chế bắt buộc theo brief
- Hoàn thành một việc → **bắt buộc** tạo Next Action mới (16 loại việc dựng sẵn: Gọi khách, Nhắn Zalo, Gửi phối cảnh, Gửi báo giá, Mời showroom, Follow báo giá, Thu cọc…).
- Chuyển sang **Mất khách** → **bắt buộc** chọn 1 lý do (11 lý do dựng sẵn) + đối thủ + ghi chú; không chọn lý do thì không cho lưu.
- Khách đang active mà không có Next Action → hiển thị cảnh báo ở Kanban, bảng khách và hồ sơ.
- Cờ cảnh báo tự động: việc quá hạn, khách HOT >48h không tương tác (nguy cơ mất), đã báo giá >24h chưa follow, lịch showroom / khảo sát hôm nay.

### Phân quyền (không có màn hình đăng nhập)
Giữ mô hình "chọn người nhập" ở góc phải. Mỗi thành viên gắn sẵn vai trò:
- **Tuấn** = Quản lý/Admin (xem toàn bộ khách, việc, pipeline).
- **Liên, Cần, Hương** = Sale (mặc định mở "Việc hôm nay").

Công tắc **Cài đặt → Giới hạn dữ liệu theo sale** (mặc định BẬT): sale chỉ thấy khách/việc mình phụ trách; quản lý luôn thấy tất cả.

## Điểm nền tảng kế thừa từ bản v1

- **Hồ sơ công trình** (tab Công trình): gộp nhiều đơn của cùng một căn nhà, theo dõi giai đoạn thi công.
- **Checklist bán chéo**: lưới phòng × hạng mục, đánh dấu "mua tại Tiến Nga / nơi khác / chưa mua" — chỉ ra ngay chỗ đang mất thị phần trong tay khách của mình.
- **Nhắc gọi bán chéo tự động**: hệ thống tự sinh 4 việc theo lịch thi công (kiểm tra hàng, chốt TBVS trước ốp lát, xin ảnh công trình, chốt đơn bếp) — không phụ thuộc trí nhớ sale.
- **8 chỉ số phễu B2C + CPL trần**: tab Chỉ số vận hành — chỉ cần nhập tay chi phí ads mỗi ngày, còn lại tính tự động từ dữ liệu khách hàng.
- **Nhà cung cấp**: giữ nguyên y hệt bản v1.

Chi tiết kỹ thuật, logic tự động và hướng dẫn di chuyển dữ liệu từ bản v1: xem [CLAUDE.md](./CLAUDE.md).

## Chạy dự án để test ngay trên máy

```bash
npm install --ignore-scripts
npm run dev
```

Mở `http://localhost:3000`. Dữ liệu test lưu trong file `.local-data/dev.sqlite` (tự tạo, tự có sẵn dữ liệu mẫu) — thêm/sửa/xoá khách hàng, công trình, việc cần làm... đều lưu thật, khởi động lại vẫn còn. Muốn làm lại từ đầu: dừng server, xoá thư mục `.local-data/`, chạy `npm run dev` lại.

Dữ liệu mẫu: ~24 khách phủ đủ tình huống (quá hạn, hôm nay, sắp tới, lead mới chưa xử lý, HOT/Ấm/Nuôi dưỡng, đã chốt, mất khách có lý do, showroom & khảo sát hôm nay) — gồm các ví dụ trong brief (Nguyễn Văn Nam · Đông Anh · 86,5tr; Trần Thị Hương · Mê Linh; Lê Văn Tuấn · Sóc Sơn).

Kiểm tra trước khi bàn giao lên ChatGPT Sites:

```bash
npm run build
```

## Tài khoản demo

Không cần mật khẩu — chọn tên ở góc phải trên cùng:
- **Tuấn** → vai trò Quản lý/Admin (thấy toàn bộ).
- **Liên / Cần / Hương** → vai trò Sale (thấy dữ liệu của mình khi công tắc giới hạn đang bật).

## Biến môi trường

Test cục bộ **không cần** biến môi trường nào (dùng SQLite qua sql.js). Khi deploy trên ChatGPT Sites: nền tảng tự đặt `SITES_CLOUDFLARE_BUILD=1` và tự cấp binding D1 tên `DB` (khai báo trong `.openai/hosting.json`). Không có secret nào bắt buộc cho P0.

## Di chuyển dữ liệu (migration)

Bản v2.1 chỉ **thêm cột** vào bảng `customers` (file `drizzle/0003_b2c_customer_fields.sql`) — không đổi tên/không xoá bảng, an toàn với dữ liệu đang chạy. Chạy đủ 4 migration trong `drizzle/` theo thứ tự. Xem chi tiết di chuyển từ v1 trong [CLAUDE.md](./CLAUDE.md).

## Phần chưa làm (P1/P2 — theo brief)

- **P1**: Quản lý báo giá nhiều phiên bản (quotes/quote_items), báo cáo nâng cao (funnel/conversion/revenue theo sale & nguồn, sales performance), notifications realtime.
- **P2** (chỉ chuẩn bị kiến trúc, chưa triển khai): tích hợp Zalo API, Facebook Lead Ads, AI tóm tắt khách / gợi ý next action, lead scoring tự động.
