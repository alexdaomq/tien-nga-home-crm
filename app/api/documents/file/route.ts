import { eq } from "drizzle-orm";
import { getDb, getFiles } from "../../../../db";
import { documents } from "../../../../db/schema";

// Trả file thật về trình duyệt (xem/tải). Ảnh & PDF hiển thị trực tiếp, còn lại tải xuống.
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) {
      return new Response("Thiếu id.", { status: 400 });
    }
    const db = getDb();
    const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc) return new Response("Không tìm thấy tài liệu.", { status: 404 });

    const object = await getFiles().get(doc.r2Key);
    if (!object) return new Response("File không còn trên hệ thống.", { status: 404 });

    const contentType = object.httpMetadata?.contentType || doc.contentType || "application/octet-stream";
    const inline = /^(image\/|application\/pdf)/.test(contentType);
    const asciiName = doc.fileName.replace(/[^\x20-\x7E]/g, "_");
    return new Response(object.body as BodyInit, {
      headers: {
        "content-type": contentType,
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Có lỗi xảy ra", { status: 500 });
  }
}
