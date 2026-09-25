"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Customer, Project, ProjectItem } from "../../lib/types";
import { money } from "../../lib/format";
import { CONSTRUCTION_STAGE_LABEL, PROJECT_STATUS_LABEL, PURCHASE_STATUS_COLOR, PURCHASE_STATUS_LABEL } from "../../lib/labels";
import { PROJECT_CATEGORIES, PROJECT_ROOMS } from "../../db/enums";

const constructionStageOptions = Object.entries(CONSTRUCTION_STAGE_LABEL);
const statusOptions = Object.entries(PROJECT_STATUS_LABEL);
const purchaseCycle = ["chua_mua", "tien_nga", "noi_khac"] as const;
const PROJECT_TABLE_COLUMNS = "1.4fr 1.4fr 1.6fr 1.2fr";

function emptyProjectForm(customerId: number) {
  return {
    customerId,
    address: "",
    ward: "",
    area: "",
    numberOfWc: 1,
    hasKitchen: false,
    contractorName: "",
    constructionStage: "chua_khoi_cong",
    tileDeliveredAt: "",
    expectedTilingAt: "",
    notes: "",
  };
}

export default function ProjectsView({
  projects,
  customers,
  person,
  onToast,
  onRefresh,
  presetCustomerId,
  onConsumePreset,
}: {
  projects: Project[];
  customers: Customer[];
  person: string;
  onToast: (message: string) => void;
  onRefresh: () => Promise<void> | void;
  presetCustomerId: number | null;
  onConsumePreset: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => emptyProjectForm(customers[0]?.id ?? 0));
  const [saving, setSaving] = useState(false);
  const [stageFilter, setStageFilter] = useState("all");
  const [editingCell, setEditingCell] = useState<{ room: string; category: string } | null>(null);
  const [cellDraft, setCellDraft] = useState({ purchaseStatus: "chua_mua", orderValue: "0", purchasedAt: "", notes: "" });

  useEffect(() => {
    if (presetCustomerId) {
      setForm(emptyProjectForm(presetCustomerId));
      setShowForm(true);
      onConsumePreset();
    }
  }, [presetCustomerId, onConsumePreset]);

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedId) ?? null, [projects, selectedId]);

  useEffect(() => {
    if (!selectedId) { setItems([]); return; }
    fetch(`/api/project-items?projectId=${selectedId}`).then((res) => res.json()).then((data) => setItems(data.items ?? []));
  }, [selectedId]);

  const filteredProjects = useMemo(
    () => (stageFilter === "all" ? projects : projects.filter((project) => project.constructionStage === stageFilter)),
    [projects, stageFilter],
  );

  function itemAt(room: string, category: string) {
    return items.find((item) => item.room === room && item.category === category) ?? null;
  }

  async function cycleCell(room: string, category: string) {
    if (!selectedProject) return;
    const current = itemAt(room, category);
    const currentStatus = current?.purchaseStatus ?? "chua_mua";
    const nextStatus = purchaseCycle[(purchaseCycle.indexOf(currentStatus as typeof purchaseCycle[number]) + 1) % purchaseCycle.length];
    const res = await fetch("/api/project-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProject.id, room, category, purchaseStatus: nextStatus, orderValue: current?.orderValue ?? 0, purchasedAt: current?.purchasedAt ?? "", notes: current?.notes ?? "" }),
    });
    const data = await res.json();
    if (!res.ok) { onToast(data.error ?? "Không cập nhật được checklist."); return; }
    setItems((prev) => {
      const next = prev.filter((item) => !(item.room === room && item.category === category));
      return [...next, data.item];
    });
    await onRefresh();
  }

  function openCellEditor(room: string, category: string) {
    const current = itemAt(room, category);
    setEditingCell({ room, category });
    setCellDraft({
      purchaseStatus: current?.purchaseStatus ?? "chua_mua",
      orderValue: String(current?.orderValue ?? 0),
      purchasedAt: current?.purchasedAt ?? "",
      notes: current?.notes ?? "",
    });
  }

  async function saveCellEditor(event: FormEvent) {
    event.preventDefault();
    if (!editingCell || !selectedProject) return;
    const res = await fetch("/api/project-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProject.id, room: editingCell.room, category: editingCell.category, purchaseStatus: cellDraft.purchaseStatus, orderValue: Number(cellDraft.orderValue) || 0, purchasedAt: cellDraft.purchasedAt, notes: cellDraft.notes }),
    });
    const data = await res.json();
    if (!res.ok) { onToast(data.error ?? "Không lưu được ô checklist."); return; }
    setItems((prev) => [...prev.filter((item) => !(item.room === editingCell.room && item.category === editingCell.category)), data.item]);
    setEditingCell(null);
    onToast("Đã lưu checklist công trình");
    await onRefresh();
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!form.customerId) { onToast("Vui lòng chọn khách hàng."); return; }
    setSaving(true);
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { onToast(data.error ?? "Không tạo được hồ sơ công trình."); return; }
    setShowForm(false);
    setForm(emptyProjectForm(customers[0]?.id ?? 0));
    onToast(`Đã tạo hồ sơ công trình ${data.project.projectCode}`);
    await onRefresh();
    setSelectedId(data.project.id);
  }

  async function updateProjectField(field: string, value: string | number | boolean) {
    if (!selectedProject) return;
    const res = await fetch("/api/projects", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedProject.id, [field]: value }) });
    const data = await res.json();
    if (!res.ok) { onToast(data.error ?? "Không cập nhật được công trình."); return; }
    await onRefresh();
  }

  return (
    <div className="simple-page">
      <section className="welcome-row">
        <div><p>HỒ SƠ CÔNG TRÌNH</p><h1>Công trình & bán chéo</h1><span>Gộp các đơn của cùng một căn nhà, theo dõi giai đoạn thi công để gọi đúng lúc.</span></div>
        <button className="outline-button" onClick={() => setShowForm(true)}>＋ Mở hồ sơ công trình</button>
      </section>

      <section className="customer-hub-filters" aria-label="Bộ lọc công trình">
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
          <option value="all">Tất cả giai đoạn thi công</option>
          {constructionStageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <span>{filteredProjects.length} công trình</span>
      </section>

      <div className="dashboard-grid">
        <div className="map-card">
          <div className="dashboard-card-title"><strong>Danh sách công trình</strong></div>
          <div className="crm-table-scroll">
            {filteredProjects.length === 0 ? (
              <div className="crm-table-empty"><strong>Chưa có công trình nào</strong><span>Mở hồ sơ công trình ngay khi khách chốt đơn gạch đầu tiên.</span></div>
            ) : (
              <div className="crm-table-head" style={{ gridTemplateColumns: PROJECT_TABLE_COLUMNS }}>
                <span>Công trình</span><span>Giai đoạn thi công</span><span>Checklist bán chéo</span><span>Giá trị vòng đời</span>
              </div>
            )}
            {filteredProjects.map((project) => (
              <button key={project.id} className="crm-table-row" style={{ gridTemplateColumns: PROJECT_TABLE_COLUMNS }} onClick={() => setSelectedId(project.id)}>
                <div className="crm-cell"><strong>{project.projectCode}</strong><small>{project.customerName}</small></div>
                <div className="crm-cell"><span>{CONSTRUCTION_STAGE_LABEL[project.constructionStage] ?? project.constructionStage}</span><small>{project.ward || "Chưa rõ khu vực"}</small></div>
                <div className="crm-cell"><span>{project.boughtAtTienNgaCount} hạng mục tại TN</span><small>{project.boughtElsewhereCount} mua nơi khác</small></div>
                <div className="crm-cell"><strong>{money(project.lifetimeValue)}</strong><small>Giá trị vòng đời công trình</small></div>
              </button>
            ))}
          </div>
        </div>

        <div className="map-card">
          <div className="dashboard-card-title"><strong>{selectedProject ? selectedProject.projectCode : "Chọn một công trình"}</strong></div>
          {!selectedProject ? (
            <div className="empty-state"><strong>Bấm vào một công trình để xem checklist bán chéo.</strong></div>
          ) : (
            <div style={{ padding: 16, display: "grid", gap: 14 }}>
              <div><strong>{selectedProject.customerName}</strong><div style={{ color: "#647572", fontSize: 12 }}>{selectedProject.customerPhone} · {selectedProject.address || "Chưa có địa chỉ"}</div></div>

              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Giai đoạn thi công
                <select value={selectedProject.constructionStage} onChange={(event) => updateProjectField("constructionStage", event.target.value)}>
                  {constructionStageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Ngày giao gạch (T0)
                  <input type="date" value={selectedProject.tileDeliveredAt.slice(0, 10)} onChange={(event) => updateProjectField("tileDeliveredAt", event.target.value)} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Dự kiến ốp lát
                  <input type="date" value={selectedProject.expectedTilingAt.slice(0, 10)} onChange={(event) => updateProjectField("expectedTilingAt", event.target.value)} />
                </label>
              </div>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Trạng thái công trình
                <select value={selectedProject.status} onChange={(event) => updateProjectField("status", event.target.value)}>
                  {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              <div>
                <strong style={{ fontSize: 12 }}>Checklist hạng mục — bấm để chuyển Chưa mua → Tại Tiến Nga → Nơi khác, bấm giữ để sửa chi tiết</strong>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 6 }}>Phòng</th>
                        {PROJECT_CATEGORIES.map((category) => <th key={category} style={{ padding: 6, textAlign: "center" }}>{category}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {PROJECT_ROOMS.map((room) => (
                        <tr key={room}>
                          <td style={{ padding: 6, fontWeight: 700 }}>{room}</td>
                          {PROJECT_CATEGORIES.map((category) => {
                            const item = itemAt(room, category);
                            const status = item?.purchaseStatus ?? "chua_mua";
                            return (
                              <td key={category} style={{ padding: 4, textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => cycleCell(room, category)}
                                  onDoubleClick={() => openCellEditor(room, category)}
                                  title="Bấm: đổi trạng thái · Bấm đúp: sửa giá trị/ngày mua"
                                  style={{ width: "100%", padding: "8px 4px", borderRadius: 8, border: "1px solid #dbe4e0", cursor: "pointer", background: `color-mix(in srgb, ${PURCHASE_STATUS_COLOR[status]} 14%, white)`, color: PURCHASE_STATUS_COLOR[status], fontWeight: 700 }}
                                >
                                  {PURCHASE_STATUS_LABEL[status]}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {editingCell && (
                <form onSubmit={saveCellEditor} style={{ display: "grid", gap: 8, padding: 12, border: "1px solid #d7e2dd", borderRadius: 12, background: "#fbfdfb" }}>
                  <strong style={{ fontSize: 12 }}>{editingCell.room} · {editingCell.category}</strong>
                  <select value={cellDraft.purchaseStatus} onChange={(event) => setCellDraft((prev) => ({ ...prev, purchaseStatus: event.target.value }))}>
                    {Object.entries(PURCHASE_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input type="number" min={0} placeholder="Giá trị đơn (nếu mua tại Tiến Nga)" value={cellDraft.orderValue} onChange={(event) => setCellDraft((prev) => ({ ...prev, orderValue: event.target.value }))} />
                  <input type="date" value={cellDraft.purchasedAt.slice(0, 10)} onChange={(event) => setCellDraft((prev) => ({ ...prev, purchasedAt: event.target.value }))} />
                  <input placeholder="Ghi chú" value={cellDraft.notes} onChange={(event) => setCellDraft((prev) => ({ ...prev, notes: event.target.value }))} />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="outline-button" onClick={() => setEditingCell(null)}>Huỷ</button>
                    <button type="submit" className="save-button">Lưu</button>
                  </div>
                </form>
              )}

              <div style={{ fontSize: 11, color: "#647572" }}>Người thao tác gần nhất: {person}</div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="simple-modal">
            <div className="modal-title"><h2>Mở hồ sơ công trình mới</h2><button className="close-button" onClick={() => setShowForm(false)}>×</button></div>
            <form onSubmit={createProject} className="modal-grid-flow">
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Khách hàng
                <select value={form.customerId} onChange={(event) => setForm((prev) => ({ ...prev, customerId: Number(event.target.value) }))} required>
                  <option value={0} disabled>Chọn khách hàng</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName} · {customer.phone}</option>)}
                </select>
              </label>
              <input placeholder="Địa chỉ công trình" value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
              <input placeholder="Xã/phường" value={form.ward} onChange={(event) => setForm((prev) => ({ ...prev, ward: event.target.value }))} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input placeholder="Diện tích (m²)" value={form.area} onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))} />
                <input type="number" min={1} placeholder="Số WC" value={form.numberOfWc} onChange={(event) => setForm((prev) => ({ ...prev, numberOfWc: Number(event.target.value) || 1 }))} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <input type="checkbox" checked={form.hasKitchen} onChange={(event) => setForm((prev) => ({ ...prev, hasKitchen: event.target.checked }))} /> Có làm bếp
              </label>
              <input placeholder="Thợ / nhà thầu" value={form.contractorName} onChange={(event) => setForm((prev) => ({ ...prev, contractorName: event.target.value }))} />
              <select value={form.constructionStage} onChange={(event) => setForm((prev) => ({ ...prev, constructionStage: event.target.value }))}>
                {constructionStageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Ngày giao gạch
                  <input type="date" value={form.tileDeliveredAt} onChange={(event) => setForm((prev) => ({ ...prev, tileDeliveredAt: event.target.value }))} />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Dự kiến ốp lát
                  <input type="date" value={form.expectedTilingAt} onChange={(event) => setForm((prev) => ({ ...prev, expectedTilingAt: event.target.value }))} />
                </label>
              </div>
              <textarea placeholder="Ghi chú" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
              <div className="modal-actions">
                <button type="button" className="outline-button" onClick={() => setShowForm(false)}>Huỷ</button>
                <button type="submit" className="save-button" disabled={saving}>{saving ? "Đang lưu..." : "Mở hồ sơ công trình"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
