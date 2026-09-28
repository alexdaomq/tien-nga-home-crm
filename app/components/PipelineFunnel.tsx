"use client";

import { PIPELINE_STAGES } from "../../db/enums";
import { FUNNEL_STAGE_COLOR, FUNNEL_STAGE_LABEL } from "../../lib/labels";

type Props = {
  counts: Map<string, number>;
  onGoStage: (stage: string) => void;
};

const TIERS = [
  { key: "uncontacted", label: "Chưa liên hệ", color: "#8b8b8b" },
  ...PIPELINE_STAGES.map((s) => ({ key: s as string, label: FUNNEL_STAGE_LABEL[s], color: FUNNEL_STAGE_COLOR[s] })),
];
const TOP_WIDTH = 100; // % bề rộng miệng phễu
const TIP_WIDTH = 26; // % bề rộng đáy phễu
const MAX_DOTS = 16;

// Vị trí chấm cố định theo chỉ số để phễu không "nhảy" mỗi lần render.
function seeded(i: number, salt: number): number {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export default function PipelineFunnel({ counts, onGoStage }: Props) {
  const n = TIERS.length;
  const lost = counts.get("lost") ?? 0;
  const total = TIERS.reduce((sum, t) => sum + (counts.get(t.key) ?? 0), 0) + lost;
  const widthAt = (i: number) => TOP_WIDTH - (TOP_WIDTH - TIP_WIDTH) * (i / n);
  const pctOf = (v: number) => (total ? Math.round((v * 100) / total) : 0);

  return (
    <div className="fnl">
      {TIERS.map((t, i) => {
        const count = counts.get(t.key) ?? 0;
        const top = widthAt(i);
        const bot = widthAt(i + 1);
        const l1 = (100 - top) / 2, r1 = (100 + top) / 2;
        const l2 = (100 - bot) / 2, r2 = (100 + bot) / 2;
        const shown = Math.min(count, MAX_DOTS);
        return (
          <button
            key={t.key}
            type="button"
            className={`fnl-row${count === 0 ? " empty" : ""}`}
            style={{ ["--c" as string]: t.color }}
            onClick={() => onGoStage(t.key)}
            title={`Xem ${count} khách ở "${t.label}"`}
          >
            <span className="fnl-shape">
              <span className="fnl-band" style={{ clipPath: `polygon(${l1}% 0, ${r1}% 0, ${r2}% 100%, ${l2}% 100%)` }}>
                {Array.from({ length: shown }, (_, j) => (
                  <i key={j} style={{ left: `${l2 + 4 + seeded(j, i) * (bot - 8)}%`, top: `${24 + seeded(j, i + 7) * 52}%` }} />
                ))}
                {count > shown ? <em style={{ left: `${r2 - 3}%` }}>+{count - shown}</em> : null}
              </span>
              <span className="fnl-lead" style={{ left: `${(r1 + r2) / 2}%` }} />
            </span>
            <span className="fnl-label">
              <b>{t.label}</b>
              <small>{count} khách{count ? ` · ${pctOf(count)}%` : ""}</small>
            </span>
          </button>
        );
      })}

      <button type="button" className="fnl-row fnl-lost" onClick={() => onGoStage("lost")} title={`Xem ${lost} khách không chốt`}>
        <span className="fnl-shape"><span className="fnl-drain">↓ {lost}</span></span>
        <span className="fnl-label">
          <b>Không chốt</b>
          <small>{lost} khách{lost ? ` · ${pctOf(lost)}%` : ""} · rời phễu</small>
        </span>
      </button>
    </div>
  );
}
