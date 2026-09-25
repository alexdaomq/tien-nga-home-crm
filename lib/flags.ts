// Các cờ (flag) cảnh báo tính ở client từ dữ liệu khách + việc cần làm.
// Đây là "bộ não" thúc đẩy hành động của CRM — mọi cảnh báo trong brief đều bắt nguồn từ đây.
import type { Customer, Task } from "./types";

// Stage được coi là "đang active" — bắt buộc phải có Next Action.
export const ACTIVE_STAGES = new Set([
  "lead",
  "consulting",
  "appointment",
  "arrived",
  "site_survey",
  "quoted",
  "negotiating",
]);

export const CLOSED_STAGES = new Set(["won", "aftercare", "delivering", "lost", "paused"]);

function hoursSince(timestamp: string, nowMs: number): number | null {
  if (!timestamp) return null;
  const parsed = new Date(timestamp.replace(" ", "T") + (timestamp.includes("Z") ? "" : "Z")).getTime();
  if (Number.isNaN(parsed)) return null;
  return (nowMs - parsed) / 3_600_000;
}

export type CustomerFlags = {
  isActive: boolean;
  hasNextAction: boolean;
  needsFollowUp: boolean; // active nhưng không có next action
  isNewUnhandled: boolean; // lead mới chưa liên hệ
  isHotAtRisk: boolean; // HOT nhưng >48h không tương tác
  quoteNeedsFollowUp: boolean; // đã báo giá >24h chưa có việc follow
  showroomToday: boolean;
  siteVisitToday: boolean;
  overdueTaskCount: number;
  dueTodayTaskCount: number;
};

export function computeCustomerFlags(
  customer: Customer,
  tasks: Task[],
  todayIso: string,
  nowMs: number,
): CustomerFlags {
  const openTasks = tasks.filter((task) => task.status === "open");
  const overdueTaskCount = openTasks.filter((task) => task.dueDate < todayIso).length;
  const dueTodayTaskCount = openTasks.filter((task) => task.dueDate === todayIso).length;

  const isActive = ACTIVE_STAGES.has(customer.funnelStage);
  const hasNextAction = Boolean(
    customer.nextAction.trim() && /^\d{4}-\d{2}-\d{2}$/.test(customer.nextContactDate),
  ) || openTasks.length > 0;

  const needsFollowUp = isActive && !hasNextAction;

  const isNewUnhandled =
    customer.funnelStage === "lead" && customer.contactResult === "chua_lien_he";

  const lastTouchHours = hoursSince(customer.updatedAt, nowMs);
  const isHotAtRisk =
    customer.priority === "hot" &&
    isActive &&
    lastTouchHours !== null &&
    lastTouchHours > 48;

  const quotedHours = hoursSince(customer.updatedAt, nowMs);
  const quoteNeedsFollowUp =
    customer.funnelStage === "quoted" &&
    quotedHours !== null &&
    quotedHours > 24 &&
    openTasks.length === 0;

  const showroomToday =
    (customer.appointmentDate.slice(0, 10) === todayIso && !customer.arrived) ||
    openTasks.some((task) => task.dueDate === todayIso && task.type === "appointment");

  const siteVisitToday =
    customer.estimatedTileDate.slice(0, 10) === todayIso ||
    openTasks.some(
      (task) => task.dueDate === todayIso && /khảo sát|công trình/i.test(task.title),
    );

  return {
    isActive,
    hasNextAction,
    needsFollowUp,
    isNewUnhandled,
    isHotAtRisk,
    quoteNeedsFollowUp,
    showroomToday,
    siteVisitToday,
    overdueTaskCount,
    dueTodayTaskCount,
  };
}

// Gom việc cần làm theo khách để tính cờ nhanh trong UI.
export function groupTasksByCustomer(tasks: Task[]): Map<number, Task[]> {
  const map = new Map<number, Task[]>();
  for (const task of tasks) {
    if (task.customerId == null) continue;
    const list = map.get(task.customerId) ?? [];
    list.push(task);
    map.set(task.customerId, list);
  }
  return map;
}
