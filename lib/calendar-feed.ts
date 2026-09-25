// Sinh link lịch .ics riêng cho từng người — đăng ký một lần trong app Lịch
// trên iPhone (Cài đặt > Lịch > Tài khoản > Thêm lịch đăng ký), sau đó mọi việc
// cần làm/lịch hẹn của người đó tự đồng bộ vào, kèm nhắc giờ (VALARM) ngay trên
// điện thoại — không cần Zalo OA, không cần tài khoản Meta, không cần n8n.

export type CalendarTask = {
  id: number;
  title: string;
  type: string;
  dueDate: string;
  dueTime: string;
  assignedTo: string;
  notes: string;
  customerName: string | null;
  customerPhone: string | null;
  projectCode: string | null;
};

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deriveCalendarToken(person: string, secret: string) {
  const hex = await sha256Hex(`${person.toLocaleLowerCase("vi")}:${secret}`);
  return hex.slice(0, 24);
}

function toUtcStamp(dueDate: string, dueTime: string) {
  const time = /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : "09:00";
  const date = new Date(`${dueDate}T${time}:00+07:00`);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Gấp dòng theo RFC 5545 (giới hạn ~75 ký tự/dòng, dòng tiếp theo thụt vào 1 khoảng trắng).
function foldLine(line: string) {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

function taskLabel(task: CalendarTask) {
  if (task.customerName) return task.customerName;
  if (task.projectCode) return `Công trình ${task.projectCode}`;
  return "";
}

export function buildIcsFeed(personLabel: string, tasks: CalendarTask[]) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tien Nga Home CRM//Lich nhac hen//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`Việc cần làm - ${personLabel}`)}`,
    "X-WR-TIMEZONE:Asia/Ho_Chi_Minh",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
    "X-PUBLISHED-TTL:PT30M",
  ];

  for (const task of tasks) {
    const start = toUtcStamp(task.dueDate, task.dueTime);
    const endDate = new Date(`${task.dueDate}T${/^\d{2}:\d{2}$/.test(task.dueTime) ? task.dueTime : "09:00"}:00+07:00`);
    endDate.setMinutes(endDate.getMinutes() + 30);
    const end = endDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const label = taskLabel(task);
    const summary = label ? `${label} — ${task.title}` : task.title;
    const descriptionParts = [
      task.customerPhone ? `SĐT: ${task.customerPhone}` : "",
      task.assignedTo ? `Phụ trách: ${task.assignedTo}` : "",
      task.notes ? `Ghi chú: ${task.notes}` : "",
    ].filter(Boolean);
    const alarmTrigger = task.type === "appointment" ? "-PT2H" : "-PT30M";

    lines.push(
      "BEGIN:VEVENT",
      `UID:task-${task.id}@tienngahome-crm`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsEscape(summary)}`,
      ...(descriptionParts.length ? [`DESCRIPTION:${icsEscape(descriptionParts.join("\n"))}`] : []),
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Nhắc việc từ CRM Tiến Nga Home",
      `TRIGGER:${alarmTrigger}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
