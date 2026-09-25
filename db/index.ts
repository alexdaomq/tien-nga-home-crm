import { env } from "cloudflare:workers";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { appSettings } from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

// Kho lưu file (Cloudflare R2, binding `FILES`) — dùng cho tài liệu/báo giá gửi khách.
export type FileBucket = {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: unknown; httpMetadata?: { contentType?: string }; size?: number } | null>;
  delete(key: string): Promise<void>;
};

export function getFiles(): FileBucket {
  const bucket = (env as unknown as { FILES?: FileBucket }).FILES;
  if (!bucket) {
    throw new Error("Cloudflare R2 binding `FILES` is unavailable. Set the `r2` field in .openai/hosting.json to `FILES` and bind the bucket.");
  }
  return bucket;
}

function generateSecret() {
  return crypto.randomUUID().replace(/-/g, "");
}

// Đảm bảo có đúng một dòng cấu hình, luôn có sẵn webhookSecret/calendarSecret
// (sinh mới nếu còn trống) — dùng chung cho route settings, webhook ghi khách
// tự động, và route sinh link lịch (.ics) riêng cho từng người.
export async function getOrCreateSettings(db: ReturnType<typeof getDb>) {
  let [row] = await db.select().from(appSettings).limit(1);
  if (!row) {
    [row] = await db.insert(appSettings).values({ marginRate: 25, webhookSecret: generateSecret(), calendarSecret: generateSecret() }).returning();
    return row;
  }
  const patch: { webhookSecret?: string; calendarSecret?: string } = {};
  if (!row.webhookSecret) patch.webhookSecret = generateSecret();
  if (!row.calendarSecret) patch.calendarSecret = generateSecret();
  if (Object.keys(patch).length > 0) {
    [row] = await db.update(appSettings).set({ ...patch, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appSettings.id, row.id)).returning();
  }
  return row;
}
