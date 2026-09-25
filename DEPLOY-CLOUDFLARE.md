# Deploy CRM Tiến Nga lên Cloudflare (cho cả team cùng xem)

Mục tiêu: có 1 địa chỉ web thật (dạng `https://tien-nga-home-crm.<tên>.workers.dev`) mà mọi nhân viên mở được trên điện thoại/máy tính, không phụ thuộc máy của bạn.

> **Vì sao không deploy thẳng từ máy này:** máy bạn là Windows **ARM64**, không chạy được công cụ build của Cloudflare (`workerd`). Nên ta để **Cloudflare tự build từ GitHub** (Cách A — khuyến nghị), hoặc build từ **một máy khác** không phải ARM64 (Cách B).

---

## Chuẩn bị chung (làm 1 lần)

### Bước 1 — Tạo tài khoản Cloudflare (miễn phí)
Vào https://dash.cloudflare.com/sign-up, đăng ký. Gói Free đủ dùng cho CRM này.

### Bước 2 — Tạo cơ sở dữ liệu D1
1. Trong dashboard: **Storage & Databases → D1 SQL Database → Create**.
2. Đặt tên: `tien-nga-crm` → **Create**.
3. Mở database vừa tạo, copy **Database ID** (chuỗi dạng `xxxxxxxx-xxxx-...`).
4. Mở file `wrangler.jsonc` trong dự án, dán ID đó vào chỗ `PASTE_YOUR_D1_DATABASE_ID_HERE`, lưu lại.

### Bước 3 — Nạp cấu trúc bảng vào D1 (chạy migration, KHÔNG cần cài gì trên máy)
1. Trong database `tien-nga-crm` → tab **Console** (hoặc **Query**).
2. Mở lần lượt 4 file trong thư mục `drizzle/` theo đúng thứ tự, **copy toàn bộ nội dung** và dán vào Console rồi bấm **Run**:
   - `drizzle/0000_black_mandarin.sql`
   - `drizzle/0001_foamy_jubilee.sql`
   - `drizzle/0002_absurd_spencer_smythe.sql`
   - `drizzle/0003_b2c_customer_fields.sql`
3. Dòng `--> statement-breakpoint` là ghi chú, cứ để nguyên, không sao cả.

> Sau bước này database đã có đủ bảng/cột. Dữ liệu mẫu ~24 khách sẽ tự nạp khi mở app lần đầu.

---

## Cách A — Cloudflare tự build từ GitHub (khuyến nghị)

### A1. Đưa code lên GitHub
- Tạo tài khoản GitHub (nếu chưa có): https://github.com
- Tạo 1 repository **Private** tên `tien-nga-home-crm`.
- Đẩy code lên (dự án đã được `git init` sẵn — xem phần "Đẩy code lên GitHub" cuối file).

### A2. Kết nối Cloudflare với GitHub
1. Dashboard → **Workers & Pages → Create → Workers → Import a repository** (Connect to Git).
2. Chọn repo `tien-nga-home-crm`.
3. Cấu hình build:
   - **Build command:** `SITES_CLOUDFLARE_BUILD=1 npm run build:vinext`
   - **Deploy command:** `npx wrangler deploy`
4. **Save and Deploy.** Cloudflare sẽ build trên máy chủ Linux của họ (không dính lỗi ARM64).

### A3. Gắn D1 vào Worker
Sau khi deploy lần đầu: mở Worker vừa tạo → **Settings → Bindings → Add → D1 database** → Variable name `DB` → chọn database `tien-nga-crm` → Save. (Hoặc để `wrangler.jsonc` tự khai báo — nếu bạn đã điền đúng `database_id` ở Bước 2 thì không cần bước này.)

### A4. Xong
Mở URL Cloudflare cấp (dạng `https://tien-nga-home-crm.<tên>.workers.dev`). Gửi link này cho nhân viên.

---

## Cách B — Deploy từ một máy KHÁC (Windows x64 hoặc Mac)

Nếu bạn có 1 máy tính khác không phải ARM64:
```bash
# 1. Cài Node.js 22+, rồi copy/clone dự án về máy đó
npm install
# 2. Đăng nhập Cloudflare (mở trình duyệt)
npx wrangler login
# 3. (Nếu chưa tạo ở Bước 2) tạo D1 + copy id vào wrangler.jsonc
npx wrangler d1 create tien-nga-crm
# 4. Nạp migration lên D1 remote
npx wrangler d1 migrations apply tien-nga-crm --remote
# 5. Build + deploy
set SITES_CLOUDFLARE_BUILD=1   # Windows CMD;  macOS/Linux: export SITES_CLOUDFLARE_BUILD=1
npm run build:vinext
npx wrangler deploy
```

---

## Đẩy code lên GitHub (từ máy này cũng được — git chạy bình thường trên ARM64)

Dự án đã được khởi tạo git sẵn. Sau khi tạo repo rỗng trên GitHub, chạy trong thư mục dự án:
```bash
git remote add origin https://github.com/<tên-github>/tien-nga-home-crm.git
git branch -M main
git push -u origin main
```
(GitHub sẽ hỏi đăng nhập/token của bạn — đây là bước cần tài khoản của bạn.)

---

## Lưu ý quan trọng
- **Đây là stack beta (vinext).** Nếu Cloudflare báo lỗi ở bước build/deploy, gửi tôi nội dung log lỗi — tôi sẽ chỉnh lệnh build/deploy hoặc cấu hình cho khớp.
- **Bảo mật:** CRM này chưa có đăng nhập (theo thiết kế). Khi đã công khai trên internet, ai có link đều xem được. Nếu cần giới hạn, bật **Cloudflare Access** (Zero Trust) cho Worker để chỉ nhân viên đăng nhập email công ty mới vào được — tôi có thể hướng dẫn thêm.
- **Dữ liệu:** D1 trên Cloudflare là dữ liệu thật của team, tách biệt hoàn toàn với file test cục bộ `.local-data/`.
