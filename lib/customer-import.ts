// Nhập khách hàng hàng loạt từ file Excel/CSV — phần xử lý dùng chung cho trình duyệt
// (xem trước) và server (/api/customers/import). Không phụ thuộc thư viện ngoài.
import { SOURCES, isActiveStage } from "../db/enums";
import { TEAM_MEMBERS } from "./types";

export type ImportRow = {
  fullName: string;
  phone: string; // đã chuẩn hoá 10 số bắt đầu 0 (rỗng nếu không đọc được)
  rawPhone: string;
  address: string;
  need: string;
  owner: string;
  source: string;
  priority: string; // hot | warm | cold
  stage: string; // khoá giai đoạn (lead, consulting, ...)
  note: string;
};

export type ImportField = "fullName" | "phone" | "address" | "need" | "owner" | "source" | "priority" | "stage" | "note";

// Nhãn cột trong file mẫu (thứ tự cột).
export const TEMPLATE_HEADERS: { field: ImportField; label: string; example: string }[] = [
  { field: "fullName", label: "Tên khách hàng", example: "Anh Biên" },
  { field: "phone", label: "Số điện thoại", example: "0912 345 678" },
  { field: "address", label: "Địa chỉ", example: "Kim Chung, Đông Anh" },
  { field: "need", label: "Nhu cầu", example: "Gạch 60x60 + 2 phòng tắm" },
  { field: "owner", label: "Sale phụ trách", example: "Liên" },
  { field: "source", label: "Nguồn", example: "Facebook" },
  { field: "priority", label: "Mức độ quan tâm", example: "Nóng" },
  { field: "stage", label: "Giai đoạn", example: "Khách hàng mới" },
  { field: "note", label: "Ghi chú", example: "Khách hẹn cuối tuần qua showroom" },
];

// Từ khoá nhận diện tiêu đề cột (so khớp không dấu). Thứ tự quan trọng: "tên" để cuối
// vì nhiều tiêu đề khác cũng chứa chữ "tên".
const HEADER_ALIASES: { field: ImportField; keys: string[] }[] = [
  { field: "phone", keys: ["so dien thoai", "dien thoai", "sdt", "so dt", "phone", "mobile", "zalo"] },
  { field: "owner", keys: ["sale", "nhan vien", "phu trach", "nguoi ban"] },
  { field: "address", keys: ["dia chi", "khu vuc", "address", "xa/phuong", "thon"] },
  { field: "need", keys: ["nhu cau", "san pham", "can mua", "hang quan tam"] },
  { field: "source", keys: ["nguon", "kenh", "source"] },
  { field: "priority", keys: ["muc do", "quan tam", "nhiet do"] },
  { field: "stage", keys: ["giai doan", "buoc", "trang thai"] },
  { field: "note", keys: ["ghi chu", "note", "mo ta"] },
  { field: "fullName", keys: ["ho va ten", "ho ten", "ten khach", "khach hang", "ten", "name"] },
];

export function noAccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

// Quy SĐT về 10 số bắt đầu bằng 0 (bỏ +84/84/0084, khoảng trắng, chấm, gạch; bù số 0 bị Excel làm mất).
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0084")) d = "0" + d.slice(4);
  else if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  else if (d.length === 9 && !d.startsWith("0")) d = "0" + d;
  return d;
}

export function isValidPhone(p: string): boolean {
  return /^0\d{9}$/.test(p);
}

export function canonicalOwner(raw: string, fallback: string): string {
  const v = raw.trim();
  if (!v) return fallback;
  return TEAM_MEMBERS.find((m) => noAccent(m) === noAccent(v)) ?? v;
}

function parseSource(raw: string): string {
  const v = raw.trim();
  if (!v) return "Khác";
  return SOURCES.find((s) => noAccent(s) === noAccent(v)) ?? v;
}

function parsePriority(raw: string): string {
  const v = noAccent(raw);
  if (["nong", "hot"].includes(v)) return "hot";
  if (["lanh", "cold", "nuoi duong"].includes(v)) return "cold";
  return "warm";
}

// Đọc giai đoạn theo chữ (không dấu). Trống / không nhận ra -> Khách hàng mới.
export function parseStage(raw: string): string {
  const v = noAccent(raw);
  if (!v) return "lead";
  if (v.includes("khong chot") || v.includes("mat khach")) return "lost";
  if (v.includes("hoan thanh") || v.includes("hau mai")) return "aftercare";
  if (v.includes("thiet bi") || v.includes("tbvs") || v.includes("bep") || v.includes("phong tam")) return "delivering_fixtures";
  if (v.includes("gach") || v.includes("op lat")) return "delivering";
  if (v.includes("coc") || v.includes("chot")) return "won";
  if (v.includes("showroom")) return "arrived";
  if (v.includes("tu van") || v.includes("dien thoai")) return "consulting";
  return "lead";
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

// Tìm dòng tiêu đề (trong 5 dòng đầu) có ít nhất cột Tên + SĐT.
function findHeader(rows: unknown[][]): { rowIndex: number; columns: Partial<Record<ImportField, number>> } | null {
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const columns: Partial<Record<ImportField, number>> = {};
    (rows[r] ?? []).forEach((cell, c) => {
      const h = noAccent(cellText(cell));
      if (!h) return;
      const hit = HEADER_ALIASES.find((a) => columns[a.field] === undefined && a.keys.some((k) => h.includes(k)));
      if (hit) columns[hit.field] = c;
    });
    if (columns.fullName !== undefined && columns.phone !== undefined) return { rowIndex: r, columns };
  }
  return null;
}

// Biến dữ liệu thô của sheet (mảng các dòng) thành danh sách khách cần nhập.
export function sheetToImportRows(rows: unknown[][], defaultOwner: string): { rows: ImportRow[]; error?: string } {
  const header = findHeader(rows);
  if (!header) {
    return { rows: [], error: "Không tìm thấy cột \"Tên khách hàng\" và \"Số điện thoại\" ở dòng tiêu đề. Hãy dùng file mẫu." };
  }
  const get = (row: unknown[], field: ImportField) => {
    const idx = header.columns[field];
    return idx === undefined ? "" : cellText(row[idx]);
  };
  const out: ImportRow[] = [];
  for (const row of rows.slice(header.rowIndex + 1)) {
    if (!row || row.every((cell) => cellText(cell) === "")) continue; // bỏ dòng trống
    const rawPhone = get(row, "phone");
    out.push({
      fullName: get(row, "fullName").slice(0, 60),
      phone: normalizePhone(rawPhone),
      rawPhone,
      address: get(row, "address"),
      need: get(row, "need"),
      owner: canonicalOwner(get(row, "owner"), defaultOwner),
      source: parseSource(get(row, "source")),
      priority: parsePriority(get(row, "priority")),
      stage: parseStage(get(row, "stage")),
      note: get(row, "note"),
    });
  }
  return { rows: out };
}

export type RowCheck = { status: "ok" | "error" | "duplicate"; message: string };

// Kiểm tra từng dòng: thiếu tên, SĐT sai, trùng trong file, đã có trong CRM.
export function checkImportRows(rows: ImportRow[], existingPhones: Set<string>): RowCheck[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (row.fullName.trim().length < 2) return { status: "error", message: "Thiếu tên khách" };
    if (!isValidPhone(row.phone)) return { status: "error", message: row.rawPhone ? `SĐT không hợp lệ: ${row.rawPhone}` : "Thiếu số điện thoại" };
    if (existingPhones.has(row.phone)) return { status: "duplicate", message: "Đã có trong CRM — bỏ qua" };
    if (seen.has(row.phone)) return { status: "duplicate", message: "Trùng SĐT với dòng phía trên — bỏ qua" };
    seen.add(row.phone);
    return { status: "ok", message: "Sẵn sàng nhập" };
  });
}

// Việc tiếp theo mặc định cho khách vừa nhập (để hiện ngay ở "Việc hôm nay").
export function defaultNextAction(stage: string): { nextAction: string; nextActionType: string } {
  if (stage === "lead") return { nextAction: "Gọi khách lần đầu", nextActionType: "goi_khach" };
  if (isActiveStage(stage)) return { nextAction: "Liên hệ lại khách", nextActionType: "goi_khach" };
  return { nextAction: "", nextActionType: "" };
}

// Đọc file CSV (dấu phẩy hoặc chấm phẩy, có ngoặc kép) thành mảng dòng.
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Nội dung file mẫu CSV (có BOM để Excel hiện đúng tiếng Việt).
export function templateCsv(): string {
  const esc = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = TEMPLATE_HEADERS.map((h) => esc(h.label)).join(",");
  const example = TEMPLATE_HEADERS.map((h) => esc(h.example)).join(",");
  return `﻿${header}\n${example}\n`;
}
