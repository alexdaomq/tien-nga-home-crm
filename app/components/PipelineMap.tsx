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
const MAX_PER_STAGE = 24;

// Các mốc trên timeline: "Chưa liên hệ" (data thô) đầu phễu, 9 giai đoạn pipeline,
// "Không chốt" (mất khách) cuối phễu.
const START_KEY = "uncontacted";
const LOST_KEY = "lost";
const NODES: { key: string; label: string; color: string }[] = [
  { key: START_KEY, label: "Chưa liên hệ", color: "#8b8b8b" },
  ...PIPELINE_STAGES.map((s) => ({ key: s, label: FUNNEL_STAGE_LABEL[s], color: FUNNEL_STAGE_COLOR[s] })),
  { key: LOST_KEY, label: "Không chốt", color: "#94a3a0" },
];
const LINE_GRADIENT = "linear-gradient(90deg,#8b8b8b,#3a7bd5,#f5a623,#9b59b6,#7d5bd0,#0f9b8e,#e4542d,#d86400,#08751d,#0f9b8e,#94a3a0)";

function stageColumnOf(stage: string): string {
  if ((PIPELINE_STAGES as readonly string[]).includes(stage)) return stage;
  return STAGE_ALIAS[stage] ?? "";
}

// Mốc mà khách thuộc về: chưa liên hệ > mất khách > giai đoạn pipeline (bỏ tạm hoãn).
function bucketOf(c: Customer): string {
  if (c.contactResult === "chua_lien_he" && c.funnelStage !== "lost") return START_KEY;
  if (c.funnelStage === "lost") return LOST_KEY;
  return stageColumnOf(c.funnelStage);
}

function seeded(id: number, salt: number): number {
  const s = ((id + 1) * 9301 + salt * 49297) % 233280;
  return s / 233280;
}

function isWarn(c: Customer, today: string, nowMs: number): boolean {
  if (c.funnelStage === "lost" || c.funnelStage === "paused") return false;
  const active = !["won", "aftercare", "delivering"].includes(c.funnelStage);
  const overdue = /^\d{4}-\d{2}-\d{2}$/.test(c.nextContactDate) && c.nextContactDate < today;
  const noNext = active && !(c.nextAction.trim() && /^\d{4}-\d{2}-\d{2}$/.test(c.nextContactDate));
  let hotAtRisk = false;
  if (c.priority === "hot" && active && c.updatedAt) {
    const t = new Date(c.updatedAt.replace(" ", "T") + "Z").getTime();
    if (!Number.isNaN(t)) hotAtRisk = (nowMs - t) / 3_600_000 > 48;
  }
  return overdue || noNext || hotAtRisk;
}

type Dot = { c: Customer; xPct: number; y: number; dx: number; size: number; color: string; warn: boolean; label: string };

export default function PipelineMap({ customers, onOpen }: Props) {
  const [onlyWarn, setOnlyWarn] = useState(false);
  const [hover, setHover] = useState<{ dot: Dot; x: number; y: number } | null>(null);
  const today = todayISO();
  const nowMs = Date.now();

  const { dots, nodeInfo, total, warnCount } = useMemo(() => {
    const byKey = new Map<string, Customer[]>();
    for (const n of NODES) byKey.set(n.key, []);
    let warnCount = 0;
    let total = 0;
    for (const c of customers) {
      const key = bucketOf(c);
      if (!key || !byKey.has(key)) continue; // tạm hoãn -> bỏ khỏi bản đồ
      byKey.get(key)!.push(c);
      total += 1;
      if (isWarn(c, today, nowMs)) warnCount += 1;
    }
    const N = NODES.length;
    const dots: Dot[] = [];
    const nodeInfo = NODES.map((node, i) => {
      const list = (byKey.get(node.key) ?? []).slice().sort((a, b) => b.value - a.value);
      const xPct = 3 + ((i + 0.5) / N) * 94;
      list.slice(0, MAX_PER_STAGE).forEach((c, j) => {
        const warn = isWarn(c, today, nowMs);
        const col = j % 2;
        const rowUp = Math.floor(j / 2);
        const size = Math.round(6 + Math.min(8, c.value / 8_000_000));
        const y = CENTER_Y - 16 - rowUp * 16 - Math.round(seeded(c.id, 3) * 4);
        const dx = (col === 0 ? -10 : 10) + (seeded(c.id, 7) - 0.5) * 7;
        dots.push({ c, xPct, y, dx, size, color: node.color, warn, label: node.label });
      });
      const value = list.reduce((s, c) => s + c.value, 0);
      return { key: node.key, label: node.label, color: node.color, xPct, count: list.length, value, extra: Math.max(0, list.length - MAX_PER_STAGE) };
    });
    return { dots, nodeInfo, total, warnCount };
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
          <div className="pmap-line" style={{ background: LINE_GRADIENT }} />

          {nodeInfo.map((s) => (
            <div key={s.key} className="pmap-node" style={{ left: `${s.xPct}%`, top: CENTER_Y + 14 }}>
              <div className="pmap-node-dot" style={{ background: s.color, boxShadow: `0 0 0 2px ${s.color}` }} />
              <div className="pmap-node-label">{s.label}</div>
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
                {hover.dot.label}
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
