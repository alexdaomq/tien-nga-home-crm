import { eq, sql } from "drizzle-orm";
import { getDb, getOrCreateSettings } from "../../../db";
import { appSettings } from "../../../db/schema";

function normalizeAccountId(raw: string): string {
  const id = raw.trim().replace(/^act_/, "").replace(/\D/g, "");
  return id ? `act_${id}` : "";
}

// GET: trạng thái kết nối (KHÔNG trả token ra ngoài để tránh lộ khoá).
export async function GET() {
  try {
    const db = getDb();
    const settings = await getOrCreateSettings(db);
    return Response.json({
      adAccountId: settings.fbAdAccountId ?? "",
      hasToken: Boolean((settings.fbAccessToken ?? "").trim()),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi xảy ra" }, { status: 500 });
  }
}

// POST: lưu tài khoản quảng cáo + access token. Token chỉ ghi vào DB, không trả lại.
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { adAccountId?: string; accessToken?: string; clear?: boolean };
    const db = getDb();
    const current = await getOrCreateSettings(db);

    if (payload.clear) {
      await db.update(appSettings).set({ fbAccessToken: "", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appSettings.id, current.id));
      return Response.json({ ok: true, hasToken: false, adAccountId: current.fbAdAccountId ?? "" });
    }

    const adAccountId = payload.adAccountId !== undefined ? normalizeAccountId(String(payload.adAccountId)) : current.fbAdAccountId;
    // Token trống nghĩa là giữ token cũ (người dùng chỉ đổi tài khoản).
    const accessToken = payload.accessToken && String(payload.accessToken).trim() ? String(payload.accessToken).trim() : current.fbAccessToken;

    await db.update(appSettings).set({ fbAdAccountId: adAccountId, fbAccessToken: accessToken, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appSettings.id, current.id));
    return Response.json({ ok: true, adAccountId, hasToken: Boolean(accessToken.trim()) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi xảy ra" }, { status: 500 });
  }
}
