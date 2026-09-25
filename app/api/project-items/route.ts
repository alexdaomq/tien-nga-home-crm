import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { projectItems } from "../../../db/schema";
import { PROJECT_CATEGORIES, PROJECT_ROOMS, PURCHASE_STATUSES } from "../../../db/enums";

const allowedRooms = new Set<string>(PROJECT_ROOMS);
const allowedCategories = new Set<string>(PROJECT_CATEGORIES);
const allowedPurchaseStatuses = new Set<string>(PURCHASE_STATUSES);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi xảy ra với checklist công trình.";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = Number(url.searchParams.get("projectId"));
    const db = getDb();
    const rows = Number.isInteger(projectId) && projectId > 0
      ? await db.select().from(projectItems).where(eq(projectItems.projectId, projectId))
      : await db.select().from(projectItems).limit(5000);
    return Response.json({ items: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// Upsert theo (projectId, room, category) — mỗi ô trong lưới checklist là một cặp phòng x hạng mục.
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const projectId = Number(payload.projectId);
    const room = String(payload.room ?? "");
    const category = String(payload.category ?? "");
    const purchaseStatus = String(payload.purchaseStatus ?? "chua_mua");
    if (!Number.isInteger(projectId) || projectId < 1) return Response.json({ error: "Công trình chưa hợp lệ." }, { status: 400 });
    if (!allowedRooms.has(room)) return Response.json({ error: "Tên phòng chưa hợp lệ." }, { status: 400 });
    if (!allowedCategories.has(category)) return Response.json({ error: "Hạng mục chưa hợp lệ." }, { status: 400 });
    if (!allowedPurchaseStatuses.has(purchaseStatus)) return Response.json({ error: "Trạng thái mua hàng chưa hợp lệ." }, { status: 400 });

    const db = getDb();
    const orderValue = Math.max(0, Number(payload.orderValue ?? 0) || 0);
    const purchasedAt = String(payload.purchasedAt ?? "").trim();
    const notes = String(payload.notes ?? "").trim();

    const [existing] = await db.select({ id: projectItems.id }).from(projectItems)
      .where(and(eq(projectItems.projectId, projectId), eq(projectItems.room, room), eq(projectItems.category, category))).limit(1);

    if (existing) {
      const [item] = await db.update(projectItems).set({ purchaseStatus, orderValue, purchasedAt, notes, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(projectItems.id, existing.id)).returning();
      return Response.json({ item });
    }

    const [item] = await db.insert(projectItems).values({ projectId, room, category, purchaseStatus, orderValue, purchasedAt, notes }).returning();
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: number };
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Dòng checklist chưa hợp lệ." }, { status: 400 });
    await getDb().delete(projectItems).where(eq(projectItems.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
