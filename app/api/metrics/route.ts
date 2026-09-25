import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { appSettings, customers, dailyMetrics, projectItems, projects } from "../../../db/schema";
import { median, minutesBetween, percent } from "../../../lib/format";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Có lỗi xảy ra với chỉ số vận hành.";
}

async function getMarginRate(db: ReturnType<typeof getDb>) {
  const [row] = await db.select().from(appSettings).limit(1);
  return row?.marginRate ?? 25;
}

function computeFunnelKpis(rows: (typeof customers.$inferSelect)[], adSpend: number, marginRate: number) {
  const rawLeads = rows.length;
  const inZone = rows.filter((row) => row.inZone === 1).length;
  const contacted = rows.filter((row) => row.contactResult === "da_lien_he").length;
  const withAppointment = rows.filter((row) => row.appointmentDate.trim() !== "").length;
  const arrived = rows.filter((row) => row.arrived === 1).length;
  const won = rows.filter((row) => row.funnelStage === "won").length;
  const referrals = rows.filter((row) => row.source === "Giới thiệu").length;

  const firstCallMinutes = rows
    .map((row) => (row.firstCallAt.trim() ? minutesBetween(row.receivedAt, row.firstCallAt) : null))
    .filter((value): value is number => value !== null);

  const wonRows = rows.filter((row) => row.funnelStage === "won");
  const aov = wonRows.length ? wonRows.reduce((sum, row) => sum + row.value, 0) / wonRows.length : 0;
  const avgItemCount = wonRows.length ? wonRows.reduce((sum, row) => sum + row.itemCount, 0) / wonRows.length : 0;

  const lossRows = rows.filter((row) => row.funnelStage === "lost");
  const lossReasonBreakdown: Record<string, number> = {};
  for (const row of lossRows) {
    const key = row.lossReason || "khac";
    lossReasonBreakdown[key] = (lossReasonBreakdown[key] ?? 0) + 1;
  }

  const pctInZone = percent(inZone, rawLeads);
  const pctContacted = percent(contacted, rawLeads);
  const pctArrived = percent(arrived, withAppointment || rawLeads);
  const pctWon = percent(won, arrived || rawLeads);
  const cplCeiling = aov * (marginRate / 100) * ((pctWon / 100) * (pctArrived / 100) * (pctContacted / 100));

  return {
    rawLeads,
    inZone,
    adSpend,
    cpl: rawLeads ? Math.round(adSpend / rawLeads) : 0,
    cplValid: inZone ? Math.round(adSpend / inZone) : 0,
    cplCeiling: Math.round(cplCeiling),
    pctInZone,
    medianFirstCallMinutes: median(firstCallMinutes),
    pctContacted,
    pctArrived,
    pctWon,
    aov: Math.round(aov),
    avgItemCount: Math.round(avgItemCount * 10) / 10,
    referralRate: percent(referrals, rawLeads),
    lossReasonBreakdown,
    won,
    arrived,
    contacted,
    withAppointment,
  };
}

async function computeCrossSellKpis(db: ReturnType<typeof getDb>) {
  const allProjects = await db.select({ id: projects.id }).from(projects).limit(2000);
  const allItems = await db.select().from(projectItems).limit(20000);
  const boughtAtTienNga = allItems.filter((item) => item.purchaseStatus === "tien_nga" && item.purchasedAt.trim());

  const byProject = new Map<number, typeof boughtAtTienNga>();
  for (const item of boughtAtTienNga) {
    const list = byProject.get(item.projectId) ?? [];
    list.push(item);
    byProject.set(item.projectId, list);
  }

  let projectsWithSecondPurchase = 0;
  let projectsWithinNinetyDays = 0;
  const gaps: number[] = [];
  const lifetimeValues: number[] = [];
  let itemCountTotal = 0;
  let projectsWithItems = 0;

  for (const [, items] of byProject) {
    itemCountTotal += items.length;
    projectsWithItems += 1;
    lifetimeValues.push(items.reduce((sum, item) => sum + item.orderValue, 0));
    if (items.length >= 2) {
      const sortedDates = items.map((item) => new Date(item.purchasedAt).getTime()).sort((a, b) => a - b);
      const gapDays = Math.round((sortedDates[1] - sortedDates[0]) / 86400000);
      projectsWithSecondPurchase += 1;
      gaps.push(gapDays);
      if (gapDays <= 90) projectsWithinNinetyDays += 1;
    }
  }

  return {
    totalProjects: allProjects.length,
    projectsWithPurchase: projectsWithItems,
    avgItemsPerProject: projectsWithItems ? Math.round((itemCountTotal / projectsWithItems) * 10) / 10 : 0,
    pctSecondPurchaseWithin90Days: percent(projectsWithinNinetyDays, projectsWithItems),
    avgGapDays: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0,
    avgLifetimeValue: lifetimeValues.length ? Math.round(lifetimeValues.reduce((a, b) => a + b, 0) / lifetimeValues.length) : 0,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const db = getDb();

    const [allCustomers, allDailyMetrics, marginRate] = await Promise.all([
      db.select().from(customers).limit(5000),
      db.select().from(dailyMetrics).orderBy(desc(dailyMetrics.date)).limit(120),
      getMarginRate(db),
    ]);

    const monthCustomers = allCustomers.filter((row) => row.receivedAt.startsWith(month));
    const monthAdSpend = allDailyMetrics.filter((row) => row.date.startsWith(month)).reduce((sum, row) => sum + row.adSpend, 0);
    const funnel = computeFunnelKpis(monthCustomers, monthAdSpend, marginRate);
    const crossSell = await computeCrossSellKpis(db);

    return Response.json({ month, marginRate, funnel, crossSell, dailyMetrics: allDailyMetrics });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const date = String(payload.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Ngày chưa hợp lệ." }, { status: 400 });
    const adSpend = Math.max(0, Number(payload.adSpend ?? 0) || 0);
    const notes = String(payload.notes ?? "").trim();
    const enteredBy = String(payload.enteredBy ?? "").trim();

    const db = getDb();
    const [existing] = await db.select({ id: dailyMetrics.id }).from(dailyMetrics).where(eq(dailyMetrics.date, date)).limit(1);
    if (existing) {
      const [row] = await db.update(dailyMetrics).set({ adSpend, notes, enteredBy, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(dailyMetrics.id, existing.id)).returning();
      return Response.json({ dailyMetric: row });
    }
    const [row] = await db.insert(dailyMetrics).values({ date, adSpend, notes, enteredBy }).returning();
    return Response.json({ dailyMetric: row }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
