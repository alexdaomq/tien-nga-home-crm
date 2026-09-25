"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Activity, Customer, Document, Project, Task } from "../../lib/types";
import { money, formatDate, todayISO } from "../../lib/format";
import { computeCustomerFlags } from "../../lib/flags";
import { PIPELINE_STAGES, DOC_TYPES } from "../../db/enums";
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
  DOC_TYPE_LABEL,
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
  onRequestLost: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
};

// 6 bước hành trình bán hàng Tiến Nga (gom từ 9 stage pipeline).
const JOURNEY = [
  { label: "Nhận biết", stages: ["lead"] },
  { label: "Tư vấn", stages: ["consulting", "appointment", "arrived"] },
  { label: "Chốt đơn", stages: ["site_survey", "quoted", "negotiating"] },
  { label: "Giao đơn đầu", stages: ["won", "delivering"] },
  { label: "Bán tiếp", stages: ["aftercare"] },
  { label: "Sau bán", stages: [] },
];

// 4 nhóm hàng chính để theo dõi lộ trình bán chéo trên từng khách.
const PRODUCT_GROUPS = [
  { label: "Gạch ốp lát", items: ["Gạch lát nền", "Gạch ốp tường"] },
  { label: "Thiết bị vệ sinh", items: ["Bồn cầu", "Lavabo", "Bình nóng lạnh"] },
  { label: "Sen vòi & phụ kiện", items: ["Sen tắm", "Vòi", "Gương", "Phụ kiện"] },
  { label: "Bếp & thiết bị bếp", items: ["Bếp"] },
];

const SOLD_STAGES = new Set(["won", "delivering", "aftercare"]);

// Bật/tắt mục upload tài liệu. Tạm TẮT vì chưa bật kho R2 trên Cloudflare.
// Khi đã bật R2 (tạo bucket tien-nga-files + hosting.json r2="FILES" + migration 0004),
// đổi thành true để hiện lại.
const DOCS_ENABLED = false;

function parseProducts(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function journeyIndexOf(stage: string): number {
  return JOURNEY.findIndex((phase) => phase.stages.includes(stage));
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] ?? "" : "";
  return (first + last).toLocaleUpperCase("vi");
}

export default function CustomerDetail(props: Props) {
  const { customer, activities, tasks, projects, person, onClose, onEdit, onAddNote, onCompleteNextAction, onEditNextAction, onCreateNextAction, onChangeStage, onRequestLost, onDelete } = props;
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);

  // Tài liệu/báo giá đã gửi khách (upload file thật lên R2).
  const [docs, setDocs] = useState<Document[]>([]);
  const [docType, setDocType] = useState<string>("bao_gia");
  const [docAmount, setDocAmount] = useState("");
  const [docNote, setDocNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!DOCS_ENABLED) return;
    let active = true;
    fetch(`/api/documents?customerId=${customer.id}`)
      .then((res) => res.json())
      .then((data) => { if (active) setDocs(data.documents ?? []); })
      .catch(() => { if (active) setDocs([]); });
    return () => { active = false; };
  }, [customer.id]);

  async function uploadFile(event: FormEvent) {
    event.preventDefault();
    setUploadError("");
    const file = fileRef.current?.files?.[0];
    if (!file) { setUploadError("Chưa chọn file."); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("customerId", String(customer.id));
    form.append("docType", docType);
    form.append("amount", docType === "bao_gia" ? String(Number(docAmount) || 0) : "0");
    form.append("note", docNote.trim());
    form.append("uploadedBy", person);
    setUploading(true);
    const res = await fetch("/api/documents", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setUploadError(data.error ?? "Không tải lên được."); return; }
    setDocs((prev) => [data.document, ...prev]);
    setDocAmount("");
    setDocNote("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function deleteDoc(doc: Document) {
    if (!window.confirm(`Xoá "${doc.fileName}"?`)) return;
    const res = await fetch("/api/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: doc.id }) });
    if (res.ok) setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  }

  const flags = useMemo(() => computeCustomerFlags(customer, tasks, todayISO(), Date.now()), [customer, tasks]);
  const products = useMemo(() => parseProducts(customer.interestedProducts), [customer.interestedProducts]);
  const phoneDigits = customer.phone.replace(/\s/g, "");
  const hasNext = Boolean(customer.nextAction.trim() && /^\d{4}-\d{2}-\d{2}$/.test(customer.nextContactDate));
  const nextOverdue = hasNext && customer.nextContactDate < todayISO();
  const currentPhase = journeyIndexOf(customer.funnelStage);
  const isOffTrack = customer.funnelStage === "lost" || customer.funnelStage === "paused";
  const isSold = SOLD_STAGES.has(customer.funnelStage);

  const roadmap = useMemo(
    () =>
      PRODUCT_GROUPS.map((group) => {
        const wanted = group.items.some((item) => products.includes(item));
        const status = wanted ? (isSold ? "done" : "active") : "todo";
        return { label: group.label, status };
      }),
    [products, isSold],
  );

  const warnings: string[] = [];
  if (flags.overdueTaskCount > 0) warnings.push(`Có ${flags.overdueTaskCount} việc quá hạn`);
  if (flags.isHotAtRisk) warnings.push("Khách HOT >48h không tương tác — nguy cơ mất khách");
  if (flags.quoteNeedsFollowUp) warnings.push("Đã báo giá >24h — cần follow báo giá");
  if (flags.showroomToday) warnings.push("Lịch showroom hôm nay");
  if (flags.siteVisitToday) warnings.push("Lịch công trình hôm nay");

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

        {/* Header liên hệ nhanh */}
        <div className="cd-head">
          <div className="cd-avatar">{initialsOf(customer.fullName)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cd-name-row">
              <h2>{customer.fullName}</h2>
              <span className="temp-pill" style={{ ["--temp" as string]: PRIORITY_COLOR[customer.priority] }}>{PRIORITY_EMOJI[customer.priority]} {PRIORITY_LABEL[customer.priority]}</span>
            </div>
            <div className="cd-sub">{customer.phone}{customer.ward ? ` · ${customer.ward}` : ""}</div>
            <div className="cd-source">{customer.source}{customer.campaign ? ` — ${customer.campaign}` : ""}</div>
          </div>
        </div>

        <div className="quick-actions">
          <a className="qa-btn call" href={`tel:${phoneDigits}`}>📞 Gọi</a>
          <a className="qa-btn zalo" href={`https://zalo.me/${phoneDigits}`} target="_blank" rel="noreferrer">💬 Zalo</a>
          <button className="qa-btn" onClick={() => onEdit(customer)}>✎ Sửa</button>
        </div>

        {/* Thanh hành trình 6 bước */}
        <div className="journey">
          <div className="journey-label">Hành trình khách</div>
          {isOffTrack ? (
            <div className="journey-off">{FUNNEL_STAGE_LABEL[customer.funnelStage]}</div>
          ) : (
            <div className="journey-steps">
              {JOURNEY.map((phase, index) => {
                const state = index < currentPhase ? "done" : index === currentPhase ? "current" : "todo";
                return (
                  <div key={phase.label} className={`journey-step ${state}`}>
                    <div className="journey-bar" />
                    <span>{phase.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {warnings.length > 0 && (
          <div className="warn-banner detail">
            {warnings.map((w) => <div key={w}>⚠ {w}</div>)}
          </div>
        )}

        {/* Việc tiếp theo — nổi bật nhất */}
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

        {/* Khách cần gì */}
        <div className="cd-section">
          <div className="cd-section-title">Khách cần gì</div>
          {products.length > 0 && <div className="chip-row" style={{ marginBottom: 10 }}>{products.map((p) => <span key={p} className="chip">{p}</span>)}</div>}
          <div className="cd-need-grid">
            <div className="cd-need-cell"><span>Ngân sách</span><strong>{customer.budgetMin || customer.budgetMax ? `${money(customer.budgetMin)} – ${money(customer.budgetMax)}` : "Chưa rõ"}</strong></div>
            <div className="cd-need-cell"><span>Giai đoạn công trình</span><strong>{PROJECT_STAGE_LABEL[customer.projectStage] ?? "Chưa rõ"}</strong></div>
            <div className="cd-need-cell"><span>Giá trị cơ hội</span><strong>{money(customer.value)}</strong></div>
            <div className="cd-need-cell"><span>Nhu cầu</span><strong>{customer.need || "Chưa ghi nhận"}</strong></div>
          </div>
        </div>

        {/* Lộ trình sản phẩm — bán tiếp */}
        <div className="cd-section">
          <div className="cd-section-title">Lộ trình sản phẩm (bán tiếp)</div>
          <div className="roadmap">
            {roadmap.map((group) => (
              <div key={group.label} className={`roadmap-row ${group.status}`}>
                <span className="roadmap-dot" />
                <span className="roadmap-name">{group.label}</span>
                <span className="roadmap-status">
                  {group.status === "done" ? (isSold ? "Đã bán / đã chốt" : "Đã có nhu cầu") : group.status === "active" ? "Đang quan tâm" : "Gợi ý bán thêm"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Báo giá & tài liệu đã gửi khách — tạm ẩn tới khi bật kho R2 */}
        {DOCS_ENABLED && (
        <div className="cd-section">
          <div className="cd-section-title">Báo giá &amp; tài liệu đã gửi</div>
          {docs.length > 0 && (
            <div className="doc-list">
              {docs.map((doc) => (
                <div key={doc.id} className="doc-row">
                  <div className="doc-icon">{doc.contentType.startsWith("image/") ? "🖼" : doc.contentType.includes("pdf") ? "📄" : "📎"}</div>
                  <div className="doc-main">
                    <a href={`/api/documents/file?id=${doc.id}`} target="_blank" rel="noreferrer" className="doc-name">{doc.fileName}</a>
                    <div className="doc-meta">
                      <span className="doc-type">{DOC_TYPE_LABEL[doc.docType] ?? doc.docType}</span>
                      {doc.amount ? <span className="doc-amount">{money(doc.amount)}</span> : null}
                      <span>{formatDate(doc.createdAt.slice(0, 10))} · {doc.uploadedBy}</span>
                    </div>
                    {doc.note ? <div className="doc-note">{doc.note}</div> : null}
                  </div>
                  <button className="doc-del" onClick={() => deleteDoc(doc)} aria-label="Xoá tài liệu">×</button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={uploadFile} className="doc-upload">
            <div className="doc-upload-row">
              <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
              </select>
              {docType === "bao_gia" && (
                <input type="number" min={0} placeholder="Số tiền (đ)" value={docAmount} onChange={(e) => setDocAmount(e.target.value)} />
              )}
            </div>
            <input placeholder="Ghi chú (VD: bản v2 sau giảm giá)" value={docNote} onChange={(e) => setDocNote(e.target.value)} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
            {uploadError ? <div className="warn-banner" style={{ padding: "6px 10px" }}>{uploadError}</div> : null}
            <button type="submit" className="save-button" disabled={uploading}>{uploading ? "Đang tải lên..." : "＋ Tải tài liệu lên"}</button>
          </form>
        </div>
        )}

        {/* Lịch sử chăm sóc */}
        <div className="cd-section">
          <div className="cd-section-title">Lịch sử chăm sóc</div>
          <form onSubmit={submitNote} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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

        {/* Chi tiết thêm — thu gọn */}
        <button className="cd-more-toggle" onClick={() => setShowMore((v) => !v)}>
          {showMore ? "▲ Thu gọn chi tiết" : "▼ Chi tiết thêm (giai đoạn, đối thủ, người quyết định...)"}
        </button>

        {showMore && (
          <div className="cd-more">
            <div className="cd-section-title">Đổi giai đoạn pipeline</div>
            <div className="stage-changer">
              {PIPELINE_STAGES.map((stage) => (
                <button key={stage} className={customer.funnelStage === stage ? "active" : ""} style={{ ["--stage" as string]: FUNNEL_STAGE_COLOR[stage] }} onClick={() => onChangeStage(customer, stage)}>
                  {FUNNEL_STAGE_LABEL[stage]}
                </button>
              ))}
              <button className="off" onClick={() => onChangeStage(customer, "paused")}>Tạm hoãn</button>
              <button className="off danger" onClick={() => onRequestLost(customer)}>Mất khách</button>
            </div>

            {customer.funnelStage === "lost" && (
              <div className="warn-banner detail" style={{ marginTop: 12 }}>
                <div>Lý do mất: <strong>{LOSS_REASON_LABEL[customer.lossReason] ?? customer.lossReason}</strong></div>
                {customer.lostCompetitor ? <div>Đối thủ: {customer.lostCompetitor}</div> : null}
                {customer.lostNote ? <div>Ghi chú: {customer.lostNote}</div> : null}
              </div>
            )}

            <div className="detail-grid" style={{ marginTop: 14 }}>
              <Field label="Loại công trình" value={PROJECT_TYPE_LABEL[customer.projectType] ?? customer.projectType ?? "—"} />
              <Field label="Số WC / tầng" value={`${customer.numberOfBathrooms || "—"} WC · ${customer.numberOfFloors || "—"} tầng`} />
              <Field label="Người quyết định" value={customer.decisionMaker || "—"} />
              <Field label="Phản đối chính" value={OBJECTION_LABEL[customer.objection] ?? "—"} />
              <Field label="Đối thủ" value={customer.competitor || "—"} />
              <Field label="Ngày chốt dự kiến" value={formatDate(customer.expectedCloseDate)} />
              <Field label="Ngày lát gạch dự kiến" value={formatDate(customer.estimatedTileDate)} />
              <Field label="Ngày lắp TBVS dự kiến" value={formatDate(customer.estimatedBathroomInstallDate)} />
            </div>

            {customer.mainConcern ? (
              <div style={{ marginTop: 6 }}><div className="cd-section-title">Băn khoăn lớn nhất</div><p style={{ margin: 0, fontSize: 13 }}>{customer.mainConcern}</p></div>
            ) : null}

            {projects.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="cd-section-title">Công trình liên kết</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {projects.map((project) => (
                    <div key={project.id} style={{ fontSize: 12, padding: 8, border: "1px solid var(--line)", borderRadius: 10 }}>
                      <strong>{project.projectCode}</strong> · {money(project.lifetimeValue)} đã mua tại Tiến Nga
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button className="hub-delete-button" onClick={() => onDelete(customer)}>Xoá khách hàng</button>
            </div>
          </div>
        )}
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
