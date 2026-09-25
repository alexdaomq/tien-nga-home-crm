"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Activity, Customer, Project, Task } from "../../lib/types";
import { money, formatDate, todayISO } from "../../lib/format";
import { computeCustomerFlags } from "../../lib/flags";
import { PIPELINE_STAGES } from "../../db/enums";
import {
  FUNNEL_STAGE_LABEL,
  FUNNEL_STAGE_COLOR,
  PRIORITY_LABEL,
  PRIORITY_EMOJI,
  PRIORITY_COLOR,
  PROJECT_STAGE_LABEL,
  PROJECT_TYPE_LABEL,
  OBJECTION_LABEL,
  LOSS_REASON_LABEL,
} from "../../lib/labels";

type Props = {
  customer: Customer;
  activities: Activity[];
  tasks: Task[];
  projects: Project[];
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onAddNote: (text: string) => void;
  onCompleteNextAction: (customer: Customer) => void;
  onEditNextAction: (customer: Customer) => void;
  onCreateNextAction: (customer: Customer) => void;
  onChangeStage: (customer: Customer, stage: string) => void;
  onRequestLost: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
};

function parseProducts(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function CustomerDetail(props: Props) {
  const { customer, activities, tasks, projects, onClose, onEdit, onAddNote, onCompleteNextAction, onEditNextAction, onCreateNextAction, onChangeStage, onRequestLost, onDelete } = props;
  const [note, setNote] = useState("");

  const flags = useMemo(() => computeCustomerFlags(customer, tasks, todayISO(), Date.now()), [customer, tasks]);
  const products = useMemo(() => parseProducts(customer.interestedProducts), [customer.interestedProducts]);
  const phoneDigits = customer.phone.replace(/\s/g, "");
  const hasNext = Boolean(customer.nextAction.trim() && /^\d{4}-\d{2}-\d{2}$/.test(customer.nextContactDate));
  const nextOverdue = hasNext && customer.nextContactDate < todayISO();

  const warnings: string[] = [];
  if (flags.overdueTaskCount > 0) warnings.push(`Có ${flags.overdueTaskCount} việc quá hạn`);
  if (flags.isHotAtRisk) warnings.push("KHÁCH HOT >48H KHÔNG TƯƠNG TÁC — NGUY CƠ MẤT KHÁCH");
  if (flags.quoteNeedsFollowUp) warnings.push("ĐÃ BÁO GIÁ >24H — CẦN FOLLOW BÁO GIÁ");
  if (flags.showroomToday) warnings.push("LỊCH SHOWROOM HÔM NAY");
  if (flags.siteVisitToday) warnings.push("LỊCH CÔNG TRÌNH HÔM NAY");

  function submitNote(event: FormEvent) {
    event.preventDefault();
    if (note.trim().length < 2) return;
    onAddNote(note.trim());
    setNote("");
  }

  return (
    <div className="modal-overlay">
      <div className="customer-drawer">
        <button className="close-button" onClick={onClose}>×</button>

        <div className="drawer-title">
          <div>
            <h2>{customer.fullName}</h2>
            <span>{customer.phone}{customer.leadCode ? ` · ${customer.leadCode}` : ""}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span className="status-pill" style={{ ["--status" as string]: FUNNEL_STAGE_COLOR[customer.funnelStage] }}>{FUNNEL_STAGE_LABEL[customer.funnelStage]}</span>
            <span className="temp-pill" style={{ ["--temp" as string]: PRIORITY_COLOR[customer.priority] }}>{PRIORITY_EMOJI[customer.priority]} {PRIORITY_LABEL[customer.priority]}</span>
          </div>
        </div>

        <div className="quick-actions">
          <a className="qa-btn call" href={`tel:${phoneDigits}`}>📞 Gọi</a>
          <a className="qa-btn zalo" href={`https://zalo.me/${phoneDigits}`} target="_blank" rel="noreferrer">💬 Zalo</a>
          <button className="qa-btn" onClick={() => onEdit(customer)}>✎ Sửa</button>
          <button className="qa-btn" onClick={() => onCreateNextAction(customer)}>＋ Việc tiếp theo</button>
        </div>

        {warnings.length > 0 && (
          <div className="warn-banner detail">
            {warnings.map((w) => <div key={w}>⚠ {w}</div>)}
          </div>
        )}

        {/* KHỐI NỔI BẬT NHẤT: VIỆC TIẾP THEO */}
        {hasNext ? (
          <div className={`next-action-block${nextOverdue ? " overdue" : ""}`}>
            <div className="nab-label">VIỆC TIẾP THEO {nextOverdue ? "· QUÁ HẠN" : ""}</div>
            <div className="nab-action">{customer.nextAction}</div>
            <div className="nab-meta">
              <span>🕒 {formatDate(customer.nextContactDate)}{customer.nextActionTime ? ` · ${customer.nextActionTime}` : ""}</span>
              <span>👤 {customer.owner}</span>
            </div>
            <div className="nab-actions">
              <button className="save-button" onClick={() => onCompleteNextAction(customer)}>Hoàn thành</button>
              <button className="outline-button" onClick={() => onEditNextAction(customer)}>Đổi lịch / Sửa</button>
            </div>
          </div>
        ) : (
          <div className="next-action-block empty">
            <div className="nab-label warn">KHÁCH HÀNG CHƯA CÓ VIỆC TIẾP THEO</div>
            <button className="save-button" onClick={() => onCreateNextAction(customer)}>＋ Tạo việc tiếp theo ngay</button>
          </div>
        )}

        {/* Đổi giai đoạn pipeline */}
        <div className="detail-block">
          <div className="detail-block-title">Giai đoạn pipeline</div>
          <div className="stage-changer">
            {PIPELINE_STAGES.map((stage) => (
              <button
                key={stage}
                className={customer.funnelStage === stage ? "active" : ""}
                style={{ ["--stage" as string]: FUNNEL_STAGE_COLOR[stage] }}
                onClick={() => onChangeStage(customer, stage)}
              >
                {FUNNEL_STAGE_LABEL[stage]}
              </button>
            ))}
            <button className="off" onClick={() => onChangeStage(customer, "paused")}>Tạm hoãn</button>
            <button className="off danger" onClick={() => onRequestLost(customer)}>Mất khách</button>
          </div>
        </div>

        {customer.funnelStage === "lost" && (
          <div className="warn-banner detail">
            <div>Lý do mất: <strong>{LOSS_REASON_LABEL[customer.lossReason] ?? customer.lossReason}</strong></div>
            {customer.lostCompetitor ? <div>Đối thủ: {customer.lostCompetitor}</div> : null}
            {customer.lostNote ? <div>Ghi chú: {customer.lostNote}</div> : null}
          </div>
        )}

        <div className="detail-grid">
          <Field label="Khu vực" value={customer.ward || "—"} />
          <Field label="Nguồn" value={customer.source + (customer.campaign ? ` · ${customer.campaign}` : "")} />
          <Field label="Nhu cầu" value={customer.need || "Chưa ghi nhận"} />
          <Field label="Loại công trình" value={PROJECT_TYPE_LABEL[customer.projectType] ?? customer.projectType ?? "—"} />
          <Field label="Giai đoạn thi công" value={PROJECT_STAGE_LABEL[customer.projectStage] ?? "—"} />
          <Field label="Số WC / tầng" value={`${customer.numberOfBathrooms || "—"} WC · ${customer.numberOfFloors || "—"} tầng`} />
          <Field label="Giá trị cơ hội" value={money(customer.value)} />
          <Field label="Ngân sách" value={customer.budgetMin || customer.budgetMax ? `${money(customer.budgetMin)} – ${money(customer.budgetMax)}` : "—"} />
          <Field label="Người quyết định" value={customer.decisionMaker || "—"} />
          <Field label="Phản đối chính" value={OBJECTION_LABEL[customer.objection] ?? "—"} />
          <Field label="Đối thủ" value={customer.competitor || "—"} />
          <Field label="Ngày chốt dự kiến" value={formatDate(customer.expectedCloseDate)} />
        </div>

        {products.length > 0 && (
          <div className="detail-block">
            <div className="detail-block-title">Sản phẩm quan tâm</div>
            <div className="chip-row">{products.map((p) => <span key={p} className="chip">{p}</span>)}</div>
          </div>
        )}

        {customer.mainConcern ? (
          <div className="detail-block"><div className="detail-block-title">Băn khoăn lớn nhất</div><p style={{ margin: 0, fontSize: 13 }}>{customer.mainConcern}</p></div>
        ) : null}

        {projects.length > 0 && (
          <div className="detail-block">
            <div className="detail-block-title">Công trình liên kết</div>
            <div style={{ display: "grid", gap: 6 }}>
              {projects.map((project) => (
                <div key={project.id} style={{ fontSize: 12, padding: 8, border: "1px solid var(--line)", borderRadius: 10 }}>
                  <strong>{project.projectCode}</strong> · {money(project.lifetimeValue)} đã mua tại Tiến Nga
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="activity-section">
          <h3>Lịch sử tương tác</h3>
          <form onSubmit={submitNote} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input placeholder="Ghi lại cuộc gọi / tin nhắn vừa thực hiện..." value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="save-button" style={{ width: "auto" }}>Lưu</button>
          </form>
          <div className="timeline">
            {activities.length === 0 ? (
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Chưa có tương tác nào được ghi nhận.</span>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div>
                    <div style={{ fontSize: 13 }}>{activity.content}</div>
                    <small style={{ color: "var(--muted)" }}>{activity.enteredBy} · {formatDate(activity.createdAt.slice(0, 10))} {activity.createdAt.slice(11, 16)}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: "right" }}>
          <button className="hub-delete-button" onClick={() => onDelete(customer)}>Xoá khách hàng</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
