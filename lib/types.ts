export type Customer = {
  id: number;
  leadCode: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  ward: string;
  inZone: number;
  source: string;
  campaign: string;
  referrer: string;
  receivedAt: string;
  constructionStageAtLead: string;
  funnelStage: string;
  priority: string;
  firstCallAt: string;
  contactResult: string;
  appointmentDate: string;
  arrived: number;
  closedDate: string;
  value: number;
  itemCount: number;
  lossReason: string;
  need: string;
  projectType: string;
  stylePreference: string;
  dimensions: string;
  purchaseTimeline: string;
  preferredChannel: string;
  preferredContactTime: string;
  expectedCloseDate: string;
  nextContactDate: string;
  notes: string;
  owner: string;
  enteredBy: string;
  lastContact: string;
  nextAction: string;
  zalo: string;
  projectStage: string;
  numberOfFloors: number;
  numberOfBathrooms: number;
  estimatedTileDate: string;
  estimatedBathroomInstallDate: string;
  budgetMin: number;
  budgetMax: number;
  interestedProducts: string;
  mainConcern: string;
  objection: string;
  decisionMaker: string;
  competitor: string;
  nextActionType: string;
  nextActionTime: string;
  lostNote: string;
  lostCompetitor: string;
  lostAt: string;
  lostBy: string;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: number;
  projectCode: string;
  customerId: number;
  customerName: string | null;
  customerPhone: string | null;
  customerOwner: string | null;
  address: string;
  ward: string;
  area: string;
  numberOfWc: number;
  hasKitchen: number;
  contractorName: string;
  constructionStage: string;
  tileDeliveredAt: string;
  expectedTilingAt: string;
  status: string;
  notes: string;
  itemCount: number;
  boughtAtTienNgaCount: number;
  boughtElsewhereCount: number;
  lifetimeValue: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectItem = {
  id: number;
  projectId: number;
  room: string;
  category: string;
  purchaseStatus: string;
  orderValue: number;
  purchasedAt: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: number;
  customerId: number | null;
  projectId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  projectCode: string | null;
  title: string;
  type: string;
  dueDate: string;
  dueTime: string;
  status: string;
  assignedTo: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Activity = {
  id: number;
  customerId: number;
  content: string;
  enteredBy: string;
  createdAt: string;
};

export type DailyMetric = {
  id: number;
  date: string;
  adSpend: number;
  notes: string;
  enteredBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FunnelKpis = {
  rawLeads: number;
  inZone: number;
  adSpend: number;
  cpl: number;
  cplValid: number;
  cplCeiling: number;
  pctInZone: number;
  medianFirstCallMinutes: number;
  pctContacted: number;
  pctArrived: number;
  pctWon: number;
  aov: number;
  avgItemCount: number;
  referralRate: number;
  lossReasonBreakdown: Record<string, number>;
  won: number;
  arrived: number;
  contacted: number;
  withAppointment: number;
};

export type CrossSellKpis = {
  totalProjects: number;
  projectsWithPurchase: number;
  avgItemsPerProject: number;
  pctSecondPurchaseWithin90Days: number;
  avgGapDays: number;
  avgLifetimeValue: number;
};

export type MetricsResponse = {
  month: string;
  marginRate: number;
  funnel: FunnelKpis;
  crossSell: CrossSellKpis;
  dailyMetrics: DailyMetric[];
};

import type { Role } from "../db/enums";

// Đội ngũ + vai trò. Không có màn hình đăng nhập (theo nguyên tắc bản v1) — vai trò
// gắn sẵn theo tên người đang chọn ở góc phải. Manager thấy tất cả; sale thấy dữ liệu
// của mình khi bật "giới hạn theo sale" (Cài đặt).
export type TeamMember = { name: string; role: Role };

export const TEAM: TeamMember[] = [
  { name: "Tuấn", role: "manager" },
  { name: "Liên", role: "sales" },
  { name: "Cần", role: "sales" },
  { name: "Hương", role: "sales" },
];

export const TEAM_MEMBERS: string[] = TEAM.map((member) => member.name);

export function roleOf(name: string): Role {
  return TEAM.find((member) => member.name === name)?.role ?? "sales";
}

export const VIEWS = [
  "dashboard",
  "today",
  "pipeline",
  "customers",
  "appointments",
  "projects",
  "completed",
  "metrics",
  "suppliers",
  "settings",
] as const;
export type ViewKey = (typeof VIEWS)[number];
