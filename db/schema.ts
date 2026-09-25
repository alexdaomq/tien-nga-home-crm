import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Khách hàng / lead — một dòng = một khách, đi kèm đủ trường để đo 8 chỉ số phễu B2C
// (xem wiki "Sổ tay triển khai phễu B2C" — Tab LEAD).
export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leadCode: text("lead_code").notNull().default(""),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull().default(""),
    address: text("address").notNull().default(""),
    ward: text("ward").notNull().default(""),
    inZone: integer("in_zone").notNull().default(1),

    source: text("source").notNull().default("Khác"),
    campaign: text("campaign").notNull().default(""),
    referrer: text("referrer").notNull().default(""),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    constructionStageAtLead: text("construction_stage_at_lead").notNull().default(""),

    funnelStage: text("funnel_stage").notNull().default("lead"),
    priority: text("priority").notNull().default("warm"),
    firstCallAt: text("first_call_at").notNull().default(""),
    contactResult: text("contact_result").notNull().default("chua_lien_he"),
    appointmentDate: text("appointment_date").notNull().default(""),
    arrived: integer("arrived").notNull().default(0),
    closedDate: text("closed_date").notNull().default(""),
    value: integer("value").notNull().default(0),
    itemCount: integer("item_count").notNull().default(0),
    lossReason: text("loss_reason").notNull().default(""),

    need: text("need").notNull().default(""),
    projectType: text("project_type").notNull().default(""),
    stylePreference: text("style_preference").notNull().default(""),
    dimensions: text("dimensions").notNull().default(""),
    purchaseTimeline: text("purchase_timeline").notNull().default(""),
    preferredChannel: text("preferred_channel").notNull().default("Điện thoại"),
    preferredContactTime: text("preferred_contact_time").notNull().default(""),

    expectedCloseDate: text("expected_close_date").notNull().default(""),
    nextContactDate: text("next_contact_date").notNull().default(""),
    notes: text("notes").notNull().default(""),
    owner: text("owner").notNull().default("Chưa phân công"),
    enteredBy: text("entered_by").notNull().default("Chưa rõ"),
    lastContact: text("last_contact").notNull().default("Vừa tạo"),
    nextAction: text("next_action").notNull().default("Liên hệ khách mới"),

    // v2.1 (brief B2C): hồ sơ khách mở rộng + Next Action có loại/giờ.
    zalo: text("zalo").notNull().default(""),
    projectStage: text("project_stage").notNull().default(""),
    numberOfFloors: integer("number_of_floors").notNull().default(0),
    numberOfBathrooms: integer("number_of_bathrooms").notNull().default(0),
    estimatedTileDate: text("estimated_tile_date").notNull().default(""),
    estimatedBathroomInstallDate: text("estimated_bathroom_install_date").notNull().default(""),
    budgetMin: integer("budget_min").notNull().default(0),
    budgetMax: integer("budget_max").notNull().default(0),
    interestedProducts: text("interested_products").notNull().default(""),
    mainConcern: text("main_concern").notNull().default(""),
    objection: text("objection").notNull().default(""),
    decisionMaker: text("decision_maker").notNull().default(""),
    competitor: text("competitor").notNull().default(""),
    nextActionType: text("next_action_type").notNull().default(""),
    nextActionTime: text("next_action_time").notNull().default(""),
    lostNote: text("lost_note").notNull().default(""),
    lostCompetitor: text("lost_competitor").notNull().default(""),
    lostAt: text("lost_at").notNull().default(""),
    lostBy: text("lost_by").notNull().default(""),

    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_customers_phone_unique").on(table.phone),
    index("idx_customers_funnel_updated_at").on(table.funnelStage, table.updatedAt),
    index("idx_customers_priority_stage").on(table.priority, table.funnelStage),
    index("idx_customers_received_at").on(table.receivedAt),
  ],
);

// Hồ sơ công trình — gộp nhiều đơn của cùng một căn nhà, theo dõi giai đoạn thi công
// để biết đúng lúc gọi bán chéo (xem "Playbook bán chéo theo giai đoạn công trình").
export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectCode: text("project_code").notNull().default(""),
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    address: text("address").notNull().default(""),
    ward: text("ward").notNull().default(""),
    area: text("area").notNull().default(""),
    numberOfWc: integer("number_of_wc").notNull().default(1),
    hasKitchen: integer("has_kitchen").notNull().default(0),
    contractorName: text("contractor_name").notNull().default(""),
    constructionStage: text("construction_stage").notNull().default("chua_khoi_cong"),
    tileDeliveredAt: text("tile_delivered_at").notNull().default(""),
    expectedTilingAt: text("expected_tiling_at").notNull().default(""),
    status: text("status").notNull().default("dang_trien_khai"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_projects_customer_id").on(table.customerId),
    index("idx_projects_stage").on(table.constructionStage),
  ],
);

// Checklist hạng mục theo phòng — cột "đã mua ở đâu" là nguồn dữ liệu quý nhất:
// chỗ nào toàn "nơi khác" là chỗ đang mất thị phần trong tay khách của mình.
export const projectItems = sqliteTable(
  "project_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    room: text("room").notNull(),
    category: text("category").notNull(),
    purchaseStatus: text("purchase_status").notNull().default("chua_mua"),
    orderValue: integer("order_value").notNull().default(0),
    purchasedAt: text("purchased_at").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_project_items_room_category").on(table.projectId, table.room, table.category),
    index("idx_project_items_status").on(table.purchaseStatus),
  ],
);

export const activities = sqliteTable(
  "activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    enteredBy: text("entered_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_activities_customer_created_at").on(table.customerId, table.createdAt)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    type: text("type").notNull().default("followup"),
    dueDate: text("due_date").notNull(),
    dueTime: text("due_time").notNull().default(""),
    status: text("status").notNull().default("open"),
    assignedTo: text("assigned_to").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_tasks_due_date_status").on(table.dueDate, table.status),
    index("idx_tasks_customer_id").on(table.customerId),
    index("idx_tasks_project_id").on(table.projectId),
  ],
);

// Tab NGÀY — chỉ chi ads là dữ liệu ngoài thật sự cần nhập tay mỗi ngày; các chỉ số
// còn lại (lead trong vùng, liên hệ được, đến, chốt, doanh thu) tính thẳng từ `customers`.
export const dailyMetrics = sqliteTable(
  "daily_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    adSpend: integer("ad_spend").notNull().default(0),
    notes: text("notes").notNull().default(""),
    enteredBy: text("entered_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_daily_metrics_date").on(table.date)],
);

// Một dòng duy nhất (id = 1) lưu cấu hình dùng để tính CPL trần, khoá bí mật
// cho webhook ghi khách hàng tự động (n8n / AI đọc Business Suite), và khoá
// dùng để sinh link lịch (.ics) riêng cho từng người — xem lib/calendar-feed.ts.
export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  marginRate: integer("margin_rate").notNull().default(25),
  webhookSecret: text("webhook_secret").notNull().default(""),
  calendarSecret: text("calendar_secret").notNull().default(""),
  // Kết nối Trình quản lý quảng cáo Facebook (Marketing API) — token do người dùng dán vào.
  fbAdAccountId: text("fb_ad_account_id").notNull().default(""),
  fbAccessToken: text("fb_access_token").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Tài liệu/báo giá đã gửi cho khách. File thật lưu trên Cloudflare R2 (theo r2Key);
// bảng này chỉ lưu metadata để hiển thị + tải lại. Xem app/api/documents/route.ts.
export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    docType: text("doc_type").notNull().default("bao_gia"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull().default(""),
    r2Key: text("r2_key").notNull(),
    size: integer("size").notNull().default(0),
    amount: integer("amount").notNull().default(0),
    note: text("note").notNull().default(""),
    uploadedBy: text("uploaded_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_documents_customer_created_at").on(table.customerId, table.createdAt)],
);
