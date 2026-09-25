import { env } from "cloudflare:workers";

const fields = [
  ["sequenceNo", "sequence_no"], ["category", "category"], ["displayName", "display_name"],
  ["mainProducts", "main_products"], ["primaryContact", "primary_contact"], ["phoneZalo", "phone_zalo"],
  ["backupContact", "backup_contact"], ["zaloGroup", "zalo_group"], ["warehouseAddress", "warehouse_address"],
  ["orderingMethod", "ordering_method"], ["deliveryLeadTime", "delivery_lead_time"], ["salesFrequency", "sales_frequency"],
  ["paymentTerms", "payment_terms"], ["personality", "personality"], ["negotiation", "negotiation"],
  ["warrantyContact", "warranty_contact"], ["tienNgaOwner", "tien_nga_owner"], ["status", "status"],
  ["notes", "notes"], ["lastUpdated", "last_updated"],
] as const;

const seedRows: string[][] = [
  ["1", "THIẾT BỊ VỆ SINH", "MUKO", "Sen vòi MUKO, phụ kiện", "Anh Huy", "", "", "", "Vĩnh Phúc, Ba Đình, HN", "", "Hàng sẵn: 1-2 ngày · Đặt riêng: 7 ngày", "1 đơn/tháng. hết gì mới lấy", "Cuối tháng", "Bình thường", "Có nhưng phải khéo", "Gọi anh Huy", "Cần", "Đang lấy hàng", "", "13/8/2026"],
  ["2", "THIẾT BỊ VỆ SINH", "SKYLER", "", "Vinh"],
  ["3", "THIẾT BỊ VỆ SINH", "SENCY", "", "Dũng"],
  ["4", "THIẾT BỊ VỆ SINH", "INAX", "Bệt, chậu, sen, vòi, phụ kiện", "Lê Liên"],
  ["5", "THIẾT BỊ VỆ SINH", "VIGLACERA"],
  ["6", "THIẾT BỊ VỆ SINH", "KUTO"],
  ["1", "GẠCH VIỆT", "ĐỒNG TÂM"],
  ["2", "GẠCH VIỆT", "VIGLACERA HƯNG LONG"],
  ["3", "GẠCH VIỆT", "VIGLACERA VIỆT HƯNG"],
  ["4", "GẠCH VIỆT", "ROYAL"],
  ["5", "GẠCH VIỆT", "Ý MỸ"],
  ["6", "GẠCH VIỆT", "CATALAN - DANCO"],
  ["7", "GẠCH VIỆT", "TASA"],
  ["8", "GẠCH VIỆT", "VITTO"],
  ["9", "GẠCH VIỆT", "THẮNG CƯỜNG - VIGLACERA MINH HUY"],
  ["10", "GẠCH VIỆT", "TRƯỜNG PHÚ"],
  ["11", "GẠCH VIỆT", "MINH PHÚ"],
  ["12", "GẠCH VIỆT", "SƠN ANH"],
  ["13", "GẠCH VIỆT", "VNG"],
  ["14", "GẠCH VIỆT", "HUY TUYẾN"],
  ["15", "GẠCH VIỆT", "TOÀN THẮNG"],
  ["16", "GẠCH VIỆT", "BÌNH KIÊN"],
  ["17", "GẠCH TQ, ẤN ĐỘ", "HOÀNG NGUYỄN"],
  ["18", "GẠCH TQ, ẤN ĐỘ", "HẢI NAM"],
  ["19", "GẠCH TQ, ẤN ĐỘ", "TRUNG HUYỀN"],
  ["20", "GẠCH TQ, ẤN ĐỘ", "HẢI ĐĂNG"],
  ["21", "GẠCH TQ, ẤN ĐỘ", "VIỆT NHẬT"],
  ["22", "GẠCH TQ, ẤN ĐỘ", "QUỐC CƯỜNG"],
  ["1", "KEO", "WEBER"],
];

async function ensureSupplierDirectory() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS supplier_directory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_code TEXT NOT NULL,
    sequence_no TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL,
    main_products TEXT NOT NULL DEFAULT '',
    primary_contact TEXT NOT NULL DEFAULT '',
    phone_zalo TEXT NOT NULL DEFAULT '',
    backup_contact TEXT NOT NULL DEFAULT '',
    zalo_group TEXT NOT NULL DEFAULT '',
    warehouse_address TEXT NOT NULL DEFAULT '',
    ordering_method TEXT NOT NULL DEFAULT '',
    delivery_lead_time TEXT NOT NULL DEFAULT '',
    sales_frequency TEXT NOT NULL DEFAULT '',
    payment_terms TEXT NOT NULL DEFAULT '',
    personality TEXT NOT NULL DEFAULT '',
    negotiation TEXT NOT NULL DEFAULT '',
    warranty_contact TEXT NOT NULL DEFAULT '',
    tien_nga_owner TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    last_updated TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const info = await env.DB.prepare("PRAGMA table_info(supplier_directory)").all<{ name: string }>();
  const existing = new Set((info.results ?? []).map((column) => column.name));
  const additions = [
    ["sequence_no", "TEXT NOT NULL DEFAULT ''"], ["category", "TEXT NOT NULL DEFAULT ''"], ["main_products", "TEXT NOT NULL DEFAULT ''"],
    ["primary_contact", "TEXT NOT NULL DEFAULT ''"], ["phone_zalo", "TEXT NOT NULL DEFAULT ''"], ["backup_contact", "TEXT NOT NULL DEFAULT ''"],
    ["zalo_group", "TEXT NOT NULL DEFAULT ''"], ["ordering_method", "TEXT NOT NULL DEFAULT ''"], ["delivery_lead_time", "TEXT NOT NULL DEFAULT ''"],
    ["sales_frequency", "TEXT NOT NULL DEFAULT ''"], ["payment_terms", "TEXT NOT NULL DEFAULT ''"], ["personality", "TEXT NOT NULL DEFAULT ''"],
    ["negotiation", "TEXT NOT NULL DEFAULT ''"], ["warranty_contact", "TEXT NOT NULL DEFAULT ''"], ["tien_nga_owner", "TEXT NOT NULL DEFAULT ''"],
    ["status", "TEXT NOT NULL DEFAULT ''"], ["notes", "TEXT NOT NULL DEFAULT ''"], ["last_updated", "TEXT NOT NULL DEFAULT ''"],
    ["sort_order", "INTEGER NOT NULL DEFAULT 0"],
  ] as const;
  for (const [name, definition] of additions) {
    if (!existing.has(name)) await env.DB.prepare(`ALTER TABLE supplier_directory ADD COLUMN ${name} ${definition}`).run();
  }

  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_directory_code ON supplier_directory (supplier_code)").run();
  const insertColumns = fields.map(([, database]) => database).join(", ");
  const placeholders = fields.map(() => "?").join(", ");
  const statements = seedRows.map((row, index) => {
    const values = fields.map((_, fieldIndex) => row[fieldIndex] ?? "");
    const code = `NCC-SEED-${String(index + 1).padStart(3, "0")}`;
    return env.DB.prepare(`INSERT INTO supplier_directory (supplier_code, ${insertColumns}, sort_order, updated_by)
      SELECT ?, ${placeholders}, ?, ? WHERE NOT EXISTS (SELECT 1 FROM supplier_directory WHERE UPPER(display_name) = UPPER(?))`)
      .bind(code, ...values, index + 1, "Google Sheets", row[2]);
  });
  await env.DB.batch(statements);
}

function fromRow(row: Record<string, unknown>) {
  const supplier: Record<string, unknown> = {
    id: Number(row.id ?? 0),
    supplierCode: String(row.supplier_code ?? ""),
  };
  for (const [client, database] of fields) supplier[client] = String(row[database] ?? "");
  return supplier;
}

function clean(payload: Record<string, unknown>) {
  const supplier: Record<string, string> = {};
  for (const [client] of fields) supplier[client] = String(payload[client] ?? "").trim();
  return supplier;
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function errorResponse(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "Có lỗi khi lưu nhà cung cấp." }, { status: 500 });
}

export async function GET() {
  try {
    await ensureSupplierDirectory();
    const result = await env.DB.prepare("SELECT * FROM supplier_directory ORDER BY sort_order ASC, id ASC").all<Record<string, unknown>>();
    return Response.json({ suppliers: (result.results ?? []).map(fromRow) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureSupplierDirectory();
    const payload = await request.json() as Record<string, unknown>;
    const supplier = clean(payload);
    if (supplier.displayName.length < 2) return Response.json({ error: "Vui lòng nhập tên nhà cung cấp." }, { status: 400 });
    const nextOrder = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM supplier_directory").first<{ next_order: number }>();
    const columns = fields.map(([, database]) => database).join(", ");
    const placeholders = fields.map(() => "?").join(", ");
    const values = fields.map(([client]) => client === "lastUpdated" ? (supplier[client] || todayInVietnam()) : supplier[client]);
    const result = await env.DB.prepare(`INSERT INTO supplier_directory (supplier_code, ${columns}, sort_order, updated_by) VALUES (?, ${placeholders}, ?, ?)`)
      .bind(`NCC-${Date.now().toString(36).toUpperCase()}`, ...values, Number(nextOrder?.next_order ?? 1), String(payload.updatedBy ?? "").trim()).run();
    const row = await env.DB.prepare("SELECT * FROM supplier_directory WHERE id = ?").bind(Number(result.meta.last_row_id)).first<Record<string, unknown>>();
    return Response.json({ supplier: row ? fromRow(row) : null }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSupplierDirectory();
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Nhà cung cấp chưa hợp lệ." }, { status: 400 });
    const supplier = clean(payload);
    if (supplier.displayName.length < 2) return Response.json({ error: "Vui lòng nhập tên nhà cung cấp." }, { status: 400 });
    if (!supplier.lastUpdated) supplier.lastUpdated = todayInVietnam();
    await env.DB.prepare(`UPDATE supplier_directory SET ${fields.map(([, database]) => `${database} = ?`).join(", ")}, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...fields.map(([client]) => supplier[client]), String(payload.updatedBy ?? "").trim(), id).run();
    const row = await env.DB.prepare("SELECT * FROM supplier_directory WHERE id = ?").bind(id).first<Record<string, unknown>>();
    return row ? Response.json({ supplier: fromRow(row) }) : Response.json({ error: "Không tìm thấy nhà cung cấp." }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSupplierDirectory();
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Nhà cung cấp chưa hợp lệ." }, { status: 400 });
    await env.DB.prepare("DELETE FROM supplier_directory WHERE id = ?").bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
