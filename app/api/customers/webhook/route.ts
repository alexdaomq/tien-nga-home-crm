import { eq, sql } from "drizzle-orm";
import { getDb, getOrCreateSettings } from "../../../../db";
import { activities, customers } from "../../../../db/schema";

// Điểm nối cho n8n / AI đọc Business Suite (Messenger, Instagram...): khi đã trích
// xuất đủ họ tên + SĐT (+ địa chỉ nếu có) từ hội thoại, gọi endpoint này để tự động
// ghi vào CRM. Đây là AI tầng hậu trường (đọc/ghi dữ liệu), KHÔNG phải AI trả lời
// khách — sale vẫn là người trực tiếp trò chuyện trên Business Suite.
//
// Bắt buộc header: x-webhook-secret — lấy/tạo tại tab "Chỉ số vận hành" trên CRM.
// Body JSON tối thiểu: { fullName, phone }. Tuỳ chọn: address, ward, source,
// channel ("messenger" | "instagram" | ...), note, conversationUrl.

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi xảy ra khi ghi khách hàng tự động.";
}

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function POST(request: Request) {
  try {
    const providedSecret = request.headers.get("x-webhook-secret") ?? "";
    const db = getDb();
    const settings = await getOrCreateSettings(db);
    if (!providedSecret || providedSecret !== settings.webhookSecret) {
      return Response.json({ error: "Khoá bí mật không đúng hoặc thiếu header x-webhook-secret." }, { status: 401 });
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const fullName = String(payload.fullName ?? "").trim();
    const phone = String(payload.phone ?? "").trim();
    const address = String(payload.address ?? "").trim();
    const ward = String(payload.ward ?? "").trim();
    const source = String(payload.source ?? "Facebook").trim();
    const channel = String(payload.channel ?? "").trim();
    const note = String(payload.note ?? "").trim();
    const conversationUrl = String(payload.conversationUrl ?? "").trim();

    if (fullName.length < 2) return Response.json({ error: "Thiếu họ tên khách hàng." }, { status: 400 });
    const phoneDigits = digitsOnly(phone);
    if (phoneDigits.length < 9) return Response.json({ error: "Số điện thoại chưa hợp lệ." }, { status: 400 });

    const channelLabel = channel ? ` qua ${channel}` : "";
    const activityContent = [
      `AI ghi nhận từ Business Suite${channelLabel}: SĐT ${phone}${address ? `, địa chỉ "${address}"` : ""}.`,
      note ? `Trích đoạn: ${note}` : "",
      conversationUrl ? `Hội thoại: ${conversationUrl}` : "",
    ].filter(Boolean).join(" ");

    const existingRows = await db.select().from(customers).limit(2000);
    const existing = existingRows.find((row) => digitsOnly(row.phone) === phoneDigits);

    if (existing) {
      const addressChanged = address && existing.address && address !== existing.address;
      const [customer] = await db.update(customers).set({
        address: address && !existing.address ? address : undefined,
        ward: ward && !existing.ward ? ward : undefined,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(customers.id, existing.id)).returning();

      await db.insert(activities).values({
        customerId: existing.id,
        content: addressChanged
          ? `${activityContent} (CHÚ Ý: địa chỉ khác với hồ sơ đang có "${existing.address}" — kiểm tra lại trước khi sửa)`
          : activityContent,
        enteredBy: "AI Business Suite",
      });

      return Response.json({ customer: customer ?? existing, created: false, addressFlaggedForReview: Boolean(addressChanged) });
    }

    const leadCode = `LEAD-${Date.now().toString(36).toUpperCase()}`;
    const [customer] = await db.insert(customers).values({
      leadCode,
      fullName,
      phone,
      address,
      ward,
      source,
      funnelStage: "lead",
      priority: "warm",
      owner: "Chưa phân công",
      enteredBy: "AI Business Suite",
      notes: note ? `Ghi nhận từ Business Suite: ${note}` : "Tạo tự động từ Business Suite",
      lastContact: "AI TỰ ĐỘNG GHI NHẬN TỪ BUSINESS SUITE",
      nextAction: "Xác nhận thông tin khách mới từ Business Suite",
      nextContactDate: new Date().toISOString().slice(0, 10),
    }).returning();

    await db.insert(activities).values({ customerId: customer.id, content: activityContent, enteredBy: "AI Business Suite" });

    return Response.json({ customer, created: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
