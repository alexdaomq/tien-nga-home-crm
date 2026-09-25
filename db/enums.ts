// Danh sách giá trị hợp lệ dùng chung giữa API và giao diện.
// Giữ khoá tiếng Anh/không dấu trong DB, nhãn tiếng Việt chỉ hiển thị ở UI (lib/labels.ts).

// Toàn bộ giá trị hợp lệ của cột customers.funnel_stage (gồm cả giá trị cũ "delivering"
// để không phá dữ liệu bản v1). Thứ tự cột Kanban dùng PIPELINE_STAGES bên dưới.
export const FUNNEL_STAGES = [
  "lead",
  "consulting",
  "appointment",
  "arrived",
  "site_survey",
  "quoted",
  "negotiating",
  "won",
  "delivering",
  "aftercare",
  "lost",
  "paused",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

// 9 cột pipeline chính theo brief B2C (kéo/thả giữa các cột này).
export const PIPELINE_STAGES = [
  "lead",
  "consulting",
  "appointment",
  "arrived",
  "site_survey",
  "quoted",
  "negotiating",
  "won",
  "aftercare",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

// Ngoài pipeline chính: tạm hoãn & mất khách.
export const OFF_PIPELINE_STAGES = ["paused", "lost"] as const;

// Giá trị cũ được gom về cột nào khi hiển thị Kanban.
export const STAGE_ALIAS: Record<string, string> = {
  delivering: "won",
};

// lead_temperature theo brief: HOT / WARM / NURTURE. Giữ khoá DB cũ (hot/warm/cold)
// để không phải migrate dữ liệu — chỉ đổi nhãn "cold" thành "Nuôi dưỡng" ở labels.
export const PRIORITIES = ["hot", "warm", "cold"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CONTACT_RESULTS = [
  "chua_lien_he",
  "da_lien_he",
  "khong_bat_may",
  "sai_so",
  "tu_choi",
] as const;
export type ContactResult = (typeof CONTACT_RESULTS)[number];

// Dùng cho customers.constructionStageAtLead và projects.constructionStage (bản v1, thô).
export const CONSTRUCTION_STAGES = [
  "chua_khoi_cong",
  "xay_tho",
  "chuan_bi_op_lat",
  "hoan_thien",
  "sua_nha",
] as const;
export type ConstructionStage = (typeof CONSTRUCTION_STAGES)[number];

// Giai đoạn thi công chi tiết của khách (customers.projectStage) — theo brief.
export const PROJECT_STAGES = [
  "dang_thiet_ke",
  "chuan_bi_khoi_cong",
  "xay_tho",
  "di_dien_nuoc",
  "dang_trat",
  "chuan_bi_lat_gach",
  "chuan_bi_lap_tbvs",
  "hoan_thien",
  "da_hoan_thanh",
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

// Loại công trình (customers.projectType) — theo brief.
export const PROJECT_TYPES = ["xay_moi", "cai_tao", "sua_chua", "khac"] as const;
export type ProjectTypeValue = (typeof PROJECT_TYPES)[number];

// Phản đối thường gặp (customers.objection) — theo brief.
export const OBJECTIONS = [
  "gia",
  "mau",
  "mau_sac",
  "dang_tham_khao",
  "cho_vo_chong",
  "chua_den_giai_doan",
  "khac",
] as const;
export type Objection = (typeof OBJECTIONS)[number];

// Nhu cầu sản phẩm (multi-select, lưu JSON mảng trong customers.interestedProducts).
export const INTERESTED_PRODUCTS = [
  "Gạch lát nền",
  "Gạch ốp tường",
  "Bồn cầu",
  "Lavabo",
  "Sen tắm",
  "Vòi",
  "Gương",
  "Phụ kiện",
  "Bình nóng lạnh",
  "Bếp",
  "Khác",
] as const;
export type InterestedProduct = (typeof INTERESTED_PRODUCTS)[number];

// Lý do mất khách (bắt buộc khi chuyển sang "Mất khách") — theo brief.
export const LOSS_REASONS = [
  "gia",
  "mua_noi_khac",
  "khong_co_mau_phu_hop",
  "khong_lien_he_duoc",
  "chua_xay",
  "thay_doi_ke_hoach",
  "xa_khu_vuc",
  "chong_vo_chua_dong_y",
  "chi_tham_khao",
  "sale_cham_soc_cham",
  "khac",
] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

export const PROJECT_STATUSES = ["dang_trien_khai", "tam_dung", "hoan_tat"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_ROOMS = ["WC1", "WC2", "WC3", "Bếp", "Cả nhà"] as const;
export type ProjectRoom = (typeof PROJECT_ROOMS)[number];

export const PROJECT_CATEGORIES = [
  "Gạch ốp lát",
  "Thiết bị vệ sinh",
  "Sen vòi & phụ kiện",
  "Tủ bếp & thiết bị bếp",
  "Khác",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PURCHASE_STATUSES = ["tien_nga", "noi_khac", "chua_mua"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const TASK_TYPES = ["call", "followup", "appointment", "auto_followup", "cross_sell"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

// Loại "việc tiếp theo" (Next Action) hiển thị trong modal bắt buộc sau khi hoàn thành việc.
export const ACTION_TYPES = [
  "goi_khach",
  "nhan_zalo",
  "gui_mau",
  "gui_hinh_anh",
  "gui_phoi_canh",
  "gui_bao_gia",
  "moi_showroom",
  "xac_nhan_lich_showroom",
  "khao_sat_cong_trinh",
  "mang_mau",
  "follow_bao_gia",
  "xu_ly_phan_doi",
  "thu_coc",
  "xac_nhan_giao_hang",
  "hau_mai",
  "khac",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

// Ánh xạ Next Action -> loại task hợp lệ để lưu vào bảng tasks (tasks.type).
export const ACTION_TYPE_TO_TASK_TYPE: Record<string, "call" | "appointment" | "followup"> = {
  goi_khach: "call",
  moi_showroom: "appointment",
  xac_nhan_lich_showroom: "appointment",
  khao_sat_cong_trinh: "appointment",
};

export const SOURCES = [
  "Facebook",
  "Facebook Ads",
  "TikTok",
  "Website",
  "Zalo",
  "Hotline",
  "Showroom",
  "Khách giới thiệu",
  "Khách cũ",
  "Khác",
] as const;

export const ROLES = ["sales", "manager"] as const;
export type Role = (typeof ROLES)[number];

// Loại tài liệu gửi khách (upload file thật lên R2).
export const DOC_TYPES = ["bao_gia", "phoi_canh", "hinh_anh", "hop_dong", "khac"] as const;
export type DocType = (typeof DOC_TYPES)[number];
