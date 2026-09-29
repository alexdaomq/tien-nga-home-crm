"use client";

import { useMemo, useState } from "react";
import type { Customer } from "../../lib/types";
import { PIPELINE_STAGES, isActiveStage, normalizeStage } from "../../db/enums";
import { FUNNEL_STAGE_LABEL, FUNNEL_STAGE_COLOR } from "../../lib/labels";
import { formatDate, money, todayISO } from "../../lib/format";

type Props = {
  customers: Customer[];
  onOpen: (customer: Customer) => void;
};

const MAX_PER_STAGE = 24;
const ROW_GAP = 16; // khoảng cách giữa các hàng chấm xếp lên trên
const TIP_SPACE = 172; // khoảng trống trên cùng dành cho tooltip (đủ cả dòng cảnh báo + nút "Mở hồ sơ")
const TIP_HALF_WIDTH = 125; // nửa bề rộng tooltip — giữ tooltip không tràn mép trái/phải

// Thiết bị không rê chuột được (điện thoại): chạm lần 1 xem, bấm "Mở hồ sơ" để vào.
function canHover(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
}

// 8 mốc: 7 bước bán hàng + "Không chốt" ở cuối (giai đoạn cũ tự quy đổi qua normalizeStage).
const NODES: { key: string; label: string; color: string }[] = [...PIPELINE_STAGES, "lost"].map((s) => ({
  key: s,
  label: FUNNEL_STAGE_LABEL[s],
  color: FUNNEL_STAGE_COLOR[s],
}));
const LINE_GRADIENT = `linear-gradient(90deg,${NODES.map((n) => n.color).join(",")})`;

function bucketOf(c: Customer): string {
  return normalizeStage(c.funnelStage);
}

function seeded(id: number, salt: number): number {
  const s = ((id + 1) * 9301 + salt * 49297) % 233280;
  return s / 233280;
}

function isWarn(c: Customer, today: string, nowMs: number): boolean {
  if (c.funnelStage === "lost") return false;
  const active = isActiveStage(c.funnelStage);
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
  const [hover, setHover] = useState<{ dot: Dot; x: number; y: number; pinned: boolean } | null>(null);

  function tipFor(d: Dot, el: HTMLElement, pinned: boolean) {
    const wrap = (el.parentElement as HTMLElement).getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const rawX = r.left - wrap.left + r.width / 2;
    const x = Math.min(Math.max(rawX, TIP_HALF_WIDTH + 4), wrap.width - TIP_HALF_WIDTH - 4);
    setHover({ dot: d, x, y: r.top - wrap.top, pinned });
  }
  const today = todayISO();
  const nowMs = Date.now();

  const { dots, nodeInfo, total, warnCount, centerY, wrapH } = useMemo(() => {
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
    // Chiều cao tự co: chấm xếp 2 cột hướng lên, lấy cột cao nhất để đặt đường timeline
    // -> ít khách thì khung thấp, nhiều khách thì cao dần, không chừa khoảng trắng thừa.
    let maxRows = 1;
    for (const n of NODES) {
      const shown = Math.min((byKey.get(n.key) ?? []).length, MAX_PER_STAGE);
      maxRows = Math.max(maxRows, Math.ceil(shown / 2));
    }
    // Chừa TIP_SPACE phía trên chấm cao nhất để tooltip (tên, SĐT, sale, việc tới) không bị cắt.
    const centerY = TIP_SPACE + maxRows * ROW_GAP;
    const wrapH = centerY + 96; // đủ cho nhãn bước dài 3 dòng + số khách
    const dots: Dot[] = [];
    const nodeInfo = NODES.map((node, i) => {
      const list = (byKey.get(node.key) ?? []).slice().sort((a, b) => b.value - a.value);
      const xPct = 3 + ((i + 0.5) / N) * 94;
      list.slice(0, MAX_PER_STAGE).forEach((c, j) => {
        const warn = isWarn(c, today, nowMs);
        const col = j % 2;
        const rowUp = Math.floor(j / 2);
        const size = Math.round(6 + Math.min(8, c.value / 8_000_000));
        const y = centerY - 16 - rowUp * ROW_GAP - Math.round(seeded(c.id, 3) * 4);
        const dx = (col === 0 ? -10 : 10) + (seeded(c.id, 7) - 0.5) * 7;
        dots.push({ c, xPct, y, dx, size, color: node.color, warn, label: node.label });
      });
      const value = list.reduce((s, c) => s + c.value, 0);
      return { key: node.key, label: node.label, color: node.color, xPct, count: list.length, value, extra: Math.max(0, list.length - MAX_PER_STAGE) };
    });
    return { dots, nodeInfo, total, warnCount, centerY, wrapH };
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
        <div
          className="pmap-wrap"
          style={{ height: wrapH }}
          onMouseLeave={() => setHover((h) => (h?.pinned ? h : null))}
          onClick={(e) => { if (e.target === e.currentTarget) setHover(null); }}
        >
          <div className="pmap-line" style={{ background: LINE_GRADIENT, top: centerY }} />

          {nodeInfo.map((s) => (
            <div key={s.key} className="pmap-node" style={{ left: `${s.xPct}%`, top: centerY + 14 }}>
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
              onClick={(e) => {
                if (canHover()) { setHover(null); onOpen(d.c); return; }
                // Điện thoại: chạm lần 1 hiện thông tin; chạm lại đúng chấm đó thì mở hồ sơ.
                if (hover?.pinned && hover.dot.c.id === d.c.id) { setHover(null); onOpen(d.c); }
                else tipFor(d, e.currentTarget, true);
              }}
              onMouseEnter={(e) => { if (canHover()) tipFor(d, e.currentTarget, false); }}
              aria-label={d.c.fullName}
            />
          ))}

          {hover && (
            <div className={`pmap-tip${hover.pinned ? " pinned" : ""}`} style={{ left: hover.x, top: hover.y - 8 }}>
              <div className="pmap-tip-name">{hover.dot.c.fullName}</div>
              <div className="pmap-tip-sub">
                <span className="pmap-tip-stage" style={{ ["--c" as string]: hover.dot.color }}>{hover.dot.label}</span>
                {hover.dot.c.value ? <b> · {money(hover.dot.c.value)}</b> : null}
              </div>
              <div className="pmap-tip-sub">📞 {hover.dot.c.phone} · 👤 {hover.dot.c.owner}</div>
              {hover.dot.c.nextAction.trim() ? (
                <div className="pmap-tip-sub">▶ {hover.dot.c.nextAction}{hover.dot.c.nextContactDate ? ` · ${formatDate(hover.dot.c.nextContactDate)}` : ""}</div>
              ) : null}
              {hover.dot.warn ? <div className="pmap-tip-warn">⚠ Cần chú ý</div> : null}
              {hover.pinned ? (
                <button type="button" className="pmap-tip-open" onClick={() => { const c = hover.dot.c; setHover(null); onOpen(c); }}>Mở hồ sơ ›</button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="pmap-foot">{total} khách · rê chuột (điện thoại: chạm) vào chấm để xem thông tin khách</div>
    </div>
  );
}
