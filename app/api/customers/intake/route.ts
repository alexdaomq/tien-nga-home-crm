import { and, eq, sql } from "drizzle-orm";
import { getDb, getOrCreateSettings } from "../../../../db";
import { activities, customers } from "../../../../db/schema";

// ============================================================================
// POST /api/customers/intake — thêm khách từ MỘT ĐOẠN TEXT tự do (luồng tự động
// bên ngoài: n8n, Zalo bot, form...). Tự trích xuất Tên / SĐT / Địa chỉ / Nhu cầu,
// chuẩn hoá SĐT về 10 số bắt đầu bằng 0, và tự gán sale theo "phụ trách khu".
//
// Bảo mật:   header x-webhook-secret phải khớp app_settings.webhookSecret
//            (lấy/tạo tại tab Chỉ số vận hành → Tích hợp AI tự động).
// Chống spam: giới hạn số khách tạo qua API này trong 60 giây gần nhất.
// Trùng SĐT: KHÔNG cập nhật — chỉ trả về mã EXISTS.
//
// Body JSON: { "text": "..." }  (cũng nhận "message"/"content"; hoặc gửi thẳng
//            text/plain làm body). Tuỳ chọn: { "source": "Zalo" }.
// Trả về:    { code, message, customerId?, owner?, extracted? }
//   code ∈ CREATED | EXISTS | INVALID | UNAUTHORIZED | RATE_LIMITED | ERROR
// ============================================================================

const SOURCE_TAG = "API tự động";
const MAX_INTAKE_PER_MINUTE = 20; // quá số này trong 60s -> chặn (chống spam)

// >>> PHỤ TRÁCH KHU — CHỈNH DANH SÁCH NÀY theo phân vùng thật của shop <<<
// Khớp không dấu trên địa chỉ; không khớp -> "Chưa phân công" (sale tự nhận).
const ZONE_OWNERS: { match: string; ward: string; owner: string }[] = [
  { match: "dong anh", ward: "Đông Anh", owner: "Liên" },
  { match: "me linh", ward: "Mê Linh", owner: "Cần" },
  { match: "soc son", ward: "Sóc Sơn", owner: "Hương" },
  { match: "bac tu liem", ward: "Bắc Từ Liêm", owner: "Liên" },
  { match: "phuc yen", ward: "Phúc Yên", owner: "Hương" },
];

function noAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

// Quy SĐT về 10 số bắt đầu bằng 0 (bỏ +84/84/0084, khoảng trắng, dấu chấm/gạch).
function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0084")) d = "0" + d.slice(4);
  else if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  else if (d.length === 9 && !d.startsWith("0")) d = "0" + d;
  return d;
}
const isValidPhone = (p: string) => /^0\d{9}$/.test(p);

// Lấy giá trị theo nhãn "Nhãn: giá trị" (chấp nhận có dấu / không dấu, ':' hoặc '-').
function pickField(text: string, labels: string[]): string {
  const alt = labels.join("|");
  const re = new RegExp(`(?:^|\\n)\\s*(?:${alt})\\s*[:\\-]\\s*(.+?)\\s*(?:\\n|$)`, "i");
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

// Tìm SĐT trong 1 chuỗi (chấp nhận có khoảng trắng/dấu chấm/gạch giữa các số).
function findPhone(text: string): string {
  const candidates = text.match(/(?:\+?84|0)[\d.\-\s]{7,14}\d/g) ?? [];
  for (const c of candidates) {
    const p = normalizePhone(c);
    if (isValidPhone(p)) return p;
  }
  // Thử thêm dãy số thuần (thiếu số 0 đầu).
  for (const c of text.match(/\d[\d.\-\s]{7,14}\d/g) ?? []) {
    const p = normalizePhone(c);
    if (isValidPhone(p)) return p;
  }
  return "";
}

function extract(text: string) {
  const nameLabels = ["họ và tên", "ho va ten", "họ tên", "ho ten", "tên khách hàng", "ten khach hang", "khách hàng", "khach hang", "tên", "ten", "khách", "khach"];
  const phoneLabels = ["số điện thoại", "so dien thoai", "điện thoại", "dien thoai", "sđt", "sdt", "phone", "tel", "đt", "dt"];
  const addrLabels = ["địa chỉ", "dia chi", "address", "đc", "dc"];
  const needLabels = ["nhu cầu", "nhu cau", "cần mua", "can mua", "yêu cầu", "yeu cau", "sản phẩm", "san pham", "cần", "can"];

  // SĐT: ưu tiên dòng có nhãn, không có thì quét cả text.
  const phoneLabeled = pickField(text, phoneLabels);
  const phone = findPhone(phoneLabeled) || findPhone(text);

  // Tên: theo nhãn; nếu không có thì thử mẫu "Chị/Anh/... Tên"; rồi tới dòng đầu; rồi phần đầu câu.
  let fullName = pickField(text, nameLabels);
  if (!fullName) {
    const titled = text.match(/(?:chị|anh|cô|chú|em|bác|ông|bà)\s+\p{L}+/iu);
    if (titled) fullName = titled[0].trim();
  }
  if (!fullName) {
    fullName = text.split("\n").map((l) => l.trim()).find((l) => l && !findPhone(l) && /\p{L}/u.test(l)) ?? "";
  }
  if (!fullName) {
    const head = text.split(/\bở\b|\btại\b|sđt|sdt|đt(?![\p{L}])|,|\n/iu)[0].trim();
    if (head && !findPhone(head)) fullName = head;
  }
  // Cắt phần dính SĐT/nhiễu ở cuối tên, giới hạn độ dài.
  fullName = fullName.replace(/[\d.\-\s]{6,}.*$/, "").trim().slice(0, 60);

  const address = pickField(text, addrLabels);
  const need = pickField(text, needLabels);

  // Phụ trách khu: khớp địa chỉ (rồi tới cả text) với ZONE_OWNERS.
  const hay = noAccent(`${address} ${text}`);
  const zone = ZONE_OWNERS.find((z) => hay.includes(z.match));

  return {
    fullName,
    phone,
    address,
    need,
    ward: zone?.ward ?? "",
    owner: zone?.owner ?? "Chưa phân công",
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi khi xử lý.";
}

async function readText(request: Request): Promise<string> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    return String(body.text ?? body.message ?? body.content ?? "").trim();
  }
  return (await request.text()).trim();
}

export async function POST(request: Request) {
  try {
    const db = getDb();

    // 1) Bảo mật — khoá bí mật.
    const providedSecret = request.headers.get("x-webhook-secret") ?? "";
    const settings = await getOrCreateSettings(db);
    if (!providedSecret || providedSecret !== settings.webhookSecret) {
      return Response.json({ code: "UNAUTHORIZED", message: "Khoá bí mật không đúng hoặc thiếu header x-webhook-secret." }, { status: 401 });
    }

    // 2) Chống spam — giới hạn số khách tạo qua API này trong 60 giây.
    const recent = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.enteredBy, SOURCE_TAG), sql`${customers.createdAt} >= datetime('now','-60 seconds')`));
    if (recent.length >= MAX_INTAKE_PER_MINUTE) {
      return Response.json({ code: "RATE_LIMITED", message: "Quá nhiều yêu cầu trong thời gian ngắn, thử lại sau ít phút." }, { status: 429 });
    }

    // 3) Đọc + trích xuất.
    const text = await readText(request);
    if (text.length < 3) {
      return Response.json({ code: "INVALID", message: "Thiếu nội dung text." }, { status: 400 });
    }
    const info = extract(text);
    if (info.fullName.length < 2) {
      return Response.json({ code: "INVALID", message: "Không đọc được tên khách. Gợi ý gửi kèm nhãn 'Tên: ...'." }, { status: 400 });
    }
    if (!isValidPhone(info.phone)) {
      return Response.json({ code: "INVALID", message: "Không đọc được số điện thoại hợp lệ (10 số bắt đầu bằng 0)." }, { status: 400 });
    }

    // 4) Trùng SĐT -> KHÔNG cập nhật, chỉ báo đã tồn tại.
    const existingRows = await db.select().from(customers).limit(3000);
    const existing = existingRows.find((row) => normalizePhone(row.phone) === info.phone);
    if (existing) {
      return Response.json({
        code: "EXISTS",
        message: `Khách hàng đã tồn tại (SĐT ${info.phone} — ${existing.fullName}). Bỏ qua, không cập nhật.`,
        customerId: existing.id,
      });
    }

    // 5) Tạo mới.
    const leadCode = `LEAD-${Date.now().toString(36).toUpperCase()}`;
    const [customer] = await db.insert(customers).values({
      leadCode,
      fullName: info.fullName,
      phone: info.phone,
      address: info.address,
      ward: info.ward,
      source: "Khác",
      need: info.need,
      funnelStage: "lead",
      priority: "warm",
      contactResult: "chua_lien_he",
      owner: info.owner,
      enteredBy: SOURCE_TAG,
      notes: `Tạo tự động từ API. Nội dung gốc: ${text.slice(0, 500)}`,
      lastContact: "TẠO TỰ ĐỘNG TỪ API",
      nextAction: "Gọi xác nhận khách mới (nguồn tự động)",
      nextActionType: "goi_khach",
      nextContactDate: new Date().toISOString().slice(0, 10),
      nextActionTime: "09:00",
    }).returning();

    await db.insert(activities).values({
      customerId: customer.id,
      content: `API tự động ghi nhận: ${info.fullName} · ${info.phone}${info.address ? ` · ${info.address}` : ""}${info.need ? ` · nhu cầu: ${info.need}` : ""}. Phụ trách khu: ${info.owner}.`,
      enteredBy: SOURCE_TAG,
    });

    return Response.json({
      code: "CREATED",
      message: `Đã thêm khách ${info.fullName}, phụ trách: ${info.owner}.`,
      customerId: customer.id,
      leadCode: customer.leadCode,
      owner: info.owner,
      extracted: info,
    }, { status: 201 });
  } catch (error) {
    return Response.json({ code: "ERROR", message: errorMessage(error) }, { status: 500 });
  }
}
