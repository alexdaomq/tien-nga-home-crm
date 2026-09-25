import { eq, sql } from "drizzle-orm";
import { getDb, getOrCreateSettings } from "../../../db";
import { appSettings } from "../../../db/schema";

export async function GET() {
  try {
    const db = getDb();
    const settings = await getOrCreateSettings(db);
    return Response.json({ settings });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi xảy ra" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { marginRate?: number; regenerateWebhookSecret?: boolean; regenerateCalendarSecret?: boolean };
    const db = getDb();
    const current = await getOrCreateSettings(db);

    const marginRate = payload.marginRate === undefined ? current.marginRate : Math.min(90, Math.max(1, Number(payload.marginRate) || 25));
    const webhookSecret = payload.regenerateWebhookSecret ? crypto.randomUUID().replace(/-/g, "") : current.webhookSecret;
    const calendarSecret = payload.regenerateCalendarSecret ? crypto.randomUUID().replace(/-/g, "") : current.calendarSecret;

    const [row] = await db.update(appSettings).set({ marginRate, webhookSecret, calendarSecret, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appSettings.id, current.id)).returning();
    return Response.json({ settings: row });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi xảy ra" }, { status: 500 });
  }
}
