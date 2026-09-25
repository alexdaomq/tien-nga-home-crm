// Dữ liệu mẫu ~24 khách, phủ đủ tình huống để test: quá hạn, hôm nay, sắp tới,
// lead mới chưa xử lý, HOT/WARM/Nuôi dưỡng, đã chốt, mất khách, showroom hôm nay,
// khảo sát hôm nay. Ngày được tính tương đối theo hôm nay để "Việc hôm nay" luôn có dữ liệu.
import { addDays, todayISO } from "../lib/format";

type SeedCustomer = {
  fullName: string;
  phone: string;
  source: string;
  campaign?: string;
  ward: string;
  address?: string;
  funnelStage: string;
  priority: string;
  contactResult?: string;
  value?: number;
  itemCount?: number;
  need: string;
  interestedProducts?: string[];
  projectStage?: string;
  projectType?: string;
  numberOfBathrooms?: number;
  budgetMin?: number;
  budgetMax?: number;
  owner: string;
  nextAction?: string;
  nextActionType?: string;
  nextContactDate?: string;
  nextActionTime?: string;
  appointmentDate?: string;
  arrived?: number;
  closedDate?: string;
  estimatedTileDate?: string;
  mainConcern?: string;
  objection?: string;
  competitor?: string;
  lossReason?: string;
  lostNote?: string;
  lastContact?: string;
  notes?: string;
};

export function buildSeedCustomers() {
  const today = todayISO();
  const rows: SeedCustomer[] = [
    // === HOT — đã báo giá, việc hôm nay ===
    {
      fullName: "Nguyễn Văn Nam", phone: "0987 245 610", source: "Facebook", campaign: "Combo phòng tắm T9",
      ward: "Đông Anh", address: "Thôn Lực Canh, Xuân Canh, Đông Anh", funnelStage: "quoted", priority: "hot",
      contactResult: "da_lien_he", value: 86_500_000, itemCount: 12, need: "Gạch ốp lát + trọn bộ 2 WC",
      interestedProducts: ["Gạch lát nền", "Gạch ốp tường", "Bồn cầu", "Lavabo", "Sen tắm"],
      projectStage: "chuan_bi_lat_gach", projectType: "xay_moi", numberOfBathrooms: 2,
      budgetMin: 80_000_000, budgetMax: 100_000_000, owner: "Hương",
      nextAction: "Gửi 2 phối cảnh phòng tắm qua Zalo", nextActionType: "gui_phoi_canh",
      nextContactDate: today, nextActionTime: "09:00", mainConcern: "Muốn xem trước phối cảnh trước khi chốt",
      objection: "dang_tham_khao", lastContact: "ĐÃ GỬI BÁO GIÁ 86,5 TRIỆU QUA ZALO",
      notes: "Khách phân vân màu gạch G01 và G05.",
    },
    // === HOT — follow báo giá (đàm phán) ===
    {
      fullName: "Trần Thị Hương", phone: "0912 663 480", source: "Facebook Ads", campaign: "Gạch 80x80 khuyến mãi",
      ward: "Mê Linh", funnelStage: "negotiating", priority: "hot", contactResult: "da_lien_he",
      value: 42_000_000, itemCount: 6, need: "Gạch 80x80 phòng khách + WC",
      interestedProducts: ["Gạch lát nền", "Gạch ốp tường"], projectStage: "chuan_bi_lat_gach",
      owner: "Liên", nextAction: "Follow báo giá, xử lý phản đối về giá", nextActionType: "follow_bao_gia",
      nextContactDate: today, nextActionTime: "10:30", objection: "gia", competitor: "Viglacera đại lý gần nhà",
      mainConcern: "So sánh giá với đại lý khác", lastContact: "KHÁCH KÊU GIÁ CAO HƠN CHỖ KHÁC 5%",
    },
    // === WARM — hẹn showroom (xác nhận lịch) ===
    {
      fullName: "Lê Văn Tuấn", phone: "0903 178 232", source: "Khách giới thiệu", ward: "Sóc Sơn",
      funnelStage: "appointment", priority: "warm", contactResult: "da_lien_he", value: 55_000_000, itemCount: 9,
      need: "Trọn bộ thiết bị vệ sinh 3 WC", interestedProducts: ["Bồn cầu", "Lavabo", "Sen tắm", "Vòi", "Gương"],
      projectStage: "xay_tho", projectType: "xay_moi", numberOfBathrooms: 3, owner: "Cần",
      nextAction: "Xác nhận lịch showroom sáng mai", nextActionType: "xac_nhan_lich_showroom",
      nextContactDate: today, nextActionTime: "16:00", appointmentDate: addDays(today, 1),
      lastContact: "ĐÃ HẸN KHÁCH LÊN SHOWROOM", notes: "Anh Tuấn được chị Mai (khách cũ) giới thiệu.",
    },
    // === Lead mới CHƯA xử lý (cảnh báo) ===
    {
      fullName: "Phạm Thu Trang", phone: "0977 320 145", source: "Facebook", campaign: "Combo phòng tắm T9",
      ward: "Đông Anh", funnelStage: "lead", priority: "warm", contactResult: "chua_lien_he",
      need: "Hỏi combo phòng tắm nhỏ", interestedProducts: ["Bồn cầu", "Lavabo", "Sen tắm"], owner: "Hương",
      nextAction: "Gọi khách lần đầu trong 5 phút", nextActionType: "goi_khach",
      nextContactDate: today, nextActionTime: "08:30", lastContact: "LEAD MỚI TỪ FACEBOOK, CHƯA GỌI",
    },
    {
      fullName: "Hoàng Minh Đức", phone: "0968 112 900", source: "TikTok", ward: "Mê Linh",
      funnelStage: "lead", priority: "hot", contactResult: "chua_lien_he", need: "Xem mẫu gạch vân đá",
      interestedProducts: ["Gạch lát nền"], owner: "Liên",
      nextAction: "Gọi khách lần đầu", nextActionType: "goi_khach", nextContactDate: today, nextActionTime: "09:15",
      lastContact: "LEAD MỚI TỪ TIKTOK", notes: "Khách bình luận dưới video gạch vân đá.",
    },
    // === QUÁ HẠN (nextContactDate ở quá khứ) ===
    {
      fullName: "Vũ Thị Lan", phone: "0918 445 220", source: "Zalo", ward: "Phúc Yên",
      funnelStage: "consulting", priority: "warm", contactResult: "da_lien_he", value: 15_000_000,
      need: "Gạch ốp bếp", interestedProducts: ["Gạch ốp tường"], projectStage: "dang_trat", owner: "Cần",
      nextAction: "Gửi thêm mẫu gạch ốp bếp", nextActionType: "gui_mau",
      nextContactDate: addDays(today, -3), nextActionTime: "10:00",
      lastContact: "ĐÃ TƯ VẤN NHƯNG CHƯA GỬI MẪU", notes: "Cần theo lại — đã quá hẹn 3 ngày.",
    },
    {
      fullName: "Đặng Quốc Huy", phone: "0906 778 341", source: "Website", ward: "Bắc Từ Liêm",
      funnelStage: "quoted", priority: "hot", contactResult: "da_lien_he", value: 68_000_000, itemCount: 10,
      need: "Trọn bộ phòng tắm cao cấp", interestedProducts: ["Bồn cầu", "Lavabo", "Sen tắm", "Bình nóng lạnh"],
      projectStage: "chuan_bi_lap_tbvs", owner: "Hương",
      nextAction: "Follow báo giá đã gửi tuần trước", nextActionType: "follow_bao_gia",
      nextContactDate: addDays(today, -2), nextActionTime: "15:00", objection: "cho_vo_chong",
      lastContact: "ĐÃ GỬI BÁO GIÁ, CHỜ KHÁCH PHẢN HỒI", notes: "Khách nói chờ vợ quyết.",
    },
    // === Showroom hôm nay ===
    {
      fullName: "Bùi Thị Ngọc", phone: "0935 221 118", source: "Showroom", ward: "Đông Anh",
      funnelStage: "appointment", priority: "hot", contactResult: "da_lien_he", value: 39_000_000,
      need: "Xem mẫu trực tiếp tại showroom", interestedProducts: ["Gạch lát nền", "Bồn cầu", "Lavabo"],
      owner: "Liên", nextAction: "Đón khách tại showroom", nextActionType: "moi_showroom",
      nextContactDate: today, nextActionTime: "14:00", appointmentDate: today,
      lastContact: "KHÁCH HẸN LÊN SHOWROOM CHIỀU NAY",
    },
    // === Khảo sát công trình hôm nay ===
    {
      fullName: "Ngô Văn Sơn", phone: "0908 334 512", source: "Khách giới thiệu", ward: "Sóc Sơn",
      funnelStage: "site_survey", priority: "hot", contactResult: "da_lien_he", value: 72_000_000,
      need: "Khảo sát công trình để tư vấn trọn gói", interestedProducts: ["Gạch lát nền", "Gạch ốp tường", "Bồn cầu", "Sen tắm"],
      projectStage: "xay_tho", numberOfBathrooms: 2, owner: "Cần",
      nextAction: "Khảo sát công trình + đo đạc", nextActionType: "khao_sat_cong_trinh",
      nextContactDate: today, nextActionTime: "08:00", estimatedTileDate: today,
      lastContact: "ĐÃ HẸN KHẢO SÁT CÔNG TRÌNH SÁNG NAY",
    },
    // === Sắp tới (tương lai) ===
    {
      fullName: "Trịnh Thu Hằng", phone: "0912 900 771", source: "Facebook", ward: "Mê Linh",
      funnelStage: "consulting", priority: "warm", contactResult: "da_lien_he", value: 22_000_000,
      need: "Gạch lát nền phòng khách", interestedProducts: ["Gạch lát nền"], owner: "Hương",
      nextAction: "Gửi bảng giá gạch lát nền", nextActionType: "gui_bao_gia",
      nextContactDate: addDays(today, 2), nextActionTime: "10:00", lastContact: "ĐÃ TƯ VẤN QUA ĐIỆN THOẠI",
    },
    {
      fullName: "Lý Văn Thành", phone: "0977 654 001", source: "Zalo", ward: "Phúc Yên",
      funnelStage: "arrived", priority: "hot", contactResult: "da_lien_he", value: 48_000_000, itemCount: 7,
      need: "Đã xem showroom, chốt mẫu", interestedProducts: ["Gạch lát nền", "Bồn cầu", "Sen tắm"],
      projectStage: "chuan_bi_lat_gach", numberOfBathrooms: 2, owner: "Liên", arrived: 1,
      nextAction: "Gửi báo giá sau khi khách xem showroom", nextActionType: "gui_bao_gia",
      nextContactDate: addDays(today, 1), nextActionTime: "09:30", lastContact: "KHÁCH ĐÃ ĐẾN SHOWROOM, ƯNG MẪU G05",
    },
    {
      fullName: "Phan Thị Mai", phone: "0903 221 889", source: "Khách cũ", ward: "Đông Anh",
      funnelStage: "consulting", priority: "cold", contactResult: "da_lien_he", value: 12_000_000,
      need: "Hỏi thêm cho nhà thứ 2", interestedProducts: ["Gạch lát nền", "Gạch ốp tường"], owner: "Cần",
      nextAction: "Nuôi dưỡng — nhắn Zalo hỏi tiến độ", nextActionType: "nhan_zalo",
      nextContactDate: addDays(today, 5), nextActionTime: "10:00", lastContact: "KHÁCH CŨ, ĐANG CÂN NHẮC NHÀ THỨ 2",
    },
    // === HOT at-risk sẽ được mô phỏng qua updatedAt cũ (đặt ở route) ===
    {
      fullName: "Đỗ Mạnh Cường", phone: "0968 445 123", source: "Facebook Ads", ward: "Sóc Sơn",
      funnelStage: "negotiating", priority: "hot", contactResult: "da_lien_he", value: 95_000_000, itemCount: 14,
      need: "Biệt thự 3 tầng — trọn gói", interestedProducts: ["Gạch lát nền", "Gạch ốp tường", "Bồn cầu", "Lavabo", "Sen tắm", "Bếp"],
      projectStage: "hoan_thien", projectType: "xay_moi", numberOfBathrooms: 4,
      budgetMin: 90_000_000, budgetMax: 120_000_000, owner: "Hương",
      nextAction: "Chốt đơn — thu cọc 30%", nextActionType: "thu_coc",
      nextContactDate: addDays(today, 1), nextActionTime: "15:00", competitor: "Đại lý gạch Ý Mỹ",
      lastContact: "ĐANG ĐÀM PHÁN CHIẾT KHẤU CUỐI",
    },
    // === Đã chốt (won) ===
    {
      fullName: "Đỗ Thành Công", phone: "0936 440 905", source: "Khách giới thiệu", ward: "Mê Linh",
      funnelStage: "won", priority: "hot", contactResult: "da_lien_he", value: 46_500_000, itemCount: 11,
      need: "Trọn gói phòng tắm 2WC + bếp", interestedProducts: ["Bồn cầu", "Lavabo", "Sen tắm", "Bếp"],
      projectStage: "hoan_thien", numberOfBathrooms: 2, owner: "Cần", closedDate: addDays(today, -1),
      nextAction: "Xác nhận lịch giao hàng", nextActionType: "xac_nhan_giao_hang",
      nextContactDate: addDays(today, 2), nextActionTime: "08:30", lastContact: "ĐÃ NHẬN CỌC 50%",
    },
    {
      fullName: "Nguyễn Thị Bích", phone: "0912 118 227", source: "Website", ward: "Bắc Từ Liêm",
      funnelStage: "won", priority: "warm", contactResult: "da_lien_he", value: 31_000_000, itemCount: 8,
      need: "Gạch + sen vòi", interestedProducts: ["Gạch lát nền", "Sen tắm", "Vòi"], owner: "Liên",
      closedDate: addDays(today, -4), nextAction: "Xác nhận giao hàng đợt 1", nextActionType: "xac_nhan_giao_hang",
      nextContactDate: addDays(today, 3), nextActionTime: "09:00", lastContact: "ĐÃ CHỐT ĐƠN, LÊN LỊCH GIAO",
    },
    // === Hậu mãi ===
    {
      fullName: "Ngô Đức Long", phone: "0908 662 510", source: "Showroom", ward: "Bắc Từ Liêm",
      funnelStage: "aftercare", priority: "cold", contactResult: "da_lien_he", value: 28_600_000, itemCount: 9,
      need: "Trọn phòng tắm — đã giao xong", interestedProducts: ["Bồn cầu", "Lavabo", "Sen tắm"], owner: "Liên",
      closedDate: addDays(today, -20), nextAction: "Gọi hỏi thăm sau lắp đặt", nextActionType: "hau_mai",
      nextContactDate: addDays(today, 7), nextActionTime: "10:00", lastContact: "KHÁCH HÀI LÒNG SAU GIAO HÀNG",
    },
    // === Mất khách (lost) — có lý do ===
    {
      fullName: "Trần Văn Bình", phone: "0977 900 456", source: "Facebook", ward: "Mê Linh",
      funnelStage: "lost", priority: "warm", contactResult: "da_lien_he", value: 25_000_000,
      need: "Gạch ốp lát WC", interestedProducts: ["Gạch ốp tường"], owner: "Cần",
      lossReason: "gia", lostNote: "Khách chốt bên đại lý rẻ hơn 8%.", competitor: "Đại lý Viglacera",
      lastContact: "KHÁCH BÁO ĐÃ MUA CHỖ KHÁC VÌ GIÁ",
    },
    {
      fullName: "Lê Thị Thu", phone: "0903 556 118", source: "TikTok", ward: "Phúc Yên",
      funnelStage: "lost", priority: "cold", contactResult: "khong_bat_may", need: "Hỏi gạch giá rẻ",
      owner: "Hương", lossReason: "khong_lien_he_duoc", lostNote: "Gọi 4 lần không bắt máy.",
      lastContact: "GỌI NHIỀU LẦN KHÔNG LIÊN HỆ ĐƯỢC",
    },
    {
      fullName: "Hoàng Văn Kiên", phone: "0968 221 334", source: "Facebook Ads", ward: "Sóc Sơn",
      funnelStage: "lost", priority: "cold", contactResult: "da_lien_he", need: "Xem gạch nhưng chưa xây",
      owner: "Liên", lossReason: "chua_xay", lostNote: "Mới mua đất, chưa khởi công.",
      lastContact: "KHÁCH CHƯA XÂY, HẸN SANG NĂM",
    },
    // === Tạm hoãn (paused) ===
    {
      fullName: "Vương Thị Hoa", phone: "0912 776 553", source: "Zalo", ward: "Đông Anh",
      funnelStage: "paused", priority: "warm", contactResult: "da_lien_he", value: 33_000_000,
      need: "Trọn bộ WC — hoãn do thiếu vốn", interestedProducts: ["Bồn cầu", "Lavabo", "Sen tắm"], owner: "Cần",
      nextAction: "Nhắn lại khi khách sẵn sàng", nextActionType: "nhan_zalo",
      nextContactDate: addDays(today, 30), nextActionTime: "10:00", lastContact: "KHÁCH XIN HOÃN 1 THÁNG",
    },
    // === Thêm vài lead/tư vấn để pipeline dày ===
    {
      fullName: "Phùng Gia Bảo", phone: "0906 001 778", source: "Website", ward: "Mê Linh",
      funnelStage: "lead", priority: "warm", contactResult: "chua_lien_he", need: "Báo giá gạch 60x60",
      interestedProducts: ["Gạch lát nền"], owner: "Hương",
      nextAction: "Gọi tư vấn lần đầu", nextActionType: "goi_khach", nextContactDate: today, nextActionTime: "11:00",
      lastContact: "LEAD MỚI TỪ WEBSITE",
    },
    {
      fullName: "Tạ Thị Nhung", phone: "0977 334 909", source: "Hotline", ward: "Bắc Từ Liêm",
      funnelStage: "consulting", priority: "warm", contactResult: "da_lien_he", value: 18_000_000,
      need: "Sen tắm + vòi", interestedProducts: ["Sen tắm", "Vòi"], owner: "Liên",
      nextAction: "Gửi mẫu sen tắm qua Zalo", nextActionType: "gui_mau",
      nextContactDate: addDays(today, 1), nextActionTime: "14:30", lastContact: "GỌI HOTLINE HỎI SEN TẮM",
    },
    {
      fullName: "Chu Văn Hải", phone: "0908 909 112", source: "Khách giới thiệu", ward: "Sóc Sơn",
      funnelStage: "quoted", priority: "warm", contactResult: "da_lien_he", value: 52_000_000, itemCount: 8,
      need: "Gạch + TBVS nhà cấp 4", interestedProducts: ["Gạch lát nền", "Bồn cầu", "Lavabo"],
      projectStage: "chuan_bi_lat_gach", numberOfBathrooms: 1, owner: "Cần",
      nextAction: "Follow báo giá đã gửi", nextActionType: "follow_bao_gia",
      nextContactDate: addDays(today, 1), nextActionTime: "15:30", lastContact: "ĐÃ GỬI BÁO GIÁ 52 TRIỆU",
    },
  ];

  return rows.map((row) => ({
    leadCode: `LEAD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
    fullName: row.fullName,
    phone: row.phone,
    source: row.source,
    campaign: row.campaign ?? "",
    ward: row.ward,
    address: row.address ?? "",
    funnelStage: row.funnelStage,
    priority: row.priority,
    contactResult: row.contactResult ?? "chua_lien_he",
    value: row.value ?? 0,
    itemCount: row.itemCount ?? 0,
    need: row.need,
    interestedProducts: JSON.stringify(row.interestedProducts ?? []),
    projectStage: row.projectStage ?? "",
    projectType: row.projectType ?? "",
    numberOfBathrooms: row.numberOfBathrooms ?? 0,
    budgetMin: row.budgetMin ?? 0,
    budgetMax: row.budgetMax ?? 0,
    owner: row.owner,
    enteredBy: row.owner,
    nextAction: row.nextAction ?? "",
    nextActionType: row.nextActionType ?? "",
    nextContactDate: row.nextContactDate ?? "",
    nextActionTime: row.nextActionTime ?? "",
    appointmentDate: row.appointmentDate ?? "",
    arrived: row.arrived ?? 0,
    closedDate: row.closedDate ?? "",
    estimatedTileDate: row.estimatedTileDate ?? "",
    mainConcern: row.mainConcern ?? "",
    objection: row.objection ?? "",
    competitor: row.competitor ?? "",
    lossReason: row.lossReason ?? "",
    lostNote: row.lostNote ?? "",
    lostBy: row.lossReason ? row.owner : "",
    lostAt: row.lossReason ? today : "",
    lastContact: row.lastContact ?? "ĐÃ TẠO HỒ SƠ KHÁCH HÀNG",
    notes: row.notes ?? "",
  }));
}
