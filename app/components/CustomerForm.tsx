"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Customer } from "../../lib/types";
import { TEAM_MEMBERS } from "../../lib/types";
import { todayISO } from "../../lib/format";
import {
  SOURCES,
  FUNNEL_STAGES,
  PRIORITIES,
  PROJECT_STAGES,
  PROJECT_TYPES,
  OBJECTIONS,
  INTERESTED_PRODUCTS,
} from "../../db/enums";
import {
  FUNNEL_STAGE_LABEL,
  PRIORITY_LABEL,
  PRIORITY_EMOJI,
  PROJECT_STAGE_LABEL,
  PROJECT_TYPE_LABEL,
  OBJECTION_LABEL,
} from "../../lib/labels";

type Props = {
  mode: "create" | "edit";
  customer?: Customer | null;
  person: string;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onClose: () => void;
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

export default function CustomerForm({ mode, customer, person, saving, onSubmit, onClose }: Props) {
  const [form, setForm] = useState(() => initForm(customer, person));
  const [products, setProducts] = useState<string[]>(() => parseProducts(customer?.interestedProducts ?? ""));

  useEffect(() => {
    setForm(initForm(customer, person));
    setProducts(parseProducts(customer?.interestedProducts ?? ""));
  }, [customer, person]);

  function set<K extends keyof ReturnType<typeof initForm>>(key: K, value: ReturnType<typeof initForm>[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleProduct(name: string) {
    setProducts((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const base: Record<string, unknown> = {
      fullName: form.fullName,
      phone: form.phone,
      source: form.source,
      ward: form.ward,
      need: form.need,
      owner: form.owner || person,
      priority: form.priority,
      interestedProducts: products,
    };
    if (mode === "create") {
      onSubmit({
        ...base,
        funnelStage: "lead",
        contactResult: "chua_lien_he",
        nextAction: "Gọi khách lần đầu",
        nextActionType: "goi_khach",
        nextContactDate: todayISO(),
        nextActionTime: "09:00",
      });
      return;
    }
    onSubmit({
      ...base,
      zalo: form.zalo,
      email: form.email,
      address: form.address,
      campaign: form.campaign,
      funnelStage: form.funnelStage,
      contactResult: customer?.contactResult,
      projectType: form.projectType,
      projectStage: form.projectStage,
      numberOfFloors: Number(form.numberOfFloors) || 0,
      numberOfBathrooms: Number(form.numberOfBathrooms) || 0,
      estimatedTileDate: form.estimatedTileDate,
      estimatedBathroomInstallDate: form.estimatedBathroomInstallDate,
      budgetMin: Number(form.budgetMin) || 0,
      budgetMax: Number(form.budgetMax) || 0,
      value: Number(form.value) || 0,
      itemCount: Number(form.itemCount) || 0,
      mainConcern: form.mainConcern,
      objection: form.objection,
      decisionMaker: form.decisionMaker,
      competitor: form.competitor,
      expectedCloseDate: form.expectedCloseDate,
      notes: form.notes,
    });
  }

  return (
    <div className="modal-overlay">
      <div className="simple-modal customer-modal">
        <div className="modal-title">
          <h2>{mode === "edit" ? "Sửa hồ sơ khách hàng" : "Thêm khách hàng mới"}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={submit} className="modal-grid-flow">
          <div className="form-section-title"><span>01</span><strong>Thông tin tối thiểu</strong></div>
          <div className="form-grid-2">
            <input placeholder="Họ tên khách hàng *" required value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            <input placeholder="Số điện thoại *" required value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <select value={form.source} onChange={(e) => set("source", e.target.value)}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder="Khu vực (VD: Đông Anh)" value={form.ward} onChange={(e) => set("ward", e.target.value)} />
            <select value={form.owner} onChange={(e) => set("owner", e.target.value)}>
              {TEAM_MEMBERS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_EMOJI[p]} {PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
          <input placeholder="Nhu cầu (VD: Gạch + 2 WC)" value={form.need} onChange={(e) => set("need", e.target.value)} />

          <div className="form-section-title"><span>02</span><strong>Nhu cầu sản phẩm</strong></div>
          <div className="chip-multi">
            {INTERESTED_PRODUCTS.map((name) => (
              <button type="button" key={name} className={products.includes(name) ? "active" : ""} onClick={() => toggleProduct(name)}>{name}</button>
            ))}
          </div>

          {mode === "edit" && (
            <>
              <div className="form-section-title"><span>03</span><strong>Liên hệ & nguồn</strong></div>
              <div className="form-grid-2">
                <input placeholder="Zalo" value={form.zalo} onChange={(e) => set("zalo", e.target.value)} />
                <input placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                <input placeholder="Địa chỉ công trình" value={form.address} onChange={(e) => set("address", e.target.value)} />
                <input placeholder="Chiến dịch / nội dung nguồn" value={form.campaign} onChange={(e) => set("campaign", e.target.value)} />
                <select value={form.funnelStage} onChange={(e) => set("funnelStage", e.target.value)}>
                  {FUNNEL_STAGES.filter((s) => s !== "lost").map((s) => <option key={s} value={s}>{FUNNEL_STAGE_LABEL[s]}</option>)}
                </select>
              </div>

              <div className="form-section-title"><span>04</span><strong>Công trình</strong></div>
              <div className="form-grid-2">
                <select value={form.projectType} onChange={(e) => set("projectType", e.target.value)}>
                  <option value="">Loại công trình…</option>
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{PROJECT_TYPE_LABEL[t]}</option>)}
                </select>
                <select value={form.projectStage} onChange={(e) => set("projectStage", e.target.value)}>
                  <option value="">Giai đoạn thi công…</option>
                  {PROJECT_STAGES.map((s) => <option key={s} value={s}>{PROJECT_STAGE_LABEL[s]}</option>)}
                </select>
                <label className="fld">Số tầng<input type="number" min={0} value={form.numberOfFloors} onChange={(e) => set("numberOfFloors", e.target.value)} /></label>
                <label className="fld">Số WC<input type="number" min={0} value={form.numberOfBathrooms} onChange={(e) => set("numberOfBathrooms", e.target.value)} /></label>
                <label className="fld">Ngày lát gạch dự kiến<input type="date" value={form.estimatedTileDate} onChange={(e) => set("estimatedTileDate", e.target.value)} /></label>
                <label className="fld">Ngày lắp TBVS dự kiến<input type="date" value={form.estimatedBathroomInstallDate} onChange={(e) => set("estimatedBathroomInstallDate", e.target.value)} /></label>
              </div>

              <div className="form-section-title"><span>05</span><strong>Cơ hội & ngân sách</strong></div>
              <div className="form-grid-2">
                <label className="fld">Ngân sách từ (đ)<input type="number" min={0} value={form.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} /></label>
                <label className="fld">Ngân sách đến (đ)<input type="number" min={0} value={form.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} /></label>
                <label className="fld">Giá trị cơ hội (đ)<input type="number" min={0} value={form.value} onChange={(e) => set("value", e.target.value)} /></label>
                <label className="fld">Số món<input type="number" min={0} value={form.itemCount} onChange={(e) => set("itemCount", e.target.value)} /></label>
                <label className="fld">Ngày chốt dự kiến<input type="date" value={form.expectedCloseDate} onChange={(e) => set("expectedCloseDate", e.target.value)} /></label>
                <select value={form.objection} onChange={(e) => set("objection", e.target.value)}>
                  <option value="">Phản đối chính…</option>
                  {OBJECTIONS.map((o) => <option key={o} value={o}>{OBJECTION_LABEL[o]}</option>)}
                </select>
                <input placeholder="Người quyết định" value={form.decisionMaker} onChange={(e) => set("decisionMaker", e.target.value)} />
                <input placeholder="Đối thủ đang cạnh tranh" value={form.competitor} onChange={(e) => set("competitor", e.target.value)} />
              </div>
              <input placeholder="Băn khoăn lớn nhất của khách" value={form.mainConcern} onChange={(e) => set("mainConcern", e.target.value)} />
              <textarea placeholder="Ghi chú" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="outline-button" onClick={onClose}>Huỷ</button>
            <button type="submit" className="save-button" disabled={saving}>{saving ? "Đang lưu..." : "Lưu khách hàng"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function initForm(customer: Customer | null | undefined, person: string) {
  return {
    fullName: customer?.fullName ?? "",
    phone: customer?.phone ?? "",
    zalo: customer?.zalo ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    ward: customer?.ward ?? "",
    source: customer?.source ?? "Facebook",
    campaign: customer?.campaign ?? "",
    funnelStage: customer?.funnelStage ?? "lead",
    priority: customer?.priority ?? "warm",
    need: customer?.need ?? "",
    projectType: customer?.projectType ?? "",
    projectStage: customer?.projectStage ?? "",
    numberOfFloors: String(customer?.numberOfFloors ?? 0),
    numberOfBathrooms: String(customer?.numberOfBathrooms ?? 0),
    estimatedTileDate: customer?.estimatedTileDate?.slice(0, 10) ?? "",
    estimatedBathroomInstallDate: customer?.estimatedBathroomInstallDate?.slice(0, 10) ?? "",
    budgetMin: String(customer?.budgetMin ?? 0),
    budgetMax: String(customer?.budgetMax ?? 0),
    value: String(customer?.value ?? 0),
    itemCount: String(customer?.itemCount ?? 0),
    mainConcern: customer?.mainConcern ?? "",
    objection: customer?.objection ?? "",
    decisionMaker: customer?.decisionMaker ?? "",
    competitor: customer?.competitor ?? "",
    expectedCloseDate: customer?.expectedCloseDate?.slice(0, 10) ?? "",
    notes: customer?.notes ?? "",
    owner: customer?.owner ?? person,
  };
}
