import { getDb } from "../../../../db";
import { activities, customers } from "../../../../db/schema";
import { FUNNEL_STAGES, PRIORITIES, isSoldStage } from "../../../../db/enums";
import { canonicalOwner, defaultNextAction, isValidPhone, normalizePhone } from "../../../../lib/customer-import";
import { todayISO } from "../../../../lib/format";

// POST /api/customers/import — nhập 1 "lô" khách từ file Excel/CSV (trình duyệt tự chia lô
// ~10 khách/lần để không vượt giới hạn số truy vấn D1 mỗi lần gọi).
// Body: { enteredBy, rows: [{ fullName, phone, address, need, owner, source, priority, stage, note }] }
// Trả về: { results: [{ index, status: "created" | "duplicate" | "error", message, customerId? }] }

const MAX_ROWS_PER_REQUEST = 20;
const allowedStages = new Set<string>(FUNNEL_STAGES);
const allowedPriorities = new Set<string>(PRIORITIES);

type Result = { index: number; status: "created" | "duplicate" | "error"; message: string; customerId?: number };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { enteredBy?: string; rows?: Record<string, unknown>[] };
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const person = String(body.enteredBy ?? "").trim() || "Chưa rõ";
    if (rows.length === 0) return Response.json({ error: "Không có dòng nào để nhập." }, { status: 400 });
    if (rows.length > MAX_ROWS_PER_REQUEST) return Response.json({ error: `Mỗi lần tối đa ${MAX_ROWS_PER_REQUEST} khách.` }, { status: 400 });

    const db = getDb();
    const existingPhones = new Set((await db.select({ phone: customers.phone }).from(customers)).map((r) => normalizePhone(r.phone)));
    const today = todayISO();
    const results: Result[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fullName = String(row.fullName ?? "").trim().slice(0, 60);
      const phone = normalizePhone(String(row.phone ?? ""));
      if (fullName.length < 2) { results.push({ index: i, status: "error", message: "Thiếu tên khách" }); continue; }
      if (!isValidPhone(phone)) { results.push({ index: i, status: "error", message: "SĐT không hợp lệ" }); continue; }
      if (existingPhones.has(phone)) { results.push({ index: i, status: "duplicate", message: "Đã có trong CRM — bỏ qua" }); continue; }

      const stage = allowedStages.has(String(row.stage)) ? String(row.stage) : "lead";
      const priority = allowedPriorities.has(String(row.priority)) ? String(row.priority) : "warm";
      const note = String(row.note ?? "").trim();
      const sold = isSoldStage(stage);
      const next = defaultNextAction(stage);

      try {
        const [created] = await db.insert(customers).values({
          leadCode: `LEAD-${Date.now().toString(36).toUpperCase()}${i.toString(36).toUpperCase()}`,
          fullName,
          phone,
          address: String(row.address ?? "").trim(),
          need: String(row.need ?? "").trim(),
          owner: canonicalOwner(String(row.owner ?? ""), person),
          source: String(row.source ?? "").trim() || "Khác",
          funnelStage: stage,
          priority,
          contactResult: stage === "lead" ? "chua_lien_he" : "da_lien_he",
          arrived: stage === "arrived" || sold ? 1 : 0,
          closedDate: sold ? today : "",
          lossReason: stage === "lost" ? "khac" : "",
          lostAt: stage === "lost" ? today : "",
          lostBy: stage === "lost" ? person : "",
          enteredBy: person,
          notes: note,
          lastContact: "NHẬP TỪ FILE EXCEL",
          nextAction: next.nextAction,
          nextActionType: next.nextActionType,
          nextContactDate: next.nextAction ? today : "",
          nextActionTime: next.nextAction ? "09:00" : "",
        }).returning({ id: customers.id });

        await db.insert(activities).values({
          customerId: created.id,
          content: note ? `Nhập từ file Excel. Ghi chú: ${note}` : "Nhập từ file Excel.",
          enteredBy: person,
        });

        existingPhones.add(phone);
        results.push({ index: i, status: "created", message: "Đã thêm", customerId: created.id });
      } catch (error) {
        const msg = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : "";
        results.push({ index: i, status: /unique/i.test(msg) ? "duplicate" : "error", message: /unique/i.test(msg) ? "Đã có trong CRM — bỏ qua" : "Không lưu được" });
      }
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Có lỗi khi nhập file." }, { status: 500 });
  }
}
