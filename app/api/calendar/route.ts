import { eq } from "drizzle-orm";
import { getDb, getOrCreateSettings } from "../../../db";
import { customers, projects, tasks } from "../../../db/schema";
import { buildIcsFeed, deriveCalendarToken } from "../../../lib/calendar-feed";
import { TEAM_MEMBERS } from "../../../lib/types";

// Feed lịch .ics cho một người (hoặc "all" cho toàn đội) — đăng ký một lần trong
// app Lịch trên iPhone, việc cần làm/lịch hẹn tự đồng bộ vào kèm nhắc giờ, không
// cần Zalo OA/n8n. Bảo vệ bằng token riêng theo người (xem tab Chỉ số vận hành).
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const person = (url.searchParams.get("person") ?? "").trim();
    const token = (url.searchParams.get("token") ?? "").trim();
    const validPersons = new Set<string>([...TEAM_MEMBERS, "all"]);
    if (!person || !validPersons.has(person)) {
      return new Response("Thiếu hoặc sai tham số person.", { status: 400 });
    }

    const db = getDb();
    const settings = await getOrCreateSettings(db);
    const expectedToken = await deriveCalendarToken(person, settings.calendarSecret);
    if (!token || token !== expectedToken) {
      return new Response("Link lịch không hợp lệ hoặc đã bị đổi khoá — lấy lại link mới trong CRM.", { status: 401 });
    }

    const rows = await db.select({
      id: tasks.id,
      title: tasks.title,
      type: tasks.type,
      dueDate: tasks.dueDate,
      dueTime: tasks.dueTime,
      assignedTo: tasks.assignedTo,
      notes: tasks.notes,
      status: tasks.status,
      customerName: customers.fullName,
      customerPhone: customers.phone,
      projectCode: projects.projectCode,
    }).from(tasks)
      .leftJoin(customers, eq(tasks.customerId, customers.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.status, "open"))
      .limit(1000);

    const filtered = person === "all" ? rows : rows.filter((row) => row.assignedTo === person);
    const ics = buildIcsFeed(person === "all" ? "Toàn đội" : person, filtered);

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Có lỗi khi tạo lịch.", { status: 500 });
  }
}
