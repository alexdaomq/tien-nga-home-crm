import { and, eq, sql } from "drizzle-orm";
import { getDb, getOrCreateSettings } from "../../../../db";
import { activities, customers } from "../../../../db/schema";
import { TEAM_MEMBERS } from "../../../../lib/types";
import { todayISO } from "../../../../lib/format";

// ============================================================================
// POST /api/customers/intake — thêm khách từ luồng tự động bên ngoài (n8n...).
//
// Đầu vào (JSON):
//   { fullName, phone, address, need, owner }
//   - fullName : Tên khách hàng            (bắt buộc)
//   - phone    : SĐT                        (bắt buộc, tự quy về 10 số bắt đầu 0)
//   - address  : Địa chỉ                    (tuỳ chọn)
//   - need     : Nhu cầu (chuỗi hoặc mảng)  (tuỳ chọn)
//   - owner    : Nhân viên Sales phụ trách  (tuỳ chọn; trống -> "Chưa phân công")
//   - note     : Ghi chú -> lưu nguyên văn vào Lịch sử chăm sóc (tuỳ chọn)
//   (chấp nhận vài tên khác: name / sdt / diaChi / nhuCau / sales / nhanVien / ghiChu)
//
// Bảo mật:   header x-webhook-secret khớp app_settings.webhookSecret.
// Chống spam: tối đa MAX_INTAKE_PER_MINUTE khách/60 giây qua API này.
// Trùng SĐT: KHÔNG cập nhật — trả về code EXISTS.
//
// Đầu ra: { code, message, customerId? }
//   code ∈ CREATED | EXISTS | INVALID | UNAUTHORIZED | RATE_LIMITED | ERROR
// ============================================================================

const SOURCE_TAG = "API tự động";
const MAX_INTAKE_PER_MINUTE = 20;

function noAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

// Quy SĐT về 10 số bắt đầu bằng 0 (bỏ +84/84/0084, khoảng trắng, chấm, gạch).
function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0084")) d = "0" + d.slice(4);
  else if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  else if (d.length === 9 && !d.startsWith("0")) d = "0" + d;
  return d;
}
const isValidPhone = (p: string) => /^0\d{9}$/.test(p);

// Chuẩn hoá tên sale về đúng tên trong đội (không phân biệt hoa/thường, dấu).
function canonicalOwner(raw: string): string {
  const v = raw.trim();
  if (!v) return "Chưa phân công";
  const hit = TEAM_MEMBERS.find((m) => noAccent(m) === noAccent(v));
  return hit ?? v;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi khi xử lý.";
}

export async function POST(request: Request) {
  try {
    const db = getDb();

    // 1) Bảo mật.
    const providedSecret = request.headers.get("x-webhook-secret") ?? "";
    const settings = await getOrCreateSettings(db);
    if (!providedSecret || providedSecret !== settings.webhookSecret) {
      return Response.json({ code: "UNAUTHORIZED", message: "Khoá bí mật không đúng hoặc thiếu header x-webhook-secret." }, { status: 401 });
    }

    // 2) Chống spam.
    const recent = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.enteredBy, SOURCE_TAG), sql`${customers.createdAt} >= datetime('now','-60 seconds')`));
    if (recent.length >= MAX_INTAKE_PER_MINUTE) {
      return Response.json({ code: "RATE_LIMITED", message: "Quá nhiều yêu cầu trong thời gian ngắn, thử lại sau ít phút." }, { status: 429 });
    }

    // 3) Đọc field đầu vào.
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const fullName = String(body.fullName ?? body.name ?? "").trim().slice(0, 60);
    const phone = normalizePhone(String(body.phone ?? body.sdt ?? ""));
    const address = String(body.address ?? body.diaChi ?? "").trim();
    const needRaw = body.need ?? body.nhuCau ?? "";
    const need = (Array.isArray(needRaw) ? needRaw.map(String).join("; ") : String(needRaw)).trim();
    const owner = canonicalOwner(String(body.owner ?? body.sales ?? body.nhanVien ?? ""));
    const noteRaw = body.note ?? body.ghiChu ?? "";
    const note = (Array.isArray(noteRaw) ? noteRaw.map(String).join("\n") : String(noteRaw)).trim();

    if (fullName.length < 2) {
      return Response.json({ code: "INVALID", message: "Thiếu tên khách hàng." }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return Response.json({ code: "INVALID", message: "Số điện thoại chưa hợp lệ (cần 10 số bắt đầu bằng 0)." }, { status: 400 });
    }

    // 4) Trùng SĐT -> KHÔNG cập nhật.
    const existingRows = await db.select().from(customers).limit(3000);
    const existing = existingRows.find((row) => normalizePhone(row.phone) === phone);
    if (existing) {
      return Response.json({ code: "EXISTS", message: `Khách hàng đã tồn tại (SĐT ${phone} — ${existing.fullName}). Bỏ qua, không cập nhật.`, customerId: existing.id });
    }

    // 5) Tạo mới.
    const leadCode = `LEAD-${Date.now().toString(36).toUpperCase()}`;
    const [customer] = await db.insert(customers).values({
      leadCode,
      fullName,
      phone,
      address,
      source: "Khác",
      need,
      funnelStage: "lead",
      priority: "warm",
      contactResult: "chua_lien_he",
      owner,
      enteredBy: SOURCE_TAG,
      notes: "Tạo tự động từ API.",
      lastContact: "TẠO TỰ ĐỘNG TỪ API",
      nextAction: "Gọi xác nhận khách mới (nguồn tự động)",
      nextActionType: "goi_khach",
      nextContactDate: todayISO(),
      nextActionTime: "09:00",
    }).returning();

    await db.insert(activities).values({
      customerId: customer.id,
      content: `API tự động ghi nhận: ${fullName} · ${phone}${address ? ` · ${address}` : ""}${need ? ` · nhu cầu: ${need}` : ""}. Sale phụ trách: ${owner}.`,
      enteredBy: SOURCE_TAG,
    });

    // Ghi chú -> một dòng riêng trong Lịch sử chăm sóc (chèn sau nên hiện trên cùng).
    if (note) {
      await db.insert(activities).values({ customerId: customer.id, content: note, enteredBy: SOURCE_TAG });
    }

    return Response.json({
      code: "CREATED",
      message: `Đã thêm khách ${fullName}, phụ trách: ${owner}.`,
      customerId: customer.id,
      leadCode: customer.leadCode,
      owner,
    }, { status: 201 });
  } catch (error) {
    return Response.json({ code: "ERROR", message: errorMessage(error) }, { status: 500 });
  }
}
