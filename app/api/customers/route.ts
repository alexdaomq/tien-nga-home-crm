import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { activities, customers } from "../../../db/schema";
import { CONTACT_RESULTS, FUNNEL_STAGES, LOSS_REASONS, PRIORITIES } from "../../../db/enums";
import { buildSeedCustomers } from "../../../db/seed";

const allowedStages = new Set<string>(FUNNEL_STAGES);
const allowedPriorities = new Set<string>(PRIORITIES);
const allowedContactResults = new Set<string>(CONTACT_RESULTS);
const allowedLossReasons = new Set<string>(LOSS_REASONS);

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Có lỗi xảy ra";
  if (message.includes("UNIQUE") || message.includes("unique")) return "Số điện thoại này đã có trong hệ thống.";
  return message;
}

function concreteLatestUpdate(customer: typeof customers.$inferSelect, latestActivity?: string) {
  if (latestActivity?.trim()) return latestActivity.trim();
  const savedUpdate = customer.lastContact.trim();
  const isLegacyTimestamp = /^(hôm nay|hôm qua|vừa|\d{1,2}\/\d{1,2})/i.test(savedUpdate);
  if (!isLegacyTimestamp) return savedUpdate;
  return customer.notes.trim() ? `ĐÃ GHI NHẬN: ${customer.notes.trim()}` : "CHƯA CÓ NỘI DUNG CẬP NHẬT";
}

function fieldsFromPayload(payload: Record<string, unknown>, existing?: typeof customers.$inferSelect) {
  const text = (key: string, fallback = "") => (payload[key] === undefined ? undefined : String(payload[key] ?? fallback).trim());
  const bool = (key: string) => (payload[key] === undefined ? undefined : payload[key] ? 1 : 0);
  const num = (key: string) => (payload[key] === undefined ? undefined : Math.max(0, Number(payload[key]) || 0));
  return {
    fullName: text("fullName"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    ward: text("ward"),
    inZone: bool("inZone"),
    source: text("source", "Khác"),
    campaign: text("campaign"),
    referrer: text("referrer"),
    constructionStageAtLead: text("constructionStageAtLead"),
    funnelStage: payload.funnelStage === undefined ? undefined : String(payload.funnelStage),
    priority: payload.priority === undefined ? undefined : String(payload.priority).trim(),
    firstCallAt: text("firstCallAt"),
    contactResult: payload.contactResult === undefined ? undefined : String(payload.contactResult),
    appointmentDate: text("appointmentDate"),
    arrived: bool("arrived"),
    closedDate: text("closedDate"),
    value: num("value"),
    itemCount: num("itemCount"),
    lossReason: text("lossReason"),
    need: text("need"),
    projectType: text("projectType"),
    stylePreference: text("stylePreference"),
    dimensions: text("dimensions"),
    purchaseTimeline: text("purchaseTimeline"),
    preferredChannel: text("preferredChannel", "Điện thoại"),
    preferredContactTime: text("preferredContactTime"),
    expectedCloseDate: text("expectedCloseDate"),
    nextContactDate: text("nextContactDate"),
    notes: text("notes"),
    owner: text("owner", existing?.owner ?? "Chưa phân công"),
    enteredBy: text("enteredBy", existing?.enteredBy ?? "Chưa rõ"),
    lastContact: text("lastContact"),
    nextAction: text("nextAction"),
    zalo: text("zalo"),
    projectStage: text("projectStage"),
    numberOfFloors: num("numberOfFloors"),
    numberOfBathrooms: num("numberOfBathrooms"),
    estimatedTileDate: text("estimatedTileDate"),
    estimatedBathroomInstallDate: text("estimatedBathroomInstallDate"),
    budgetMin: num("budgetMin"),
    budgetMax: num("budgetMax"),
    interestedProducts:
      payload.interestedProducts === undefined
        ? undefined
        : Array.isArray(payload.interestedProducts)
          ? JSON.stringify(payload.interestedProducts)
          : String(payload.interestedProducts ?? ""),
    mainConcern: text("mainConcern"),
    objection: text("objection"),
    decisionMaker: text("decisionMaker"),
    competitor: text("competitor"),
    nextActionType: text("nextActionType"),
    nextActionTime: text("nextActionTime"),
    lostNote: text("lostNote"),
    lostCompetitor: text("lostCompetitor"),
    lostAt: text("lostAt"),
    lostBy: text("lostBy"),
  };
}

export async function GET() {
  try {
    const db = getDb();
    let rows = await db.select().from(customers).orderBy(desc(customers.updatedAt), desc(customers.id)).limit(1000);
    if (rows.length === 0) {
      // Cloudflare D1 giới hạn 100 tham số/câu lệnh — chèn từng khách một (mỗi
      // dòng ~54 tham số) thay vì 1 câu insert lớn (sẽ vượt giới hạn và lỗi).
      for (const seedRow of buildSeedCustomers()) {
        await db.insert(customers).values(seedRow);
      }
      // Mô phỏng 1 khách HOT "nguy cơ mất" (>48h không tương tác) để test cờ cảnh báo.
      await db
        .update(customers)
        .set({ updatedAt: sql`datetime('now', '-3 days')` })
        .where(eq(customers.fullName, "Đỗ Mạnh Cường"));
      rows = await db.select().from(customers).orderBy(desc(customers.updatedAt), desc(customers.id)).limit(1000);
    }
    const recentActivities = await db.select().from(activities).orderBy(desc(activities.createdAt), desc(activities.id)).limit(2000);
    const latestActivityByCustomer = new Map<number, string>();
    for (const activity of recentActivities) {
      if (!latestActivityByCustomer.has(activity.customerId)) latestActivityByCustomer.set(activity.customerId, activity.content);
    }
    const enrichedRows = rows.map((customer) => ({ ...customer, lastContact: concreteLatestUpdate(customer, latestActivityByCustomer.get(customer.id)) }));
    return Response.json({ customers: enrichedRows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const fullName = String(payload.fullName ?? "").trim();
    const phone = String(payload.phone ?? "").trim();
    const funnelStage = String(payload.funnelStage ?? "lead");
    const priority = String(payload.priority ?? "warm");
    const contactResult = String(payload.contactResult ?? "chua_lien_he");
    if (fullName.length < 2) return Response.json({ error: "Vui lòng nhập họ tên khách hàng." }, { status: 400 });
    if (phone.replace(/\D/g, "").length < 9) return Response.json({ error: "Số điện thoại chưa hợp lệ." }, { status: 400 });
    if (!allowedStages.has(funnelStage)) return Response.json({ error: "Trạng thái phễu chưa hợp lệ." }, { status: 400 });
    if (!allowedPriorities.has(priority)) return Response.json({ error: "Mức ưu tiên chưa hợp lệ." }, { status: 400 });
    if (!allowedContactResults.has(contactResult)) return Response.json({ error: "Kết quả liên hệ chưa hợp lệ." }, { status: 400 });

    const db = getDb();
    const leadCode = `LEAD-${Date.now().toString(36).toUpperCase()}`;
    const fields = fieldsFromPayload(payload);
    const [customer] = await db.insert(customers).values({
      leadCode,
      fullName,
      phone,
      funnelStage,
      priority,
      contactResult,
      email: fields.email ?? "",
      address: fields.address ?? "",
      ward: fields.ward ?? "",
      inZone: fields.inZone ?? 1,
      source: fields.source ?? "Khác",
      campaign: fields.campaign ?? "",
      referrer: fields.referrer ?? "",
      constructionStageAtLead: fields.constructionStageAtLead ?? "",
      firstCallAt: fields.firstCallAt ?? "",
      appointmentDate: fields.appointmentDate ?? "",
      arrived: fields.arrived ?? 0,
      closedDate: fields.closedDate ?? "",
      value: fields.value ?? 0,
      itemCount: fields.itemCount ?? 0,
      lossReason: fields.lossReason ?? "",
      need: fields.need ?? "",
      projectType: fields.projectType ?? "",
      stylePreference: fields.stylePreference ?? "",
      dimensions: fields.dimensions ?? "",
      purchaseTimeline: fields.purchaseTimeline ?? "",
      preferredChannel: fields.preferredChannel ?? "Điện thoại",
      preferredContactTime: fields.preferredContactTime ?? "",
      expectedCloseDate: fields.expectedCloseDate ?? "",
      nextContactDate: fields.nextContactDate ?? "",
      notes: fields.notes ?? "",
      owner: fields.owner ?? String(payload.enteredBy ?? "Chưa phân công").trim(),
      enteredBy: fields.enteredBy ?? "Chưa rõ",
      lastContact: fields.lastContact || "ĐÃ TẠO HỒ SƠ KHÁCH HÀNG",
      nextAction: fields.nextAction || "Liên hệ khách mới trong hôm nay",
      zalo: fields.zalo ?? "",
      projectStage: fields.projectStage ?? "",
      numberOfFloors: fields.numberOfFloors ?? 0,
      numberOfBathrooms: fields.numberOfBathrooms ?? 0,
      estimatedTileDate: fields.estimatedTileDate ?? "",
      estimatedBathroomInstallDate: fields.estimatedBathroomInstallDate ?? "",
      budgetMin: fields.budgetMin ?? 0,
      budgetMax: fields.budgetMax ?? 0,
      interestedProducts: fields.interestedProducts ?? "",
      mainConcern: fields.mainConcern ?? "",
      objection: fields.objection ?? "",
      decisionMaker: fields.decisionMaker ?? "",
      competitor: fields.competitor ?? "",
      nextActionType: fields.nextActionType ?? "",
      nextActionTime: fields.nextActionTime ?? "",
    }).returning();
    return Response.json({ customer }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Khách hàng chưa hợp lệ." }, { status: 400 });
    if (payload.funnelStage !== undefined && !allowedStages.has(String(payload.funnelStage))) {
      return Response.json({ error: "Trạng thái phễu chưa hợp lệ." }, { status: 400 });
    }
    if (payload.priority !== undefined && !allowedPriorities.has(String(payload.priority))) {
      return Response.json({ error: "Mức ưu tiên chưa hợp lệ." }, { status: 400 });
    }
    if (payload.contactResult !== undefined && !allowedContactResults.has(String(payload.contactResult))) {
      return Response.json({ error: "Kết quả liên hệ chưa hợp lệ." }, { status: 400 });
    }
    if (payload.phone !== undefined && String(payload.phone).replace(/\D/g, "").length < 9) {
      return Response.json({ error: "Số điện thoại chưa hợp lệ." }, { status: 400 });
    }

    // Không cho chuyển sang "Mất khách" nếu chưa chọn lý do (theo brief).
    const movingToLost = payload.funnelStage !== undefined && String(payload.funnelStage) === "lost";
    if (movingToLost && !allowedLossReasons.has(String(payload.lossReason ?? "").trim())) {
      return Response.json({ error: "Vui lòng chọn lý do mất khách." }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!existing) return Response.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });

    const fields = fieldsFromPayload(payload, existing);
    const nowStamp = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
    const autoLostAt = movingToLost && !existing.lostAt.trim() && fields.lostAt === undefined ? nowStamp : undefined;
    const autoLostBy =
      movingToLost && !existing.lostBy.trim() && fields.lostBy === undefined
        ? String(payload.enteredBy ?? existing.owner ?? "").trim() || "Chưa rõ"
        : undefined;
    // Đang chuyển sang "đã liên hệ được" lần đầu mà chưa có mốc giờ gọi -> ghi nhận ngay (SLA gọi lần 1).
    const autoFirstCallAt = payload.contactResult === "da_lien_he" && !existing.firstCallAt.trim() && fields.firstCallAt === undefined
      ? new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "")
      : undefined;

    const [customer] = await db.update(customers).set({
      fullName: fields.fullName,
      phone: fields.phone,
      email: fields.email,
      address: fields.address,
      ward: fields.ward,
      inZone: fields.inZone,
      source: fields.source,
      campaign: fields.campaign,
      referrer: fields.referrer,
      constructionStageAtLead: fields.constructionStageAtLead,
      funnelStage: payload.funnelStage === undefined ? undefined : String(payload.funnelStage),
      priority: fields.priority,
      firstCallAt: fields.firstCallAt ?? autoFirstCallAt,
      contactResult: payload.contactResult === undefined ? undefined : String(payload.contactResult),
      appointmentDate: fields.appointmentDate,
      arrived: fields.arrived,
      closedDate: fields.closedDate,
      value: fields.value,
      itemCount: fields.itemCount,
      lossReason: fields.lossReason,
      need: fields.need,
      projectType: fields.projectType,
      stylePreference: fields.stylePreference,
      dimensions: fields.dimensions,
      purchaseTimeline: fields.purchaseTimeline,
      preferredChannel: fields.preferredChannel,
      preferredContactTime: fields.preferredContactTime,
      expectedCloseDate: fields.expectedCloseDate,
      nextContactDate: fields.nextContactDate,
      notes: fields.notes,
      owner: fields.owner,
      enteredBy: fields.enteredBy,
      lastContact: fields.lastContact,
      nextAction: fields.nextAction,
      zalo: fields.zalo,
      projectStage: fields.projectStage,
      numberOfFloors: fields.numberOfFloors,
      numberOfBathrooms: fields.numberOfBathrooms,
      estimatedTileDate: fields.estimatedTileDate,
      estimatedBathroomInstallDate: fields.estimatedBathroomInstallDate,
      budgetMin: fields.budgetMin,
      budgetMax: fields.budgetMax,
      interestedProducts: fields.interestedProducts,
      mainConcern: fields.mainConcern,
      objection: fields.objection,
      decisionMaker: fields.decisionMaker,
      competitor: fields.competitor,
      nextActionType: fields.nextActionType,
      nextActionTime: fields.nextActionTime,
      lostNote: fields.lostNote,
      lostCompetitor: fields.lostCompetitor,
      lostAt: fields.lostAt ?? autoLostAt,
      lostBy: fields.lostBy ?? autoLostBy,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(customers.id, id)).returning();
    return Response.json({ customer });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: number };
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Khách hàng chưa hợp lệ." }, { status: 400 });
    const [deleted] = await getDb().delete(customers).where(eq(customers.id, id)).returning({ id: customers.id });
    if (!deleted) return Response.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });
    return Response.json({ deletedId: deleted.id });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
