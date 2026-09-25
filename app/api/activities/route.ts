import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { activities } from "../../../db/schema";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi xảy ra với nhật ký hoạt động.";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerId = Number(url.searchParams.get("customerId"));
    const db = getDb();
    const rows = Number.isInteger(customerId) && customerId > 0
      ? await db.select().from(activities).where(eq(activities.customerId, customerId)).orderBy(desc(activities.createdAt), desc(activities.id)).limit(500)
      : await db.select().from(activities).orderBy(desc(activities.createdAt), desc(activities.id)).limit(2000);
    return Response.json({ activities: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const customerId = Number(payload.customerId);
    const content = String(payload.content ?? "").trim();
    const enteredBy = String(payload.enteredBy ?? "").trim();
    if (!Number.isInteger(customerId) || customerId < 1) return Response.json({ error: "Khách hàng chưa hợp lệ." }, { status: 400 });
    if (content.length < 2) return Response.json({ error: "Vui lòng nhập nội dung cập nhật." }, { status: 400 });
    if (!enteredBy) return Response.json({ error: "Vui lòng chọn người nhập." }, { status: 400 });

    const [activity] = await getDb().insert(activities).values({ customerId, content, enteredBy }).returning();
    return Response.json({ activity }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
