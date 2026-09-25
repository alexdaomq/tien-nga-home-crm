import { and, desc, eq } from "drizzle-orm";
import { getDb, getFiles } from "../../../db";
import { customers, documents } from "../../../db/schema";
import { DOC_TYPES } from "../../../db/enums";

const allowedDocTypes = new Set<string>(DOC_TYPES);
const MAX_SIZE = 15 * 1024 * 1024; // 15MB / file

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi xảy ra";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerId = Number(url.searchParams.get("customerId"));
    if (!Number.isInteger(customerId) || customerId < 1) {
      return Response.json({ error: "Thiếu customerId." }, { status: 400 });
    }
    const db = getDb();
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.customerId, customerId))
      .orderBy(desc(documents.createdAt), desc(documents.id))
      .limit(200);
    return Response.json({ documents: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const customerId = Number(form.get("customerId"));
    const docType = String(form.get("docType") ?? "bao_gia");
    const amount = Math.max(0, Number(form.get("amount")) || 0);
    const note = String(form.get("note") ?? "").trim();
    const uploadedBy = String(form.get("uploadedBy") ?? "").trim() || "Chưa rõ";

    if (!Number.isInteger(customerId) || customerId < 1) {
      return Response.json({ error: "Khách hàng chưa hợp lệ." }, { status: 400 });
    }
    if (!allowedDocTypes.has(docType)) {
      return Response.json({ error: "Loại tài liệu chưa hợp lệ." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Chưa chọn file." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: "File quá lớn (tối đa 15MB)." }, { status: 400 });
    }

    const db = getDb();
    const [existingCustomer] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!existingCustomer) {
      return Response.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
    const r2Key = `customers/${customerId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
    const contentType = file.type || "application/octet-stream";

    const files = getFiles();
    await files.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType } });

    const [doc] = await db
      .insert(documents)
      .values({ customerId, docType, fileName: file.name, contentType, r2Key, size: file.size, amount, note, uploadedBy })
      .returning();

    return Response.json({ document: doc }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: number };
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Tài liệu chưa hợp lệ." }, { status: 400 });
    }
    const db = getDb();
    const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc) return Response.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });

    try {
      await getFiles().delete(doc.r2Key);
    } catch {
      // File có thể đã bị xoá — vẫn xoá bản ghi để dọn danh sách.
    }
    await db.delete(documents).where(and(eq(documents.id, id)));
    return Response.json({ deletedId: id });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
