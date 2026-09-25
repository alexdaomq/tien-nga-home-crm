"use client";

import { useEffect, useState } from "react";
import { LOSS_REASONS } from "../../db/enums";
import { LOSS_REASON_LABEL } from "../../lib/labels";

export type LostPayload = {
  lossReason: string;
  lostNote: string;
  lostCompetitor: string;
};

type Props = {
  open: boolean;
  customerName?: string;
  onSubmit: (payload: LostPayload) => void;
  onClose: () => void;
};

// Modal BẮT BUỘC "Tại sao khách hàng không mua?" — không cho chuyển Mất khách nếu chưa chọn lý do.
export default function LostReasonModal({ open, customerName, onSubmit, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setNote("");
    setCompetitor("");
    setError("");
  }, [open]);

  if (!open) return null;

  function submit() {
    if (!reason) { setError("Vui lòng chọn 1 lý do trước khi đánh dấu mất khách."); return; }
    onSubmit({ lossReason: reason, lostNote: note.trim(), lostCompetitor: competitor.trim() });
  }

  return (
    <div className="modal-overlay">
      <div className="simple-modal na-modal">
        <div className="modal-title">
          <div>
            <h2>Tại sao khách hàng không mua?</h2>
            {customerName ? <span style={{ fontSize: 12, color: "var(--muted)" }}>Khách: {customerName}</span> : null}
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <label className="na-label">Chọn lý do (bắt buộc)</label>
        <div className="na-grid">
          {LOSS_REASONS.map((value) => (
            <button
              key={value}
              type="button"
              className={reason === value ? "active danger" : ""}
              onClick={() => { setReason(value); setError(""); }}
            >
              {LOSS_REASON_LABEL[value]}
            </button>
          ))}
        </div>

        <label className="na-label">Đối thủ (nếu mua nơi khác)</label>
        <input value={competitor} onChange={(event) => setCompetitor(event.target.value)} placeholder="VD: Đại lý Viglacera gần nhà" />

        <label className="na-label">Ghi chú thêm</label>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Chi tiết vì sao mất khách..." />

        {error ? <div className="warn-banner" style={{ marginTop: 10 }}>{error}</div> : null}

        <div className="modal-actions">
          <button type="button" className="outline-button" onClick={onClose}>Huỷ</button>
          <button type="button" className="save-button danger-button" onClick={submit}>Đánh dấu mất khách</button>
        </div>
      </div>
    </div>
  );
}
