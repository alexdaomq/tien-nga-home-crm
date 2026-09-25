"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Supplier = {
  id: number;
  supplierCode: string;
  sequenceNo: string;
  category: string;
  displayName: string;
  mainProducts: string;
  primaryContact: string;
  phoneZalo: string;
  backupContact: string;
  zaloGroup: string;
  warehouseAddress: string;
  orderingMethod: string;
  deliveryLeadTime: string;
  salesFrequency: string;
  paymentTerms: string;
  personality: string;
  negotiation: string;
  warrantyContact: string;
  tienNgaOwner: string;
  status: string;
  notes: string;
  lastUpdated: string;
};

type SupplierField = Exclude<keyof Supplier, "id" | "supplierCode">;

const emptySupplier: Supplier = {
  id: 0,
  supplierCode: "",
  sequenceNo: "",
  category: "",
  displayName: "",
  mainProducts: "",
  primaryContact: "",
  phoneZalo: "",
  backupContact: "",
  zaloGroup: "",
  warehouseAddress: "",
  orderingMethod: "",
  deliveryLeadTime: "",
  salesFrequency: "",
  paymentTerms: "",
  personality: "",
  negotiation: "",
  warrantyContact: "",
  tienNgaOwner: "",
  status: "",
  notes: "",
  lastUpdated: "",
};

const columns: Array<{ field: SupplierField; label: string; width: number }> = [
  { field: "sequenceNo", label: "STT", width: 62 },
  { field: "category", label: "Ngành hàng", width: 150 },
  { field: "displayName", label: "Tên nhà cung cấp", width: 220 },
  { field: "mainProducts", label: "Mặt hàng chủ lực", width: 210 },
  { field: "primaryContact", label: "Người phụ trách chính", width: 170 },
  { field: "phoneZalo", label: "SĐT / Zalo", width: 145 },
  { field: "backupContact", label: "Người dự phòng + SĐT", width: 190 },
  { field: "zaloGroup", label: "Nhóm Zalo", width: 170 },
  { field: "warehouseAddress", label: "Địa chỉ kho lấy hàng", width: 220 },
  { field: "orderingMethod", label: "Cách đặt hàng & giờ chốt đơn", width: 230 },
  { field: "deliveryLeadTime", label: "Leadtime giao hàng", width: 200 },
  { field: "salesFrequency", label: "Tần suất bán hàng", width: 180 },
  { field: "paymentTerms", label: "Công nợ", width: 150 },
  { field: "personality", label: "Tính cách", width: 160 },
  { field: "negotiation", label: "Mặc cả", width: 180 },
  { field: "warrantyContact", label: "Bảo hành - hàng lỗi gọi ai", width: 220 },
  { field: "tienNgaOwner", label: "Người Tiến Nga phụ trách", width: 180 },
  { field: "status", label: "Trạng thái", width: 150 },
  { field: "notes", label: "Ghi chú - lưu ý riêng", width: 220 },
  { field: "lastUpdated", label: "Cập nhật lần cuối", width: 150 },
];

const sections: Array<{
  title: string;
  fields: Array<{ field: SupplierField; label: string; type?: "textarea" | "select"; options?: string[]; wide?: boolean }>;
}> = [
  {
    title: "Nhận diện",
    fields: [
      { field: "sequenceNo", label: "STT" },
      { field: "category", label: "Ngành hàng" },
      { field: "displayName", label: "Tên nhà cung cấp", wide: true },
      { field: "mainProducts", label: "Mặt hàng chủ lực", wide: true },
    ],
  },
  {
    title: "Liên hệ",
    fields: [
      { field: "primaryContact", label: "Người phụ trách chính" },
      { field: "phoneZalo", label: "SĐT / Zalo" },
      { field: "backupContact", label: "Người dự phòng + SĐT" },
      { field: "zaloGroup", label: "Nhóm Zalo" },
    ],
  },
  {
    title: "Vận hành hàng ngày",
    fields: [
      { field: "warehouseAddress", label: "Địa chỉ kho lấy hàng", wide: true },
      { field: "orderingMethod", label: "Cách đặt hàng & giờ chốt đơn", type: "textarea", wide: true },
      { field: "deliveryLeadTime", label: "Leadtime giao hàng", type: "textarea" },
      { field: "salesFrequency", label: "Tần suất bán hàng", type: "select", options: ["", "Rất thường xuyên (hàng tuần)", "Thường xuyên (hàng tháng)", "Thỉnh thoảng (hàng quý)", "Hiếm khi"] },
    ],
  },
  {
    title: "Tiền & quan hệ",
    fields: [
      { field: "paymentTerms", label: "Công nợ", type: "select", options: ["", "Thanh toán ngay", "Cuối tháng", "Công nợ 30 ngày", "Gối đầu đơn sau"] },
      { field: "personality", label: "Tính cách", type: "select", options: ["", "Dễ tính", "Bình thường", "Khó tính, chặt chẽ giấy tờ"] },
      { field: "negotiation", label: "Mặc cả", type: "select", options: ["", "Có, khá thoải mái", "Có, nhưng phải khéo", "Giá cứng, không mặc cả"] },
      { field: "warrantyContact", label: "Bảo hành - hàng lỗi gọi ai" },
    ],
  },
  {
    title: "Quản lý",
    fields: [
      { field: "tienNgaOwner", label: "Người Tiến Nga phụ trách", type: "select", options: ["", "Giám đốc", "Cần", "Liên nhỏ", "Liên lớn", "Dương"] },
      { field: "status", label: "Trạng thái", type: "select", options: ["", "Đang lấy hàng", "Tạm dừng", "Đã dừng"] },
      { field: "lastUpdated", label: "Cập nhật lần cuối", wide: true },
      { field: "notes", label: "Ghi chú - lưu ý riêng", type: "textarea", wide: true },
    ],
  },
];

export default function SupplierDirectory({ person, createSignal }: { person: string; createSignal: number }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả ngành hàng");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/suppliers")
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("Không thể tải danh bạ nhà cung cấp")))
      .then((data: { suppliers?: Supplier[] }) => setSuppliers(data.suppliers ?? []))
      .catch((error: Error) => setToast(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!createSignal) return;
    setEditing({ ...emptySupplier });
  }, [createSignal]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const categories = useMemo(() => ["Tất cả ngành hàng", ...Array.from(new Set(suppliers.map((item) => item.category).filter(Boolean)))], [suppliers]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("vi");
    return suppliers.filter((supplier) => {
      if (category !== "Tất cả ngành hàng" && supplier.category !== category) return false;
      return !term || columns.some(({ field }) => String(supplier[field] ?? "").toLocaleLowerCase("vi").includes(term));
    });
  }, [category, search, suppliers]);

  function update(field: SupplierField, value: string) {
    setEditing((current) => current ? { ...current, [field]: value } : current);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const response = await fetch("/api/suppliers", {
        method: editing.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing, updatedBy: person }),
      });
      const data = await response.json() as { supplier?: Supplier; error?: string };
      if (!response.ok || !data.supplier) throw new Error(data.error || "Không thể lưu nhà cung cấp");
      setSuppliers((current) => editing.id
        ? current.map((item) => item.id === data.supplier!.id ? data.supplier! : item)
        : [...current, data.supplier!]);
      setEditing(null);
      setToast(editing.id ? "Đã cập nhật nhà cung cấp" : "Đã thêm nhà cung cấp mới");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể lưu nhà cung cấp");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Supplier) {
    if (!window.confirm(`Xóa nhà cung cấp ${item.displayName}?`)) return;
    setSaving(true);
    try {
      const response = await fetch("/api/suppliers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể xóa nhà cung cấp");
      setSuppliers((current) => current.filter((supplier) => supplier.id !== item.id));
      setToast(`Đã xóa ${item.displayName}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể xóa nhà cung cấp");
    } finally {
      setSaving(false);
    }
  }

  const gridTemplate = `${columns.map((column) => `${column.width}px`).join(" ")} 136px`;

  return <>
    <section className="welcome-row supplier-welcome">
      <div><p>DANH BẠ NHÀ CUNG CẤP</p><h1>Nhà cung cấp</h1><span>Dữ liệu được nhập đúng theo file Danh_ba_Nha_cung_cap_Tien_Nga.</span></div>
      <button className="mobile-add" onClick={() => setEditing({ ...emptySupplier })}>＋ Thêm nhà cung cấp</button>
    </section>
    <section className="supplier-toolbar">
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, số điện thoại, mặt hàng..." aria-label="Tìm nhà cung cấp" />
      <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Lọc ngành hàng">{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <button onClick={() => setEditing({ ...emptySupplier })}>＋ Thêm nhà cung cấp</button>
    </section>
    <section className="supplier-sheet-card">
      <header><div><h2>Danh bạ nhà cung cấp</h2><span>{filtered.length} nhà cung cấp</span></div><small>Kéo ngang để xem đủ 20 trường thông tin</small></header>
      <div className="supplier-sheet-scroll">
        <div className="supplier-sheet-head" style={{ gridTemplateColumns: gridTemplate }}>{columns.map((column) => <span key={column.field}>{column.label}</span>)}<span>Thao tác</span></div>
        {filtered.map((item) => <article className="supplier-sheet-row" style={{ gridTemplateColumns: gridTemplate }} key={item.id}>
          {columns.map((column) => <div className={`supplier-sheet-cell ${column.field === "displayName" ? "supplier-name-cell" : ""}`} key={column.field}>
            {column.field === "status" && item.status
              ? <em className={`supplier-status ${item.status === "Đang lấy hàng" ? "active" : ""}`}>{item.status}</em>
              : <strong>{item[column.field] || "—"}</strong>}
          </div>)}
          <span className="supplier-actions"><button onClick={() => setEditing({ ...item })}>Sửa</button><button className="delete" disabled={saving} onClick={() => remove(item)}>Xóa</button></span>
        </article>)}
        {loading && <div className="supplier-empty"><strong>Đang tải danh bạ...</strong></div>}
        {!loading && filtered.length === 0 && <div className="supplier-empty"><strong>Không có nhà cung cấp phù hợp</strong><button onClick={() => setEditing({ ...emptySupplier })}>＋ Thêm nhà cung cấp</button></div>}
      </div>
    </section>
    {editing && <div className="supplier-overlay" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(null); }}>
      <form className="supplier-drawer" onSubmit={save}>
        <button className="supplier-close" type="button" onClick={() => setEditing(null)} aria-label="Đóng">×</button>
        <header><p>{editing.id ? "SỬA NHÀ CUNG CẤP" : "THÊM NHÀ CUNG CẤP"}</p><h2>{editing.displayName || "Nhà cung cấp mới"}</h2><span>Người nhập: {person}</span></header>
        <div className="supplier-form-detailed">{sections.map((section, sectionIndex) => <section className="supplier-form-section" key={section.title}>
          <h3><span>{String(sectionIndex + 1).padStart(2, "0")}</span>{section.title}</h3>
          <div>{section.fields.map((field) => <label className={field.wide ? "wide" : ""} key={field.field}>{field.label}
            {field.type === "textarea"
              ? <textarea rows={3} value={editing[field.field]} onChange={(event) => update(field.field, event.target.value)} />
              : field.type === "select"
                ? <select value={editing[field.field]} onChange={(event) => update(field.field, event.target.value)}>{field.options?.map((option) => <option key={option} value={option}>{option || "Chưa chọn"}</option>)}</select>
                : <input required={field.field === "displayName"} value={editing[field.field]} onChange={(event) => update(field.field, event.target.value)} />}
          </label>)}</div>
        </section>)}</div>
        <footer><button type="button" onClick={() => setEditing(null)}>Hủy</button><button className="add-button" disabled={saving}>{saving ? "Đang lưu..." : "Lưu nhà cung cấp"}</button></footer>
      </form>
    </div>}
    {toast && <div className="supplier-toast"><span>✓</span>{toast}</div>}
  </>;
}
