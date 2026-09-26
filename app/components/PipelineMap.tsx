"use client";

import { useMemo, useState } from "react";
import type { Customer } from "../../lib/types";
import { PIPELINE_STAGES, STAGE_ALIAS } from "../../db/enums";
import { FUNNEL_STAGE_LABEL, FUNNEL_STAGE_COLOR } from "../../lib/labels";
import { money, todayISO } from "../../lib/format";

type Props = {
  customers: Customer[];
  onOpen: (customer: Customer) => void;
};

const CENTER_Y = 250; // đường timeline nằm thấp — chấm rải PHÍA TRÊN, nhãn nằm PHÍA DƯỚI
const MAX_PER_STAGE = 16;

function stageColumnOf(stage: string): string {
  if ((PIPELINE_STAGES as readonly string[]).includes(stage)) return stage;
  return STAGE_ALIAS[stage] ?? "";
}

// Số giả ngẫu nhiên ổn định theo id (để chấm không nhảy vị trí mỗi lần render).
function seeded(id: number, salt: number): number {
  const s = ((id + 1) * 9301 + salt * 49297) % 233280;
  return s / 233280;
}

function isWarn(c: Customer, today: string, nowMs: number): boolean {
  const active = !["won", "aftercare", "delivering", "lost", "paused"].includes(c.funnelStage);
  const overdue = /^\d{4}-\d{2}-\d{2}$/.test(c.nextContactDate) && c.nextContactDate < today;
  const noNext = active && !(c.nextAction.trim() && /^\d{4}-\d{2}-\d{2}$/.test(c.nextContactDate));
  let hotAtRisk = false;
  if (c.priority === "hot" && active && c.updatedAt) {
    const t = new Date(c.updatedAt.replace(" ", "T") + "Z").getTime();
    if (!Number.isNaN(t)) hotAtRisk = (nowMs - t) / 3_600_000 > 48;
  }
  return overdue || noNext || hotAtRisk;
}

type Dot = { c: Customer; xPct: number; y: number; dx: number; size: number; color: string; warn: boolean };

export default function PipelineMap({ customers, onOpen }: Props) {
  const [onlyWarn, setOnlyWarn] = useState(false);
  const [hover, setHover] = useState<{ dot: Dot; x: number; y: number } | null>(null);
  const today = todayISO();
  const nowMs = Date.now();

  const { dots, stageInfo, total, warnCount } = useMemo(() => {
    const byStage = new Map<string, Customer[]>();
    for (const s of PIPELINE_STAGES) byStage.set(s, []);
    let warnCount = 0;
    for (const c of customers) {
      const col = stageColumnOf(c.funnelStage);
      if (!col) continue; // bỏ Mất khách / Tạm hoãn khỏi bản đồ
      byStage.get(col)?.push(c);
      if (isWarn(c, today, nowMs)) warnCount += 1;
    }
    const N = PIPELINE_STAGES.length;
    const dots: Dot[] = [];
    const stageInfo = PIPELINE_STAGES.map((stage, i) => {
      const list = (byStage.get(stage) ?? []).slice().sort((a, b) => b.value - a.value);
      const xPct = 3 + ((i + 0.5) / N) * 94;
      const shown = list.slice(0, MAX_PER_STAGE);
      // Rải chấm THÀNH 2 CỘT đi LÊN phía trên line — tách hẳn khỏi vùng nhãn ở dưới.
      shown.forEach((c, j) => {
        const warn = isWarn(c, today, nowMs);
        const col = j % 2;
        const rowUp = Math.floor(j / 2);
        const size = Math.round(9 + Math.min(15, c.value / 6_500_000));
        const y = CENTER_Y - 22 - rowUp * 22 - Math.round(seeded(c.id, 3) * 6);
        const dx = (col === 0 ? -13 : 13) + (seeded(c.id, 7) - 0.5) * 9;
        dots.push({ c, xPct, y, dx, size, color: FUNNEL_STAGE_COLOR[stage], warn });
      });
      const value = list.reduce((s, c) => s + c.value, 0);
      return { stage, xPct, count: list.length, value, extra: Math.max(0, list.length - MAX_PER_STAGE) };
    });
    return { dots, stageInfo, total: customers.length, warnCount };
  }, [customers, today, nowMs]);

  const visibleDots = onlyWarn ? dots.filter((d) => d.warn) : dots;

  return (
    <div className="map-card pmap-card">
      <div className="dashboard-card-title">
        <strong>Bản đồ khách hàng — dòng chảy pipeline</strong>
        <label className="pmap-toggle">
          <input type="checkbox" checked={onlyWarn} onChange={(e) => setOnlyWarn(e.target.checked)} />
          Chỉ hiện cần chú ý {warnCount > 0 ? `(${warnCount})` : ""}
        </label>
      </div>

      <div className="pmap-scroll">
      <div className="pmap-wrap" onMouseLeave={() => setHover(null)}>
        <div className="pmap-line" style={{ background: "linear-gradient(90deg,#3a7bd5,#f5a623,#9b59b6,#7d5bd0,#0f9b8e,#e4542d,#d86400,#08751d,#0f9b8e)" }} />

        {stageInfo.map((s) => (
          <div key={s.stage} className="pmap-node" style={{ left: `${s.xPct}%`, top: CENTER_Y + 14 }}>
            <div className="pmap-node-dot" style={{ background: FUNNEL_STAGE_COLOR[s.stage], boxShadow: `0 0 0 2px ${FUNNEL_STAGE_COLOR[s.stage]}` }} />
            <div className="pmap-node-label">{FUNNEL_STAGE_LABEL[s.stage]}</div>
            <div className="pmap-node-sub">{s.count} khách{s.extra ? ` +${s.extra}` : ""}</div>
          </div>
        ))}

        {visibleDots.map((d) => (
          <button
            key={d.c.id}
            className={`pmap-dot${d.warn ? " warn" : ""}`}
            style={{ left: `${d.xPct}%`, top: d.y, width: d.size, height: d.size, marginLeft: d.dx - d.size / 2, background: d.color }}
            onClick={() => onOpen(d.c)}
            onMouseEnter={(e) => {
              const wrap = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              const r = e.currentTarget.getBoundingClientRect();
              setHover({ dot: d, x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top });
            }}
            aria-label={d.c.fullName}
          />
        ))}

        {hover && (
          <div className="pmap-tip" style={{ left: hover.x, top: hover.y - 6 }}>
            <div className="pmap-tip-name">{hover.dot.c.fullName}</div>
            <div className="pmap-tip-sub">
              {FUNNEL_STAGE_LABEL[stageColumnOf(hover.dot.c.funnelStage)] ?? ""}
              {hover.dot.c.value ? ` · ${money(hover.dot.c.value)}` : ""}
              {hover.dot.warn ? " · " : ""}
              {hover.dot.warn ? <span className="pmap-tip-warn">cần chú ý</span> : null}
            </div>
          </div>
        )}
      </div>
      </div>

      <div className="pmap-foot">{total} khách trong pipeline · rê chuột xem tên, bấm để mở hồ sơ</div>
    </div>
  );
}
