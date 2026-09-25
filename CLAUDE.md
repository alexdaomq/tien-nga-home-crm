# Bàn giao CRM Tiến Nga Home — v2 (thiết kế lại theo mô hình B2C)

Đây là bản thiết kế lại của CRM B2C Tiến Nga Home, dựa trên khung cũ (`Tien-Nga-Home-CRM-Claude-Code.zip`, bàn giao từ ChatGPT/Codex) và toàn bộ phân tích mô hình B2C đã có (phễu quảng cáo Facebook, playbook bán chéo theo giai đoạn công trình, 8 chỉ số vận hành). Giữ nguyên bộ khung kỹ thuật (Next.js + vinext + Cloudflare D1 + Drizzle) để có thể dán đè lên dự án cũ trên nền tảng ChatGPT Sites.

## Vì sao thiết kế lại thay vì sửa tiếp bản cũ

Bản v1 quản lý tốt lead/task/nhật ký nhưng thiếu 3 thứ mà quá trình phân tích mô hình B2C đã chỉ ra là khoảng trống:
1. Không có khái niệm **hồ sơ công trình** — mỗi đơn là một dòng rời, không gộp được nhiều đơn của cùng một căn nhà.
2. Không có **giai đoạn thi công** — nên không biết đúng lúc để gọi bán chéo thiết bị vệ sinh/bếp trước khi khách ốp lát/đóng tủ.
3. Không đo được **8 chỉ số phễu B2C** (CPL hợp lệ, % trong vùng, SLA gọi lần 1, lý do mất khách...) — mọi quyết định về quảng cáo đều là đoán.

## Chạy dự án

```bash
npm install
npm run dev
```

Trên máy Windows ARM64, `npm install` sẽ báo lỗi ở gói `workerd` (không có bản build cho nền tảng này) — dùng `npm install --ignore-scripts` để cài, không ảnh hưởng tới `npm run build`. Đây là hạn chế của máy dev cục bộ, bản build/host thật trên Cloudflare không gặp vấn đề này.

### Test cục bộ có dữ liệu thật (không cần tài khoản Cloudflare/OpenAI)

Máy Windows ARM64 không chạy được Cloudflare D1 cục bộ, nên `build/cloudflare-workers-stub.ts` tự thay bằng một CSDL SQLite chạy qua `sql.js` (WASM, không cần cài native binary) khi phát hiện không có runtime Cloudflare thật. Nó giả lập đúng API `prepare().bind().run()/.all()/.first()` của D1 nên toàn bộ Drizzle và cả route `suppliers` (dùng D1 thô) chạy được nguyên trạng, không cần sửa gì thêm.

- Dữ liệu lưu tại `.local-data/dev.sqlite` (đã gitignore), tự tạo + tự chạy migration khi chưa có file.
- Muốn xoá hết làm lại từ đầu (về lại dữ liệu mẫu): dừng server rồi xoá thư mục `.local-data/`.
- Đây **chỉ dùng để test cục bộ**. Khi dán code này lên ChatGPT Sites, biến môi trường `SITES_CLOUDFLARE_BUILD=1` mà nền tảng đó tự đặt sẽ khiến app dùng thẳng Cloudflare D1 thật, bỏ qua hoàn toàn phần giả lập này.

Kiểm tra trước khi bàn giao:

```bash
npm run build
```

## Cấu trúc quan trọng

- `db/schema.ts`: 7 bảng — `customers` (khách hàng/lead, đủ trường đo phễu), `projects` (hồ sơ công trình), `project_items` (checklist bán chéo theo phòng × hạng mục), `tasks` (việc cần làm, gồm cả nhắc bán chéo tự động), `activities` (nhật ký), `daily_metrics` (chi ads theo ngày), `app_settings` (biên lợi nhuận dùng tính CPL trần).
- `db/enums.ts`: danh sách giá trị hợp lệ dùng chung API + UI. `lib/labels.ts`: nhãn tiếng Việt tương ứng.
- `app/page.tsx`: khung chính (sidebar, Dashboard, Khách hàng, form thêm/sửa khách, drawer chi tiết khách hàng).
- `app/components/ProjectsView.tsx`: tab Công trình — checklist bán chéo dạng lưới (phòng × hạng mục), bấm để đổi trạng thái Chưa mua/Tại Tiến Nga/Nơi khác.
- `app/components/TaskBoards.tsx`: Việc cần làm (lịch 7 ngày), Lịch hẹn, Việc đã làm.
- `app/components/MetricsView.tsx`: nhập chi ads theo ngày, hiển thị 8+ chỉ số phễu, 4 chỉ số bán chéo, và khoá bí mật/hướng dẫn tích hợp AI tự động (xem mục riêng bên dưới).
- `app/api/customers/webhook/route.ts`: điểm nối cho n8n/AI ghi khách hàng tự động từ Business Suite (xem mục "Tích hợp AI tự động" bên dưới).
- `app/supplier-directory.tsx`, `app/api/suppliers/route.ts`: **giữ nguyên y hệt bản cũ**, không đổi.
- `.openai/hosting.json`: giữ nguyên `project_id`/binding `DB` như bản cũ — để khi dán đè, kết nối đúng cơ sở dữ liệu D1 hiện tại (xem mục Di chuyển dữ liệu bên dưới, việc kết nối đúng DB không đồng nghĩa dữ liệu cũ tự đổi sang cấu trúc mới).

## Cập nhật v2.1 — lấy Next Action làm trung tâm (P0 theo brief B2C mới)

Bản v2.1 giữ nguyên stack (vinext + Drizzle + D1/sql.js), tab Nhà cung cấp, cơ chế "chọn người nhập" (không thêm màn hình đăng nhập) và toàn bộ logic v2 ở trên. Bổ sung:

- **Cột mới trên `customers`** (migration cộng thêm `drizzle/0003_b2c_customer_fields.sql`, chỉ `ADD COLUMN`, an toàn với DB đang chạy): `zalo`, `project_stage`, `number_of_floors`, `number_of_bathrooms`, `estimated_tile_date`, `estimated_bathroom_install_date`, `budget_min/max`, `interested_products` (JSON mảng), `main_concern`, `objection`, `decision_maker`, `competitor`, `next_action_type`, `next_action_time`, `lost_note`, `lost_competitor`, `lost_at`, `lost_by`.
- **Enums mới** (`db/enums.ts`): thêm 3 stage (`arrived`, `site_survey`, `negotiating`) vào `FUNNEL_STAGES`; `PIPELINE_STAGES` (9 cột Kanban) + `OFF_PIPELINE_STAGES`; `PROJECT_STAGES`, `PROJECT_TYPES`, `OBJECTIONS`, `INTERESTED_PRODUCTS`, `ACTION_TYPES` (16 loại next action), mở rộng `LOSS_REASONS` (11 lý do) và `SOURCES`, thêm `ROLES`. Nhãn tương ứng trong `lib/labels.ts`. `PRIORITIES` giữ khoá cũ hot/warm/cold nhưng đổi nhãn cold → "Nuôi dưỡng" (lead_temperature HOT/WARM/NURTURE).
- **Vai trò** (`lib/types.ts`): `TEAM` gắn role sales/manager; `roleOf()`. Không có login — lọc dữ liệu theo `owner`/`assignedTo` ở client (`app/page.tsx`) khi công tắc "giới hạn theo sale" bật; manager luôn thấy tất cả.
- **Cờ cảnh báo** (`lib/flags.ts`): `computeCustomerFlags` tính is_overdue, needs_follow_up, has_next_action, is_hot_at_risk (HOT >48h theo `updatedAt`), quote_needs_follow_up (>24h ở stage `quoted`), showroom_today, site_visit_today.
- **Component mới** (`app/components/`): `TodayView` (Việc hôm nay 5 nhóm), `PipelineBoard` (Kanban kéo/thả HTML5), `CustomerDetail` (drawer hồ sơ + khối Next Action nổi bật + timeline), `CustomerForm` (tạo tối thiểu / sửa đầy đủ), `NextActionModal` (bắt buộc sau khi hoàn thành việc), `LostReasonModal` (bắt buộc chọn lý do mất). Dashboard/CustomersTable/Settings nằm trong `app/page.tsx`.
- **Next Action = việc denormalize trên khách**: `nextAction` + `nextContactDate` + `nextActionTime` + `owner` → tự sinh task `auto_followup` (đã có sẵn ở `app/api/tasks/route.ts`, nay bỏ qua khách `lost`/`paused`). Hoàn thành task → modal bắt buộc đặt next action mới; API `PATCH /api/customers` chặn chuyển `lost` nếu thiếu `lossReason` và tự ghi `lost_at`/`lost_by`.
- **Seed** tách ra `db/seed.ts` (`buildSeedCustomers()`), ~24 khách với ngày tính tương đối theo hôm nay.

Chưa làm (P1/P2): quản lý báo giá nhiều phiên bản, báo cáo nâng cao, notifications realtime; tích hợp Zalo/Facebook/AI — chỉ chuẩn bị kiến trúc.

## Logic tự động quan trọng cần biết

- **Nhắc bán chéo tự động** (`app/api/tasks/route.ts`, hàm `syncCrossSellTasks`): mỗi khi tải "Việc cần làm", hệ thống quét các công trình đang triển khai có ngày giao gạch, tự sinh 4 việc theo lịch thi công (kiểm tra hàng · chốt TBVS trước ốp lát · xin ảnh + hỏi kế hoạch bếp · chốt đơn bếp) — đúng tinh thần Playbook bán chéo. Mốc ngày là kiến thức ngành phổ thông, có thể chỉnh trong hằng số `CROSS_SELL_TOUCHPOINTS`.
- **SLA gọi lần 1**: khi sửa một khách hàng và đổi "Kết quả liên hệ" sang "Đã liên hệ được" lần đầu, hệ thống tự ghi giờ hiện tại vào `firstCallAt` nếu trường này đang trống — dùng để tính "thời gian gọi lần 1 (trung vị)" ở Dashboard.
- **CPL trần** = AOV × biên lợi nhuận × (%chốt × %đến × %liên hệ) — biên lợi nhuận chỉnh ở tab Chỉ số vận hành.

## Tích hợp AI tự động — n8n / Business Suite ghi khách hàng vào CRM

`app/api/customers/webhook/route.ts` — điểm nối cho n8n khi AI đọc hội thoại Messenger/Instagram trong Meta Business Suite và trích được đủ họ tên + SĐT (kèm địa chỉ nếu có). Đây là AI tầng hậu trường (đọc/ghi dữ liệu), **không phải** AI trả lời khách — đúng ranh giới đã thống nhất ("AI đứng sau lưng sale"), sale vẫn là người trực tiếp trò chuyện trên Business Suite.

- **Xác thực**: header `x-webhook-secret` phải khớp khoá lưu trong `app_settings.webhookSecret`. Lấy/tạo lại khoá ở tab **Chỉ số vận hành → Tích hợp AI tự động** (có nút "Tạo khoá mới" — tạo khoá mới thì khoá cũ ngừng hoạt động ngay).
- **Body JSON**: `{ fullName, phone, address?, ward?, source?, channel?, note?, conversationUrl? }` — chỉ `fullName` và `phone` bắt buộc. Xem ví dụ đầy đủ ngay trong giao diện (mục "Body mẫu để n8n gửi lên").
- **Logic upsert theo số điện thoại** (so khớp bỏ qua khoảng trắng/dấu gạch):
  - Chưa có khách với SĐT đó → tạo mới, `funnelStage="lead"`, `owner="Chưa phân công"`, `enteredBy="AI Business Suite"` — sale phải tự nhận và xác nhận lại, AI không tự gán người phụ trách hay đẩy trạng thái.
  - Đã có khách với SĐT đó → **không ghi đè** trường đã có sẵn dữ liệu. Nếu địa chỉ mới khác địa chỉ cũ, KHÔNG tự sửa — chỉ ghi một dòng nhật ký cảnh báo "CHÚ Ý: địa chỉ khác..." để sale kiểm tra tay. Tránh AI làm hỏng dữ liệu đã xác minh.
  - Luôn ghi một dòng vào nhật ký hoạt động (`activities`, `enteredBy="AI Business Suite"`) để có dấu vết, xem được trong drawer chi tiết khách hàng.
- **Luồng n8n gợi ý**: Business Suite webhook (tin nhắn mới) → node AI trích xuất họ tên/SĐT/địa chỉ từ nội dung chat → node kiểm tra đã trích đủ tối thiểu họ tên + SĐT chưa (nếu chưa thì dừng, chờ tin tiếp theo) → HTTP Request POST tới endpoint trên kèm header `x-webhook-secret`.
- Đã tự kiểm thử: thiếu/sai khoá → 401; tạo mới đúng; gửi lại cùng SĐT với địa chỉ khác → cập nhật đúng kiểu "cảnh báo, không ghi đè".

## Nhắc hẹn qua Lịch iPhone (không cần Zalo OA / n8n / tài khoản ngoài)

`lib/calendar-feed.ts` + `app/api/calendar/route.ts` — sinh feed `.ics` (iCalendar chuẩn) riêng cho từng người, đăng ký một lần trong app Lịch trên iPhone (Cài đặt → Lịch → Thêm lịch đăng ký, hoặc bấm thẳng link `webcal://`). Sau đó Việc cần làm/Lịch hẹn tự đồng bộ vào, kèm **nhắc giờ bằng thông báo hệ thống của iOS** (`VALARM`) — trước 2 tiếng cho việc loại `appointment` (đúng SOP "nhắc hẹn trước 2 giờ"), trước 30 phút cho việc khác.

- **Vì sao chọn cách này thay vì Telegram/SMS/push riêng**: không cần tài khoản Meta/Zalo, không cần n8n chạy nền — CRM tự sinh file `.ics` theo yêu cầu mỗi khi iPhone đồng bộ (mặc định vài giờ một lần, do iOS tự quyết định tần suất, không chỉnh được chính xác).
- **Bảo mật từng người một**: mỗi link có token riêng = `sha256(tên người + calendarSecret)`, tính ở cả server (`db/index.ts`, `getOrCreateSettings`) và client (`lib/calendar-feed.ts` dùng chung, chạy được cả trong trình duyệt vì chỉ dựa vào Web Crypto API chuẩn). Không cần bảng lưu token riêng.
- **Lấy link**: tab **Chỉ số vận hành → Nhắc hẹn qua Lịch trên iPhone** — có sẵn nút "Mở trên điện thoại" (bấm trực tiếp trên iPhone bằng Safari) và "Sao chép". Nút "Tạo lại toàn bộ link lịch" đổi `calendarSecret`, làm mọi link cũ hỏng ngay — chỉ dùng khi nghi ngờ link bị lộ.
- **Giới hạn cần biết**: đây là lịch "đăng ký" (subscribe), không phải lịch hai chiều — sửa/xoá việc trong CRM sẽ cập nhật lại lịch, nhưng người dùng không sửa được việc từ ngay trong app Lịch. Tần suất đồng bộ do iOS quyết định, không tức thời như push notification thật.

## Nguyên tắc khi chỉnh sửa (giữ từ bản v1)

1. Không thêm màn hình đăng nhập.
2. Chỉ chọn người đang nhập dữ liệu trong giao diện (góc trên bên phải).
3. Giữ font dễ đọc, tiếng Việt có dấu hiển thị đúng, tối ưu cho điện thoại và máy tính.
4. Màu nhận diện: xanh lá và cam Tiến Nga (dùng lại toàn bộ `app/globals.css` của bản v1).
5. Tab Nhà cung cấp độc lập hoàn toàn với các tab còn lại — không đổi.
6. Không tự xoá hoặc thay đổi cấu trúc cơ sở dữ liệu đang chạy nếu chưa sao lưu.
7. Theo playbook AI, chỉ tự động hoá tầng "if-then" (n8n/automation thuần) trong CRM — không thêm chatbot/AI chạm khách vào giao diện này.

## Di chuyển dữ liệu từ bản v1 (QUAN TRỌNG — đọc trước khi phát hành)

Bản v2 đổi tên bảng `leads` → `customers`, đổi `lead_id` → `customer_id` ở `activities`/`tasks`, và thêm nhiều bảng/cột mới. Đây **không phải** một migration tương thích ngược tự động. Trước khi dán đè code này lên dự án đang chạy:

1. **Xuất/sao lưu dữ liệu D1 hiện tại** (bảng `leads`, `activities`, `tasks`, `supplier_directory`) — theo đúng cảnh báo đã có ở CLAUDE.md bản v1.
2. Chạy đủ 3 file migration theo thứ tự trong thư mục `drizzle/` (`0000_black_mandarin.sql`, `0001_foamy_jubilee.sql` thêm cột `webhook_secret`, `0002_absurd_spencer_smythe.sql` thêm cột `calendar_secret`) để tạo các bảng mới (`customers`, `projects`, `project_items`, `daily_metrics`, `app_settings`) — bảng `supplier_directory` không đổi, không cần chạm.
3. Nếu muốn giữ lại lịch sử khách hàng cũ thay vì bắt đầu lại từ đầu, cần tự chạy thêm SQL đổi tên bảng/cột `leads`→`customers`, `lead_id`→`customer_id` trước bước 2 (D1/SQLite hỗ trợ `ALTER TABLE ... RENAME`). Việc này **chưa được kiểm thử với dữ liệu thật** của Tiến Nga — nên thử trên một bản sao D1 trước, không chạy thẳng trên DB đang phục vụ khách.
4. Nếu chấp nhận bắt đầu lại (khuyến nghị nếu dữ liệu cũ còn ít): chỉ cần chạy migration bước 2, bỏ qua bước 3, và nhập lại thủ công các khách hàng đang mở.

Quyết định "giữ lịch sử cũ" hay "bắt đầu lại" là quyết định của Tuấn, không tự ý chọn khi triển khai.
