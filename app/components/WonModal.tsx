"use client";

import { useEffect, useState } from "react";
import type { Customer } from "../../lib/types";
import { money, todayISO } from "../../lib/format";

export type WonPayload = {
  value: number;
  closedDate: string;
  itemCount: number;
  note: string;
};

type Props = {
  open: boolean;
  customer: Customer | null;
  onSubmit: (payload: WonPayload) => void;
  onClose: () => void;
};

// Modal BẮT BUỘC khi chốt đơn — thu giá trị đơn hàng để doanh thu chốt luôn chính xác.
export default function WonModal({ open, customer, onSubmit, onClose }: Props) {
  const [value, setValue] = useState("");
  const [closedDate, setClosedDate] = useState(todayISO());
  const [itemCount, setItemCount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(customer?.value ? String(customer.value) : "");
    setClosedDate(customer?.closedDate?.slice(0, 10) || todayISO());
    setItemCount(customer?.itemCount ? String(customer.itemCount) : "");
    setNote("");
    setError("");
  }, [open, customer]);

  if (!open) return null;

  function submit() {
    const v = Number(value) || 0;
    if (v <= 0) { setError("Nhập giá trị đơn hàng (lớn hơn 0) trước khi chốt."); return; }
    onSubmit({ value: v, closedDate, itemCount: Number(itemCount) || 0, note: note.trim() });
  }

  return (
    <div className="modal-overlay">
      <div className="simple-modal na-modal">
        <div className="modal-title">
          <div>
            <h2>Chốt đơn 🎉</h2>
            {customer ? <span style={{ fontSize: 12, color: "var(--muted)" }}>Khách: {customer.fullName}</span> : null}
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <label className="na-label">Giá trị đơn hàng (bắt buộc)</label>
        <input type="number" min={0} value={value} onChange={(e) => { setValue(e.target.value); setError(""); }} placeholder="VD: 86500000" autoFocus />
        {value && Number(value) > 0 ? <div style={{ fontSize: 12, color: "var(--teal)", marginTop: 4 }}>{money(Number(value))}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <label className="na-label" style={{ margin: 0 }}>Ngày chốt
            <input type="date" value={closedDate} onChange={(e) => setClosedDate(e.target.value)} />
          </label>
          <label className="na-label" style={{ margin: 0 }}>Số món (tuỳ chọn)
            <input type="number" min={0} value={itemCount} onChange={(e) => setItemCount(e.target.value)} placeholder="VD: 12" />
          </label>
        </div>

        <label className="na-label">Ghi chú / đặt cọc (tuỳ chọn)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: đã cọc 30%, giao đợt 1 tuần sau" />

        {error ? <div className="warn-banner" style={{ marginTop: 10 }}>{error}</div> : null}

        <div className="modal-actions">
          <button type="button" className="outline-button" onClick={onClose}>Huỷ</button>
          <button type="button" className="save-button" onClick={submit}>Xác nhận chốt đơn</button>
        </div>
      </div>
    </div>
  );
}
