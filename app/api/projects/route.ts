import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { customers, projectItems, projects } from "../../../db/schema";
import { CONSTRUCTION_STAGES, PROJECT_STATUSES } from "../../../db/enums";

const allowedStages = new Set<string>(CONSTRUCTION_STAGES);
const allowedStatuses = new Set<string>(PROJECT_STATUSES);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi xảy ra với hồ sơ công trình.";
}

function selectProjects(db: ReturnType<typeof getDb>) {
  return db.select({
    id: projects.id,
    projectCode: projects.projectCode,
    customerId: projects.customerId,
    customerName: customers.fullName,
    customerPhone: customers.phone,
    customerOwner: customers.owner,
    address: projects.address,
    ward: projects.ward,
    area: projects.area,
    numberOfWc: projects.numberOfWc,
    hasKitchen: projects.hasKitchen,
    contractorName: projects.contractorName,
    constructionStage: projects.constructionStage,
    tileDeliveredAt: projects.tileDeliveredAt,
    expectedTilingAt: projects.expectedTilingAt,
    status: projects.status,
    notes: projects.notes,
    createdAt: projects.createdAt,
    updatedAt: projects.updatedAt,
  }).from(projects).leftJoin(customers, eq(projects.customerId, customers.id)).orderBy(desc(projects.updatedAt), desc(projects.id)).limit(1000);
}

export async function GET() {
  try {
    const db = getDb();
    const rows = await selectProjects(db);
    const items = await db.select().from(projectItems).limit(5000);
    const itemsByProject = new Map<number, typeof items>();
    for (const item of items) {
      const list = itemsByProject.get(item.projectId) ?? [];
      list.push(item);
      itemsByProject.set(item.projectId, list);
    }
    const enriched = rows.map((project) => {
      const projectRows = itemsByProject.get(project.id) ?? [];
      const boughtAtTienNga = projectRows.filter((row) => row.purchaseStatus === "tien_nga");
      const boughtElsewhere = projectRows.filter((row) => row.purchaseStatus === "noi_khac");
      return {
        ...project,
        itemCount: projectRows.length,
        boughtAtTienNgaCount: boughtAtTienNga.length,
        boughtElsewhereCount: boughtElsewhere.length,
        lifetimeValue: boughtAtTienNga.reduce((sum, row) => sum + row.orderValue, 0),
      };
    });
    return Response.json({ projects: enriched });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const customerId = Number(payload.customerId);
    const constructionStage = String(payload.constructionStage ?? "chua_khoi_cong");
    const status = String(payload.status ?? "dang_trien_khai");
    if (!Number.isInteger(customerId) || customerId < 1) return Response.json({ error: "Vui lòng chọn khách hàng cho công trình." }, { status: 400 });
    if (!allowedStages.has(constructionStage)) return Response.json({ error: "Giai đoạn thi công chưa hợp lệ." }, { status: 400 });
    if (!allowedStatuses.has(status)) return Response.json({ error: "Trạng thái công trình chưa hợp lệ." }, { status: 400 });

    const db = getDb();
    const [customer] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!customer) return Response.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });

    const [project] = await db.insert(projects).values({
      projectCode: `CT-${Date.now().toString(36).toUpperCase()}`,
      customerId,
      address: String(payload.address ?? "").trim(),
      ward: String(payload.ward ?? "").trim(),
      area: String(payload.area ?? "").trim(),
      numberOfWc: Math.max(1, Number(payload.numberOfWc ?? 1) || 1),
      hasKitchen: payload.hasKitchen ? 1 : 0,
      contractorName: String(payload.contractorName ?? "").trim(),
      constructionStage,
      tileDeliveredAt: String(payload.tileDeliveredAt ?? "").trim(),
      expectedTilingAt: String(payload.expectedTilingAt ?? "").trim(),
      status,
      notes: String(payload.notes ?? "").trim(),
    }).returning();
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Công trình chưa hợp lệ." }, { status: 400 });
    if (payload.constructionStage !== undefined && !allowedStages.has(String(payload.constructionStage))) {
      return Response.json({ error: "Giai đoạn thi công chưa hợp lệ." }, { status: 400 });
    }
    if (payload.status !== undefined && !allowedStatuses.has(String(payload.status))) {
      return Response.json({ error: "Trạng thái công trình chưa hợp lệ." }, { status: 400 });
    }
    const db = getDb();
    const [project] = await db.update(projects).set({
      address: payload.address === undefined ? undefined : String(payload.address).trim(),
      ward: payload.ward === undefined ? undefined : String(payload.ward).trim(),
      area: payload.area === undefined ? undefined : String(payload.area).trim(),
      numberOfWc: payload.numberOfWc === undefined ? undefined : Math.max(1, Number(payload.numberOfWc) || 1),
      hasKitchen: payload.hasKitchen === undefined ? undefined : (payload.hasKitchen ? 1 : 0),
      contractorName: payload.contractorName === undefined ? undefined : String(payload.contractorName).trim(),
      constructionStage: payload.constructionStage === undefined ? undefined : String(payload.constructionStage),
      tileDeliveredAt: payload.tileDeliveredAt === undefined ? undefined : String(payload.tileDeliveredAt).trim(),
      expectedTilingAt: payload.expectedTilingAt === undefined ? undefined : String(payload.expectedTilingAt).trim(),
      status: payload.status === undefined ? undefined : String(payload.status),
      notes: payload.notes === undefined ? undefined : String(payload.notes).trim(),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(projects.id, id)).returning();
    if (!project) return Response.json({ error: "Không tìm thấy công trình." }, { status: 404 });
    return Response.json({ project });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: number };
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Công trình chưa hợp lệ." }, { status: 400 });
    const [deleted] = await getDb().delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
    if (!deleted) return Response.json({ error: "Không tìm thấy công trình." }, { status: 404 });
    return Response.json({ deletedId: deleted.id });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
