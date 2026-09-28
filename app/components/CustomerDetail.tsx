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
  person: string;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onAddNote: (text: string) => void;
  onCompleteNextAction: (customer: Customer) => void;
  onEditNextAction: (customer: Customer) => void;
  onCreateNextAction: (customer: Customer) => void;
  onChangeStage: (customer: Customer, stage: string) => void;
  onChangePriority: (customer: Customer, priority: string) => void;
  onRequestLost: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
};

// 4 nhóm hàng chính để theo dõi cơ hội bán chéo trên từng khách.
const PRODUCT_GROUPS = [
  { label: "Gạch ốp lát", items: ["Gạch lát nền", "Gạch ốp tường"] },
  { label: "Thiết bị vệ sinh", items: ["Bồn cầu", "Lavabo", "Bình nóng lạnh"] },
  { label: "Sen vòi & phụ kiện", items: ["Sen tắm", "Vòi", "Gương", "Phụ kiện"] },
  { label: "Bếp & thiết bị bếp", items: ["Bếp"] },
];

// Timeline thi công gộp từ 9 giai đoạn PROJECT_STAGES thành 6 mốc dễ đọc, gắn 2 mốc
// ngày quan trọng nhất (lát gạch, lắp thiết bị vệ sinh) — cái quyết định lúc gọi chốt.
const CONSTRUCTION_TIMELINE: {
  label: string;
  stages: string[];
  dateField?: "estimatedTileDate" | "estimatedBathroomInstallDate";
  dateLabel?: string;
}[] = [
  { label: "Xây thô", stages: ["dang_thiet_ke", "chuan_bi_khoi_cong", "xay_tho"] },
  { label: "Điện nước · trát", stages: ["di_dien_nuoc", "dang_trat"] },
  { label: "Lát gạch", stages: ["chuan_bi_lat_gach"], dateField: "estimatedTileDate", dateLabel: "Dự kiến lát gạch" },
  { label: "Thiết bị vệ sinh", stages: ["chuan_bi_lap_tbvs"], dateField: "estimatedBathroomInstallDate", dateLabel: "Dự kiến lắp TBVS" },
  { label: "Hoàn thiện", stages: ["hoan_thien"] },
  { label: "Bàn giao", stages: ["da_hoan_thanh"] },
];

const SOLD_STAGES = new Set(["won", "delivering", "aftercare"]);
const PRIORITY_STEPS = [
  { key: "cold", label: "Lạnh" },
  { key: "warm", label: "Ấm" },
  { key: "hot", label: "Nóng" },
];

function parseProducts(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] ?? "" : "";
  return (first + last).toLocaleUpperCase("vi");
}

export default function CustomerDetail(props: Props) {
  const { customer, activities, tasks, projects, person, onClose, onEdit, onAddNote, onCompleteNextAction, onEditNextAction, onCreateNextAction, onChangeStage, onChangePriority, onRequestLost, onDelete } = props;
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);

  const flags = useMemo(() => computeCustomerFlags(customer, tasks, todayISO(), Date.now()), [customer, tasks]);
  const products = useMemo(() => parseProducts(customer.interestedProducts), [customer.interestedProducts]);
  const phoneDigits = customer.phone.replace(/\s/g, "");
  const hasNext = Boolean(customer.nextAction.trim() && /^\d{4}-\d{2}-\d{2}$/.test(customer.nextContactDate));
  const nextOverdue = hasNext && customer.nextContactDate < todayISO();
  const isLost = customer.funnelStage === "lost";
  const isPaused = customer.funnelStage === "paused";
  const isSold = SOLD_STAGES.has(customer.funnelStage);
  const consIndex = CONSTRUCTION_TIMELINE.findIndex((m) => m.stages.includes(customer.projectStage));

  // Bảng cơ hội bán hàng — dựng từ các nhóm hàng khách quan tâm (Bước 1: suy ra từ dữ liệu
  // hiện có; Bước 2 sẽ tách thành bảng cơ hội riêng chỉnh tay được từng dòng).
  const oppRows = useMemo(() => {
    const groups = PRODUCT_GROUPS.filter((g) => g.items.some((i) => products.includes(i)));
    const source = groups.length > 0 ? groups.map((g) => g.label) : [customer.need || "Đơn hàng chính"];
    return source.map((label, idx) => {
      const primary = idx === 0;
      if (primary && isSold) {
        return {
          label,
          statusText: "Đã chốt",
          statusColor: FUNNEL_STAGE_COLOR.won,
          info: customer.closedDate ? `Chốt ${formatDate(customer.closedDate)}` : "—",
          value: money(customer.value),
        };
      }
      return {
        label,
        statusText: PRIORITY_LABEL[customer.priority] ?? "Đang theo dõi",
        statusColor: PRIORITY_COLOR[customer.priority] ?? "#94a3a0",
        info: customer.expectedCloseDate ? `Dự kiến chốt ${formatDate(customer.expectedCloseDate)}` : "—",
        value: primary && customer.value ? money(customer.value) : "Chưa xác định",
      };
    });
  }, [products, isSold, customer]);

  const suggestGroup = useMemo(() => PRODUCT_GROUPS.find((g) => !g.items.some((i) => products.includes(i))), [products]);

  const warnings: string[] = [];
  if (flags.overdueTaskCount > 0) warnings.push(`Có ${flags.overdueTaskCount} việc quá hạn`);
  if (flags.isHotAtRisk) warnings.push("Khách HOT >48h không tương tác — nguy cơ mất khách");
  if (flags.quoteNeedsFollowUp) warnings.push("Đã báo giá >24h — cần follow báo giá");
  if (flags.showroomToday) warnings.push("Lịch showroom hôm nay");
  if (flags.siteVisitToday) warnings.push("Lịch công trình hôm nay");

  // Banner tổng: đã chốt -> doanh số; mất -> lý do; còn lại -> giá trị cơ hội.
  const banner = isLost
    ? { tone: "lost", label: "KHÔNG CHỐT", value: money(customer.value), sub: `Lý do: ${LOSS_REASON_LABEL[customer.lossReason] ?? "chưa rõ"}` }
    : isSold
      ? { tone: "won", label: "DOANH SỐ ĐÃ CHỐT", value: money(customer.value), sub: `${customer.need || products[0] || "Đơn hàng"}${customer.closedDate ? ` · chốt ngày ${formatDate(customer.closedDate)}` : ""}` }
      : { tone: "open", label: "GIÁ TRỊ CƠ HỘI", value: customer.value ? money(customer.value) : "Chưa xác định", sub: customer.expectedCloseDate ? `Dự kiến chốt ${formatDate(customer.expectedCloseDate)}` : "Chưa có ngày chốt dự kiến" };

  function submitNote(event: FormEvent) {
    event.preventDefault();
    if (note.trim().length < 2) return;
    onAddNote(note.trim());
    setNote("");
  }

  return (
    <div className="cdx-overlay">
      <div className="cdx-page">
        {/* Breadcrumb */}
        <div className="cdx-crumb">
          <button className="cdx-back" onClick={onClose}>← Khách hàng</button>
          <span className="cdx-crumb-sep">/</span>
          <span className="cdx-crumb-cur">Chi tiết khách hàng</span>
        </div>

        {/* Header */}
        <div className="cdx-head">
          <div className="cdx-avatar">{initialsOf(customer.fullName)}</div>
          <div className="cdx-head-main">
            <div className="cdx-name-row">
              <h1>{customer.fullName}</h1>
              <span className="temp-pill" style={{ ["--temp" as string]: PRIORITY_COLOR[customer.priority] }}>{PRIORITY_EMOJI[customer.priority]} {PRIORITY_LABEL[customer.priority]}</span>
            </div>
            <div className="cdx-meta">
              <span>📞 {customer.phone}</span>
              {customer.ward ? <span>📍 {customer.ward}</span> : null}
              <span>👤 Sale phụ trách: {customer.owner}</span>
              <span>🔗 {customer.source}{customer.campaign ? ` · ${customer.campaign}` : ""}</span>
            </div>
          </div>
          <div className="cdx-head-actions">
            <a className="qa-btn call" href={`tel:${phoneDigits}`}>📞 Gọi khách</a>
            <a className="qa-btn zalo" href={`https://zalo.me/${phoneDigits}`} target="_blank" rel="noreferrer">💬 Nhắn Zalo</a>
            <button className="qa-btn edit" onClick={() => onEdit(customer)}>✎ Sửa hồ sơ</button>
            <button className="qa-btn del" onClick={() => onDelete(customer)}>🗑 Xoá</button>
          </div>
        </div>

        {/* Banner giá trị */}
        <div className={`cdx-banner ${banner.tone}`}>
          <div className="cdx-banner-coin">💰</div>
          <div className="cdx-banner-main">
            <span className="cdx-banner-label">{banner.label}</span>
            <strong className="cdx-banner-value">{banner.value}</strong>
          </div>
          <div className="cdx-banner-sub">{banner.sub}</div>
        </div>

        {warnings.length > 0 && (
          <div className="warn-banner detail cdx-warn">
            {warnings.map((w) => <div key={w}>⚠ {w}</div>)}
          </div>
        )}

        {/* 2 cột */}
        <div className="cdx-cols">
          {/* Cột trái */}
          <div className="cdx-left">
            {/* Hồ sơ nhu cầu */}
            <section className="cdx-card">
              <div className="cdx-card-title">📋 HỒ SƠ NHU CẦU</div>
              <dl className="cdx-facts">
                <div><dt>Công trình</dt><dd>{PROJECT_TYPE_LABEL[customer.projectType] ?? "—"}{customer.numberOfFloors ? ` · ${customer.numberOfFloors} tầng` : ""}</dd></div>
                <div><dt>Đang quan tâm</dt><dd>{products.length > 0 ? products.join(", ") : (customer.need || "Chưa ghi nhận")}</dd></div>
                <div><dt>Số phòng tắm</dt><dd>{customer.numberOfBathrooms || "—"}</dd></div>
                <div><dt>Người quyết định</dt><dd>{customer.decisionMaker || "—"}</dd></div>
                <div><dt>Ngân sách</dt><dd>{customer.budgetMin || customer.budgetMax ? `${money(customer.budgetMin)} – ${money(customer.budgetMax)}` : "Chưa rõ"}</dd></div>
                {customer.mainConcern ? <div><dt>Ưu tiên / băn khoăn</dt><dd>{customer.mainConcern}</dd></div> : null}
              </dl>
            </section>

            {/* Tiến độ công trình */}
            <section className="cdx-card">
              <div className="cdx-card-title">📊 TIẾN ĐỘ CÔNG TRÌNH</div>
              {customer.projectStage ? null : <div className="cdx-hint">Chưa ghi nhận giai đoạn thi công — cập nhật ở “Sửa hồ sơ”.</div>}
              <div className="cdx-track">
                {CONSTRUCTION_TIMELINE.map((m, i) => {
                  const state = consIndex < 0 ? "todo" : i < consIndex ? "done" : i === consIndex ? "current" : "todo";
                  const date = m.dateField ? customer[m.dateField] : "";
                  return (
                    <div key={m.label} className={`cdx-track-step ${state}`}>
                      <div className="cdx-track-node">{state === "done" ? "✓" : ""}</div>
                      <span className="cdx-track-label">{m.label}</span>
                      {date ? <span className="cdx-track-date">{m.dateLabel}: {formatDate(date)}</span> : null}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Cơ hội bán hàng */}
            <section className="cdx-card">
              <div className="cdx-card-title">🏷 CƠ HỘI BÁN HÀNG</div>
              <table className="cdx-opp">
                <thead>
                  <tr><th>Sản phẩm / Danh mục</th><th>Trạng thái</th><th>Thông tin thêm</th><th className="right">Giá trị dự kiến</th></tr>
                </thead>
                <tbody>
                  {oppRows.map((r) => (
                    <tr key={r.label}>
                      <td className="cdx-opp-name">{r.label}</td>
                      <td><span className="cdx-opp-badge" style={{ ["--c" as string]: r.statusColor }}>{r.statusText}</span></td>
                      <td className="cdx-opp-info">{r.info}</td>
                      <td className="right cdx-opp-value">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Lịch sử chăm sóc */}
            <section className="cdx-card">
              <div className="cdx-card-title">🕒 LỊCH SỬ CHĂM SÓC</div>
              <form onSubmit={submitNote} className="cdx-note-row">
                <input placeholder="Ghi lại cuộc gọi / tin nhắn vừa thực hiện..." value={note} onChange={(e) => setNote(e.target.value)} />
                <button type="submit" className="save-button">Lưu</button>
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
            </section>

            {/* Thông tin bổ sung */}
            <section className="cdx-card">
              <button className="cdx-more-toggle" onClick={() => setShowMore((v) => !v)}>
                <span>📄 Thông tin bổ sung</span>
                <span>{showMore ? "▲" : "▼"}</span>
              </button>
              {showMore && (
                <div className="cdx-more">
                  <div className="cdx-sub-title">Đổi giai đoạn bán</div>
                  <div className="stage-changer">
                    {PIPELINE_STAGES.map((stage) => (
                      <button key={stage} className={customer.funnelStage === stage ? "active" : ""} style={{ ["--stage" as string]: FUNNEL_STAGE_COLOR[stage] }} onClick={() => onChangeStage(customer, stage)}>
                        {FUNNEL_STAGE_LABEL[stage]}
                      </button>
                    ))}
                    <button className="off" onClick={() => onChangeStage(customer, "paused")}>Tạm hoãn</button>
                    <button className="off danger" onClick={() => onRequestLost(customer)}>Không chốt</button>
                  </div>

                  {isLost && (
                    <div className="warn-banner detail" style={{ marginTop: 12 }}>
                      <div>Lý do không chốt: <strong>{LOSS_REASON_LABEL[customer.lossReason] ?? customer.lossReason}</strong></div>
                      {customer.lostCompetitor ? <div>Đối thủ: {customer.lostCompetitor}</div> : null}
                      {customer.lostNote ? <div>Ghi chú: {customer.lostNote}</div> : null}
                    </div>
                  )}

                  <div className="detail-grid" style={{ marginTop: 14 }}>
                    <Field label="Giai đoạn thi công" value={PROJECT_STAGE_LABEL[customer.projectStage] ?? "—"} />
                    <Field label="Số WC / tầng" value={`${customer.numberOfBathrooms || "—"} WC · ${customer.numberOfFloors || "—"} tầng`} />
                    <Field label="Phản đối chính" value={OBJECTION_LABEL[customer.objection] ?? "—"} />
                    <Field label="Đối thủ" value={customer.competitor || "—"} />
                    <Field label="Ngày chốt dự kiến" value={formatDate(customer.expectedCloseDate)} />
                    <Field label="Ngày lát gạch dự kiến" value={formatDate(customer.estimatedTileDate)} />
                    <Field label="Ngày lắp TBVS dự kiến" value={formatDate(customer.estimatedBathroomInstallDate)} />
                  </div>

                  {projects.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div className="cdx-sub-title">Công trình liên kết</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {projects.map((project) => (
                          <div key={project.id} style={{ fontSize: 12, padding: 8, border: "1px solid var(--line)", borderRadius: 10 }}>
                            <strong>{project.projectCode}</strong> · {money(project.lifetimeValue)} đã mua tại Tiến Nga
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </section>
          </div>

          {/* Cột phải */}
          <div className="cdx-right">
            {/* Việc cần làm tiếp */}
            <section className="cdx-card rail">
              <div className="cdx-card-title">🗒 VIỆC CẦN LÀM TIẾP</div>
              {hasNext ? (
                <div className={`cdx-next${nextOverdue ? " overdue" : ""}`}>
                  <div className="cdx-next-action">{customer.nextAction}</div>
                  <div className="cdx-next-meta">
                    <span>🕒 {formatDate(customer.nextContactDate)}{customer.nextActionTime ? ` · ${customer.nextActionTime}` : ""}{nextOverdue ? " · QUÁ HẠN" : ""}</span>
                    <span>👤 {customer.owner}</span>
                  </div>
                  <div className="cdx-next-btns">
                    <button className="save-button" onClick={() => onCompleteNextAction(customer)}>Hoàn thành</button>
                    <button className="outline-button" onClick={() => onEditNextAction(customer)}>Đổi lịch</button>
                  </div>
                </div>
              ) : (
                <div className="cdx-next empty">
                  <div className="cdx-next-warn">Chưa có việc tiếp theo</div>
                  <button className="save-button" onClick={() => onCreateNextAction(customer)}>＋ Tạo việc ngay</button>
                </div>
              )}
            </section>

            {/* Mức độ quan tâm */}
            <section className="cdx-card rail">
              <div className="cdx-card-title">🌡 Cập nhật mức độ quan tâm</div>
              <div className="cdx-temp-btns">
                {PRIORITY_STEPS.map((p) => (
                  <button
                    key={p.key}
                    className={`cdx-temp${customer.priority === p.key && !isSold ? " active" : ""}`}
                    style={{ ["--c" as string]: PRIORITY_COLOR[p.key] }}
                    onClick={() => onChangePriority(customer, p.key)}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  className={`cdx-temp won${isSold ? " active" : ""}`}
                  style={{ ["--c" as string]: FUNNEL_STAGE_COLOR.won }}
                  onClick={() => onChangeStage(customer, "won")}
                >
                  Đã chốt
                </button>
              </div>
            </section>

            {/* Ghi chú nhanh */}
            <section className="cdx-card rail">
              <div className="cdx-card-title">✏️ Ghi chú nhanh</div>
              <form onSubmit={submitNote}>
                <textarea className="cdx-quicknote" placeholder="Nhập ghi chú..." value={note} onChange={(e) => setNote(e.target.value)} />
                <button type="submit" className="save-button" style={{ width: "100%", marginTop: 8 }}>💾 Lưu ghi chú</button>
              </form>
            </section>

            {/* Gợi ý bán chéo */}
            {suggestGroup && !isLost && (
              <section className="cdx-card rail suggest">
                <div className="cdx-suggest-head">💡 Khách hàng có thể quan tâm thêm</div>
                <div className="cdx-suggest-name">{suggestGroup.label}</div>
                <div className="cdx-suggest-sub">
                  Chủ động tư vấn bộ sản phẩm phù hợp{customer.numberOfBathrooms ? ` với ${customer.numberOfBathrooms} phòng tắm` : ""}.
                </div>
              </section>
            )}
          </div>
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
