import { and, eq, sql } from "drizzle-orm";
import { getDb, getOrCreateSettings } from "../../../../db";
import { activities, customers } from "../../../../db/schema";

// ============================================================================
// POST /api/customers/intake — thêm khách từ MỘT ĐOẠN TEXT tự do (luồng tự động
// bên ngoài: n8n, Zalo bot, form...). Tự trích Tên / SĐT / Địa chỉ / Nhu cầu,
// chuẩn hoá SĐT về 10 số bắt đầu bằng 0, và tự gán sale theo "phụ trách khu".
//
// Cũng nhận field có sẵn (nếu luồng ngoài đã trích giúp): { fullName, phone,
// address, need, ward } — field truyền vào được ưu tiên hơn phần đọc từ text.
//
// Bảo mật:   header x-webhook-secret khớp app_settings.webhookSecret.
// Chống spam: tối đa MAX_INTAKE_PER_MINUTE khách/60s qua API này.
// Trùng SĐT: KHÔNG cập nhật — trả về code EXISTS.
//
// Body JSON: { "text": "..." }  và/hoặc { fullName?, phone?, address?, need?, ward? }.
// Trả về:    { code, message, customerId?, owner?, extracted? }
//   code ∈ CREATED | EXISTS | INVALID | UNAUTHORIZED | RATE_LIMITED | ERROR
// ============================================================================

const SOURCE_TAG = "API tự động";
const MAX_INTAKE_PER_MINUTE = 20;

// >>> PHỤ TRÁCH KHU — CHỈNH DANH SÁCH NÀY theo phân vùng thật của shop <<<
// Khớp không dấu trên địa chỉ; không khớp -> "Chưa phân công" (sale tự nhận).
const ZONE_OWNERS: { match: string; ward: string; owner: string }[] = [
  { match: "dong anh", ward: "Đông Anh", owner: "Liên" },
  { match: "me linh", ward: "Mê Linh", owner: "Cần" },
  { match: "soc son", ward: "Sóc Sơn", owner: "Hương" },
  { match: "bac tu liem", ward: "Bắc Từ Liêm", owner: "Liên" },
  { match: "phuc yen", ward: "Phúc Yên", owner: "Hương" },
];

// Từ đứng ngay trước 1 số điện thoại cho thấy đó là số NHÂN VIÊN/kênh, không phải khách.
const STAFF_PHONE_CONTEXT = /(zalo|tu van vien|nhan vien|ban ay|lien he|hotline|tong dai|cua shop|cua em)/;

function noAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

// Quy SĐT về 10 số bắt đầu bằng 0.
function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0084")) d = "0" + d.slice(4);
  else if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  else if (d.length === 9 && !d.startsWith("0")) d = "0" + d;
  return d;
}
const isValidPhone = (p: string) => /^0\d{9}$/.test(p);

// Bỏ tiền tố xưng hô đầu tên: "anh Biên" -> "Biên".
function stripTitle(name: string): string {
  return name.replace(/^\s*(?:anh|chị|chi|cô|co|chú|chu|em|bác|bac|ông|ong|bà|ba)\s+/iu, "").trim();
}

function pickField(text: string, labels: string[]): string {
  const alt = labels.join("|");
  const re = new RegExp(`(?:^|\\n)\\s*(?:${alt})\\s*[:\\-]\\s*(.+?)\\s*(?:\\n|$)`, "i");
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

// Tìm SĐT KHÁCH: bỏ qua số đứng sau ngữ cảnh nhân viên (Zalo tư vấn viên...).
function findCustomerPhone(text: string): string {
  for (const re of [/(?:\+?84|0)[\d.\-\s]{7,14}\d/g, /\d[\d.\-\s]{7,14}\d/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const p = normalizePhone(m[0]);
      if (!isValidPhone(p)) continue;
      const before = noAccent(text.slice(Math.max(0, m.index - 28), m.index));
      if (STAFF_PHONE_CONTEXT.test(before)) continue; // số của nhân viên/kênh -> bỏ
      return p;
    }
  }
  return "";
}

function assignZone(address: string, ward: string, text: string): { ward: string; owner: string } {
  const hay = noAccent(`${address} ${ward} ${text}`);
  const zone = ZONE_OWNERS.find((z) => hay.includes(z.match));
  return { ward: ward || zone?.ward || "", owner: zone?.owner ?? "Chưa phân công" };
}

function extractFromText(text: string) {
  const nameLabels = ["họ và tên", "ho va ten", "họ tên", "ho ten", "tên khách hàng", "ten khach hang", "khách hàng", "khach hang", "tên", "ten", "khách", "khach"];
  const phoneLabels = ["số điện thoại", "so dien thoai", "điện thoại", "dien thoai", "sđt", "sdt", "phone", "tel", "đt", "dt"];
  const addrLabels = ["địa chỉ", "dia chi", "address", "đc", "dc"];
  const needLabels = ["nhu cầu", "nhu cau", "cần mua", "can mua", "yêu cầu", "yeu cau", "sản phẩm", "san pham"];

  // SĐT: ưu tiên dòng có nhãn; không có thì quét cả text (bỏ số nhân viên).
  const phoneLabeled = pickField(text, phoneLabels);
  const phone = findCustomerPhone(phoneLabeled) || findCustomerPhone(text);

  // Tên: nhãn -> mẫu "anh/chị + Tên" (bỏ từ xưng hô, tránh stopword) -> dòng đầu.
  let fullName = pickField(text, nameLabels);
  if (!fullName) {
    const STOP = new Set(["da", "de", "oi", "a", "ay", "nhe", "o", "cac", "va", "dang", "se", "can", "muon", "co", "la", "ban", "cua", "cho", "xin", "cam", "on", "roi", "nhé", "minh", "giup"]);
    const re = /(?<![\p{L}])(?:chị|chi|anh|cô|co|chú|chu|em|bác|bac|ông|ong|bà|ba)\s+(\p{L}+)/giu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (!STOP.has(noAccent(m[1]))) { fullName = m[1].trim(); break; }
    }
  }
  if (!fullName) {
    fullName = text.split("\n").map((l) => l.trim()).find((l) => l && !findCustomerPhone(l) && /\p{L}/u.test(l)) ?? "";
  }
  fullName = stripTitle(fullName).replace(/[\d.\-\s]{6,}.*$/, "").trim().slice(0, 60);

  // Địa chỉ: nhãn -> mẫu "khu/ở/tại + <Chuỗi viết hoa>".
  let address = pickField(text, addrLabels);
  if (!address) {
    const khu = text.match(/(?<![\p{L}])(?:khu\s*vực|khu|ở|tại)\s+(\p{Lu}\p{L}*(?:\s+\p{Lu}\p{L}*){0,4})/u);
    if (khu) address = khu[1].trim();
  }

  // Nhu cầu: nhãn -> các dòng gạch đầu dòng (–, -, •, *).
  let need = pickField(text, needLabels);
  if (!need) {
    const bullets = (text.match(/^\s*[–\-•*·]\s*(.+)$/gmu) ?? []).map((l) => l.replace(/^\s*[–\-•*·]\s*/u, "").trim()).filter(Boolean);
    if (bullets.length) need = bullets.join("; ");
  }

  const zone = assignZone(address, "", text);
  return { fullName, phone, address, need, ward: zone.ward, owner: zone.owner };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi khi xử lý.";
}

async function readInput(request: Request): Promise<{ text: string; explicit: Record<string, string> }> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    const text = String(body.text ?? body.message ?? body.content ?? "").trim();
    const need = Array.isArray(body.need) ? body.need.map(String).join("; ") : String(body.need ?? "").trim();
    return {
      text,
      explicit: {
        fullName: String(body.fullName ?? body.name ?? "").trim(),
        phone: String(body.phone ?? "").trim(),
        address: String(body.address ?? "").trim(),
        need,
        ward: String(body.ward ?? "").trim(),
      },
    };
  }
  return { text: (await request.text()).trim(), explicit: { fullName: "", phone: "", address: "", need: "", ward: "" } };
}

export async function POST(request: Request) {
  try {
    const db = getDb();

    // 1) Bảo mật.
    const providedSecret = request.headers.get("x-webhook-secret") ?? "";
    const settings = await getOrCreateSettings(db);
    if (!providedSecret || providedSecret !== settings.webhookSecret) {
      return Response.json({ code: "UNAUTHORIZED", message: "Khoá bí mật không đúng hoặc thiếu header x-webhook-secret." }, { status: 401 });
    }

    // 2) Chống spam.
    const recent = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.enteredBy, SOURCE_TAG), sql`${customers.createdAt} >= datetime('now','-60 seconds')`));
    if (recent.length >= MAX_INTAKE_PER_MINUTE) {
      return Response.json({ code: "RATE_LIMITED", message: "Quá nhiều yêu cầu trong thời gian ngắn, thử lại sau ít phút." }, { status: 429 });
    }

    // 3) Đọc + trích xuất (field truyền vào được ưu tiên hơn phần đọc từ text).
    const { text, explicit } = await readInput(request);
    const parsed = text && text.length >= 3 ? extractFromText(text) : { fullName: "", phone: "", address: "", need: "", ward: "", owner: "Chưa phân công" };

    const address = explicit.address || parsed.address;
    const zone = assignZone(address, explicit.ward || parsed.ward, text);
    const info = {
      fullName: (explicit.fullName ? stripTitle(explicit.fullName) : parsed.fullName).slice(0, 60),
      phone: normalizePhone(explicit.phone) || parsed.phone,
      address,
      need: explicit.need || parsed.need,
      ward: zone.ward,
      owner: zone.owner,
    };

    if (!text && !explicit.fullName && !explicit.phone) {
      return Response.json({ code: "INVALID", message: "Thiếu nội dung (text hoặc field khách hàng)." }, { status: 400 });
    }
    if (info.fullName.length < 2) {
      return Response.json({ code: "INVALID", message: "Không đọc được tên khách.", extracted: info }, { status: 400 });
    }
    if (!isValidPhone(info.phone)) {
      return Response.json({ code: "INVALID", message: "Không đọc được số điện thoại KHÁCH hợp lệ (10 số bắt đầu bằng 0). Lưu ý: số của tư vấn viên/hotline sẽ bị bỏ qua.", extracted: info }, { status: 400 });
    }

    // 4) Trùng SĐT -> KHÔNG cập nhật.
    const existingRows = await db.select().from(customers).limit(3000);
    const existing = existingRows.find((row) => normalizePhone(row.phone) === info.phone);
    if (existing) {
      return Response.json({ code: "EXISTS", message: `Khách hàng đã tồn tại (SĐT ${info.phone} — ${existing.fullName}). Bỏ qua, không cập nhật.`, customerId: existing.id });
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
