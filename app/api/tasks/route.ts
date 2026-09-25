import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { customers, projects, tasks } from "../../../db/schema";
import { TASK_TYPES } from "../../../db/enums";
import { addDays } from "../../../lib/format";

const allowedTypes = new Set<string>(TASK_TYPES);
const autoTaskNote = "Tự động chuyển từ kế hoạch chăm sóc khách hàng";
const crossSellNote = "Tự động sinh theo lịch thi công — xem Playbook bán chéo theo giai đoạn công trình";

// 4 điểm chạm theo lịch thi công (mốc thời gian là kiến thức ngành phổ thông,
// dùng làm mặc định khi chưa có ngày ốp lát dự kiến cụ thể của công trình).
const CROSS_SELL_TOUCHPOINTS = [
  { offsetDays: 5, title: "Chạm 1 — Kiểm tra hàng giao & hỏi lịch thợ ốp lát", useExpectedTiling: false },
  { offsetDays: 21, title: "Chạm 2 — Chốt chủng loại TBVS trước khi ốp lát (ốp xong không đổi được)", useExpectedTiling: true },
  { offsetDays: 42, title: "Chạm 3 — Xin ảnh công trình lắp TBVS & hỏi kế hoạch bếp", useExpectedTiling: false },
  { offsetDays: 75, title: "Chạm 4 — Chốt đơn thiết bị bếp trước khi đóng tủ", useExpectedTiling: false },
] as const;

function suggestTaskTime(title: string) {
  const text = title.toLocaleLowerCase("vi");
  if (/gọi|điện thoại/.test(text)) return "09:00";
  if (/gửi|mẫu|zalo/.test(text)) return "10:00";
  if (/hẹn|khảo sát|showroom|gặp/.test(text)) return "14:00";
  if (/báo giá|theo dõi|chốt/.test(text)) return "15:30";
  if (/giao hàng|lắp đặt/.test(text)) return "08:30";
  if (/chạm \d/i.test(title)) return "10:30";
  return "09:30";
}

function selectTasks(db: ReturnType<typeof getDb>) {
  return db.select({
    id: tasks.id,
    customerId: tasks.customerId,
    projectId: tasks.projectId,
    customerName: customers.fullName,
    customerPhone: customers.phone,
    projectCode: projects.projectCode,
    title: tasks.title,
    type: tasks.type,
    dueDate: tasks.dueDate,
    dueTime: tasks.dueTime,
    status: tasks.status,
    assignedTo: tasks.assignedTo,
    notes: tasks.notes,
    createdAt: tasks.createdAt,
    updatedAt: tasks.updatedAt,
  }).from(tasks)
    .leftJoin(customers, eq(tasks.customerId, customers.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .orderBy(asc(tasks.dueDate), asc(tasks.dueTime), asc(tasks.id)).limit(1000);
}

async function syncAutoFollowupTasks(db: ReturnType<typeof getDb>) {
  const [customerPlans, automaticTasks] = await Promise.all([
    db.select({ id: customers.id, nextAction: customers.nextAction, nextContactDate: customers.nextContactDate, nextActionTime: customers.nextActionTime, owner: customers.owner, funnelStage: customers.funnelStage }).from(customers).limit(1000),
    db.select({ id: tasks.id, customerId: tasks.customerId, title: tasks.title, dueDate: tasks.dueDate, dueTime: tasks.dueTime, assignedTo: tasks.assignedTo, status: tasks.status })
      .from(tasks).where(eq(tasks.type, "auto_followup")).limit(2000),
  ]);

  for (const plan of customerPlans) {
    // Khách đã mất/tạm hoãn thì không tự sinh việc tiếp theo nữa.
    if (plan.funnelStage === "lost" || plan.funnelStage === "paused") continue;
    const title = plan.nextAction.trim();
    const dueDate = plan.nextContactDate.trim();
    const dueTime = /^\d{2}:\d{2}$/.test(plan.nextActionTime.trim()) ? plan.nextActionTime.trim() : suggestTaskTime(title);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !plan.owner.trim()) continue;

    const openTask = automaticTasks.find((task) => task.customerId === plan.id && task.status === "open");
    if (openTask) {
      if (openTask.title !== title || openTask.dueDate !== dueDate || openTask.dueTime !== dueTime || openTask.assignedTo !== plan.owner) {
        await db.update(tasks).set({ title, dueDate, dueTime, assignedTo: plan.owner, notes: autoTaskNote, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(tasks.id, openTask.id));
      }
      continue;
    }
    const alreadyCompleted = automaticTasks.some((task) => task.customerId === plan.id && task.status === "done" && task.title === title && task.dueDate === dueDate);
    if (!alreadyCompleted) {
      await db.insert(tasks).values({ customerId: plan.id, title, type: "auto_followup", dueDate, dueTime, assignedTo: plan.owner, notes: autoTaskNote });
    }
  }
}

async function syncCrossSellTasks(db: ReturnType<typeof getDb>) {
  const [activeProjects, crossSellTasks] = await Promise.all([
    db.select({ id: projects.id, tileDeliveredAt: projects.tileDeliveredAt, expectedTilingAt: projects.expectedTilingAt, owner: customers.owner, status: projects.status })
      .from(projects).leftJoin(customers, eq(projects.customerId, customers.id)).where(eq(projects.status, "dang_trien_khai")).limit(1000),
    db.select({ id: tasks.id, projectId: tasks.projectId, title: tasks.title }).from(tasks).where(eq(tasks.type, "cross_sell")).limit(4000),
  ]);

  for (const project of activeProjects) {
    if (!project.tileDeliveredAt.trim() || !/^\d{4}-\d{2}-\d{2}/.test(project.tileDeliveredAt)) continue;
    const owner = project.owner?.trim() || "Chưa phân công";
    const baseDate = project.tileDeliveredAt.slice(0, 10);
    for (const touchpoint of CROSS_SELL_TOUCHPOINTS) {
      const exists = crossSellTasks.some((task) => task.projectId === project.id && task.title === touchpoint.title);
      if (exists) continue;
      const dueDate = touchpoint.useExpectedTiling && project.expectedTilingAt.trim() ? project.expectedTilingAt.slice(0, 10) : addDays(baseDate, touchpoint.offsetDays);
      await db.insert(tasks).values({
        projectId: project.id,
        title: touchpoint.title,
        type: "cross_sell",
        dueDate,
        dueTime: suggestTaskTime(touchpoint.title),
        assignedTo: owner,
        notes: crossSellNote,
      });
    }
  }
}

export async function GET() {
  try {
    const db = getDb();
    await syncAutoFollowupTasks(db);
    await syncCrossSellTasks(db);

    const tasksWithoutTime = await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(and(eq(tasks.status, "open"), eq(tasks.dueTime, ""))).limit(1000);
    for (const task of tasksWithoutTime) {
      await db.update(tasks).set({ dueTime: suggestTaskTime(task.title), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(tasks.id, task.id));
    }

    return Response.json({ tasks: await selectTasks(db) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi xảy ra" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const title = String(payload.title ?? "").trim();
    const type = String(payload.type ?? "followup");
    const dueDate = String(payload.dueDate ?? "").trim();
    const assignedTo = String(payload.assignedTo ?? "").trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !assignedTo || !allowedTypes.has(type)) {
      return Response.json({ error: "Thông tin công việc chưa đầy đủ." }, { status: 400 });
    }
    const customerId = payload.customerId ? Number(payload.customerId) : null;
    const validCustomerId = customerId && Number.isInteger(customerId) ? customerId : null;
    const projectId = payload.projectId ? Number(payload.projectId) : null;
    const validProjectId = projectId && Number.isInteger(projectId) ? projectId : null;
    const requestedTime = String(payload.dueTime ?? "").trim();
    const dueTime = /^\d{2}:\d{2}$/.test(requestedTime) ? requestedTime : suggestTaskTime(title);
    const notes = String(payload.notes ?? "").trim();
    const db = getDb();
    if (type === "auto_followup" && validCustomerId) {
      const [existing] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.customerId, validCustomerId), eq(tasks.type, "auto_followup"), eq(tasks.status, "open"))).limit(1);
      if (existing) {
        const [task] = await db.update(tasks).set({ title, dueDate, dueTime, assignedTo, notes, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(tasks.id, existing.id)).returning();
        return Response.json({ task });
      }
    }
    const [task] = await db.insert(tasks).values({ customerId: validCustomerId, projectId: validProjectId, title, type, dueDate, dueTime, assignedTo, notes }).returning();
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi xảy ra" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as { id?: number; status?: string };
    const id = Number(payload.id);
    const status = String(payload.status ?? "");
    if (!Number.isInteger(id) || !["open", "done"].includes(status)) return Response.json({ error: "Công việc chưa hợp lệ." }, { status: 400 });
    const [task] = await getDb().update(tasks).set({ status, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(tasks.id, id)).returning();
    if (!task) return Response.json({ error: "Không tìm thấy công việc." }, { status: 404 });
    return Response.json({ task });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi xảy ra" }, { status: 500 });
  }
}
