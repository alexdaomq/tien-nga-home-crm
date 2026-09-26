// Nhãn tiếng Việt hiển thị trên giao diện cho các mã lưu trong DB (db/enums.ts).

export const FUNNEL_STAGE_LABEL: Record<string, string> = {
  lead: "Lead mới",
  consulting: "Đang tư vấn",
  appointment: "Hẹn showroom",
  arrived: "Đã đến showroom",
  site_survey: "Khảo sát công trình",
  quoted: "Đã báo giá",
  negotiating: "Follow-up / Đàm phán",
  won: "Đã chốt",
  delivering: "Đang giao/lắp",
  aftercare: "Hoàn thành / Hậu mãi",
  lost: "Không chốt",
  paused: "Tạm hoãn",
};

export const FUNNEL_STAGE_COLOR: Record<string, string> = {
  lead: "#3a7bd5",
  consulting: "#f5a623",
  appointment: "#9b59b6",
  arrived: "#7d5bd0",
  site_survey: "#0f9b8e",
  quoted: "#e4542d",
  negotiating: "#d86400",
  won: "#08751d",
  delivering: "#128f18",
  aftercare: "#0f9b8e",
  lost: "#94a3a0",
  paused: "#8b8b8b",
};

// lead_temperature: HOT / WARM / NURTURE (khoá DB giữ nguyên hot/warm/cold).
export const PRIORITY_LABEL: Record<string, string> = {
  hot: "Nóng",
  warm: "Ấm",
  cold: "Nuôi dưỡng",
};

export const PRIORITY_EMOJI: Record<string, string> = {
  hot: "🔥",
  warm: "🟡",
  cold: "🔵",
};

export const PRIORITY_COLOR: Record<string, string> = {
  hot: "#e4542d",
  warm: "#f5a623",
  cold: "#3a7bd5",
};

export const CONTACT_RESULT_LABEL: Record<string, string> = {
  chua_lien_he: "Chưa liên hệ",
  da_lien_he: "Đã liên hệ được",
  khong_bat_may: "Không bắt máy",
  sai_so: "Sai số điện thoại",
  tu_choi: "Từ chối trao đổi",
};

export const CONSTRUCTION_STAGE_LABEL: Record<string, string> = {
  chua_khoi_cong: "Chưa khởi công",
  xay_tho: "Đang xây thô",
  chuan_bi_op_lat: "Chuẩn bị ốp lát",
  hoan_thien: "Đang hoàn thiện",
  sua_nha: "Đang sửa nhà",
};

// Giai đoạn thi công chi tiết (customers.projectStage).
export const PROJECT_STAGE_LABEL: Record<string, string> = {
  "": "Chưa rõ",
  dang_thiet_ke: "Đang thiết kế",
  chuan_bi_khoi_cong: "Chuẩn bị khởi công",
  xay_tho: "Xây thô",
  di_dien_nuoc: "Đi điện nước",
  dang_trat: "Đang trát",
  chuan_bi_lat_gach: "Chuẩn bị lát gạch",
  chuan_bi_lap_tbvs: "Chuẩn bị lắp TBVS",
  hoan_thien: "Hoàn thiện",
  da_hoan_thanh: "Đã hoàn thành",
};

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  "": "Chưa rõ",
  xay_moi: "Xây mới",
  cai_tao: "Cải tạo",
  sua_chua: "Sửa chữa",
  khac: "Khác",
};

export const OBJECTION_LABEL: Record<string, string> = {
  "": "Không có",
  gia: "Giá",
  mau: "Mẫu",
  mau_sac: "Màu sắc",
  dang_tham_khao: "Đang tham khảo",
  cho_vo_chong: "Chờ vợ/chồng",
  chua_den_giai_doan: "Chưa đến giai đoạn mua",
  khac: "Khác",
};

export const LOSS_REASON_LABEL: Record<string, string> = {
  "": "Chưa xác định",
  gia: "Giá",
  mua_noi_khac: "Mua nơi khác",
  khong_co_mau_phu_hop: "Không có mẫu phù hợp",
  khong_lien_he_duoc: "Không liên hệ được",
  chua_xay: "Chưa xây",
  thay_doi_ke_hoach: "Thay đổi kế hoạch",
  xa_khu_vuc: "Xa khu vực",
  chong_vo_chua_dong_y: "Chồng/vợ chưa đồng ý",
  chi_tham_khao: "Khách chỉ tham khảo",
  sale_cham_soc_cham: "Sales chăm sóc chậm",
  khac: "Lý do khác",
  // Nhãn cho khoá cũ bản v1 (dữ liệu cũ vẫn hiển thị đúng).
  da_mua_cho_khac: "Đã mua chỗ khác",
  ngoai_vung: "Ngoài vùng phục vụ",
  chua_toi_luc: "Chưa tới lúc mua",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  dang_trien_khai: "Đang triển khai",
  tam_dung: "Tạm dừng",
  hoan_tat: "Hoàn tất",
};

export const PURCHASE_STATUS_LABEL: Record<string, string> = {
  tien_nga: "Mua tại Tiến Nga",
  noi_khac: "Mua nơi khác",
  chua_mua: "Chưa mua",
};

export const PURCHASE_STATUS_COLOR: Record<string, string> = {
  tien_nga: "#08751d",
  noi_khac: "#e4542d",
  chua_mua: "#94a3a0",
};

export const TASK_TYPE_LABEL: Record<string, string> = {
  call: "Gọi điện",
  followup: "Theo dõi",
  appointment: "Lịch hẹn",
  auto_followup: "Việc tiếp theo",
  cross_sell: "Bán chéo công trình",
};

// Nhãn cho từng loại Next Action (modal việc tiếp theo).
export const ACTION_TYPE_LABEL: Record<string, string> = {
  goi_khach: "Gọi khách",
  nhan_zalo: "Nhắn Zalo",
  gui_mau: "Gửi mẫu",
  gui_hinh_anh: "Gửi hình ảnh",
  gui_phoi_canh: "Gửi phối cảnh",
  gui_bao_gia: "Gửi báo giá",
  moi_showroom: "Mời showroom",
  xac_nhan_lich_showroom: "Xác nhận lịch showroom",
  khao_sat_cong_trinh: "Khảo sát công trình",
  mang_mau: "Mang mẫu",
  follow_bao_gia: "Follow báo giá",
  xu_ly_phan_doi: "Xử lý phản đối",
  thu_coc: "Thu cọc",
  xac_nhan_giao_hang: "Xác nhận giao hàng",
  hau_mai: "Hậu mãi",
  khac: "Khác",
};

export const ROLE_LABEL: Record<string, string> = {
  sales: "Nhân viên sale",
  manager: "Quản lý / Admin",
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  bao_gia: "Báo giá",
  phoi_canh: "Phối cảnh 3D",
  hinh_anh: "Hình ảnh",
  hop_dong: "Hợp đồng",
  khac: "Tài liệu khác",
};
