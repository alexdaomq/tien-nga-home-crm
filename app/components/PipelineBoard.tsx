"use client";

import { useMemo, useState } from "react";
import type { Customer, Task } from "../../lib/types";
import { PIPELINE_STAGES, OFF_PIPELINE_STAGES, STAGE_ALIAS } from "../../db/enums";
import { FUNNEL_STAGE_LABEL, FUNNEL_STAGE_COLOR, PRIORITY_EMOJI, PRIORITY_LABEL, PRIORITY_COLOR } from "../../lib/labels";
import { money, formatDate } from "../../lib/format";

type Props = {
  customers: Customer[];
  tasksByCustomer: Map<number, Task[]>;
  today: string;
  onOpen: (customer: Customer) => void;
  onChangeStage: (customer: Customer, stage: string) => void;
  onRequestLost: (customer: Customer) => void;
};

const COLUMNS = [...PIPELINE_STAGES, ...OFF_PIPELINE_STAGES];

function stageColumnOf(stage: string): string {
  if (COLUMNS.includes(stage as (typeof COLUMNS)[number])) return stage;
  return STAGE_ALIAS[stage] ?? "lead";
}

export default function PipelineBoard({ customers, tasksByCustomer, today, onOpen, onChangeStage, onRequestLost }: Props) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Customer[]>();
    for (const column of COLUMNS) map.set(column, []);
    for (const customer of customers) {
      const column = stageColumnOf(customer.funnelStage);
      map.get(column)?.push(customer);
    }
    return map;
  }, [customers]);

  const totalValue = useMemo(
    () => customers.filter((c) => !["lost", "paused"].includes(stageColumnOf(c.funnelStage))).reduce((sum, c) => sum + c.value, 0),
    [customers],
  );

  function handleDrop(stage: string) {
    const customer = customers.find((c) => c.id === dragId);
    setDragId(null);
    setOverStage(null);
    if (!customer) return;
    if (stageColumnOf(customer.funnelStage) === stage) return;
    if (stage === "lost") { onRequestLost(customer); return; }
    onChangeStage(customer, stage);
  }

  return (
    <div className="simple-page">
      <section className="welcome-row">
        <div>
          <p>PIPELINE BÁN HÀNG</p>
          <h1>Kéo thả khách qua từng giai đoạn</h1>
          <span>{customers.length} cơ hội · {money(totalValue)} tổng giá trị đang chạy</span>
        </div>
      </section>

      <div className="kanban">
        {COLUMNS.map((stage) => {
          const list = grouped.get(stage) ?? [];
          const stageValue = list.reduce((sum, c) => sum + c.value, 0);
          const isOff = OFF_PIPELINE_STAGES.includes(stage as (typeof OFF_PIPELINE_STAGES)[number]);
          return (
            <div
              key={stage}
              className={`kanban-col${overStage === stage ? " over" : ""}${isOff ? " off" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setOverStage(stage); }}
              onDragLeave={() => setOverStage((prev) => (prev === stage ? null : prev))}
              onDrop={() => handleDrop(stage)}
            >
              <div className="kanban-col-head" style={{ ["--stage" as string]: FUNNEL_STAGE_COLOR[stage] }}>
                <strong>{FUNNEL_STAGE_LABEL[stage]}</strong>
                <span>{list.length}</span>
              </div>
              <div className="kanban-col-sub">{money(stageValue)}</div>

              <div className="kanban-col-body">
                {list.length === 0 ? (
                  <div className="kanban-empty">Trống</div>
                ) : (
                  list.map((customer) => {
                    const tasks = tasksByCustomer.get(customer.id) ?? [];
                    const openTasks = tasks.filter((t) => t.status === "open");
                    const overdue = openTasks.some((t) => t.dueDate < today) ||
                      (/^\d{4}-\d{2}-\d{2}$/.test(customer.nextContactDate) && customer.nextContactDate < today);
                    const active = !["won", "aftercare", "delivering", "lost", "paused"].includes(customer.funnelStage);
                    const noNextAction = active && !(customer.nextAction.trim() && /^\d{4}-\d{2}-\d{2}$/.test(customer.nextContactDate));
                    return (
                      <div
                        key={customer.id}
                        className={`pipe-card${overdue ? " overdue" : ""}${noNextAction ? " no-next" : ""}`}
                        draggable
                        onDragStart={() => setDragId(customer.id)}
                        onDragEnd={() => { setDragId(null); setOverStage(null); }}
                        onClick={() => onOpen(customer)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="pipe-card-top">
                          <strong>{customer.fullName}</strong>
                          <span className="temp-pill" style={{ ["--temp" as string]: PRIORITY_COLOR[customer.priority] }}>
                            {PRIORITY_EMOJI[customer.priority]} {PRIORITY_LABEL[customer.priority]}
                          </span>
                        </div>
                        <div className="pipe-card-meta">{customer.ward || "—"} · {customer.need || "Chưa rõ nhu cầu"}</div>
                        <div className="pipe-card-value">{money(customer.value)}</div>
                        {noNextAction ? (
                          <div className="pipe-warning">⚠ CHƯA CÓ VIỆC TIẾP THEO</div>
                        ) : (
                          <div className={`pipe-next${overdue ? " overdue" : ""}`}>
                            <span>Next: {customer.nextAction}</span>
                            <small>{formatDate(customer.nextContactDate)}{customer.nextActionTime ? ` · ${customer.nextActionTime}` : ""}{overdue ? " · QUÁ HẠN" : ""}</small>
                          </div>
                        )}
                        <div className="pipe-card-owner">{customer.owner}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
