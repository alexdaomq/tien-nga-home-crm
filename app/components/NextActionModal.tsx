"use client";

import { useEffect, useState } from "react";
import { ACTION_TYPES } from "../../db/enums";
import { ACTION_TYPE_LABEL } from "../../lib/labels";
import { todayISO } from "../../lib/format";

export type NextActionPayload = {
  actionType: string;
  nextAction: string;
  nextContactDate: string;
  nextActionTime: string;
};

type Props = {
  open: boolean;
  customerName?: string;
  heading?: string;
  initial?: Partial<NextActionPayload>;
  onSubmit: (payload: NextActionPayload) => void;
  onClose: () => void;
  onSkip?: () => void; // dùng khi hoàn thành việc — cho phép bỏ qua nếu khách đã đóng
};

// Modal BẮT BUỘC hỏi "Việc tiếp theo với khách hàng này là gì?" (theo brief).
// Một khách đang active không được để trống Next Action.
export default function NextActionModal({ open, customerName, heading, initial, onSubmit, onClose, onSkip }: Props) {
  const [actionType, setActionType] = useState<string>(initial?.actionType || "goi_khach");
  const [detail, setDetail] = useState<string>(initial?.nextAction || ACTION_TYPE_LABEL.goi_khach);
  const [date, setDate] = useState<string>(initial?.nextContactDate || todayISO());
  const [time, setTime] = useState<string>(initial?.nextActionTime || "09:00");
  const [touchedDetail, setTouchedDetail] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActionType(initial?.actionType || "goi_khach");
    setDetail(initial?.nextAction || ACTION_TYPE_LABEL[initial?.actionType || "goi_khach"]);
    setDate(initial?.nextContactDate || todayISO());
    setTime(initial?.nextActionTime || "09:00");
    setTouchedDetail(false);
  }, [open, initial]);

  if (!open) return null;

  function chooseType(type: string) {
    setActionType(type);
    // Nếu người dùng chưa tự sửa chi tiết, tự điền theo nhãn loại việc.
    if (!touchedDetail) setDetail(ACTION_TYPE_LABEL[type]);
  }

  function submit() {
    const text = detail.trim() || ACTION_TYPE_LABEL[actionType];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    onSubmit({ actionType, nextAction: text, nextContactDate: date, nextActionTime: time });
  }

  return (
    <div className="modal-overlay">
      <div className="simple-modal na-modal">
        <div className="modal-title">
          <div>
            <h2>{heading || "Việc tiếp theo là gì?"}</h2>
            {customerName ? <span style={{ fontSize: 12, color: "var(--muted)" }}>Khách: {customerName}</span> : null}
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <label className="na-label">Chọn loại việc</label>
        <div className="na-grid">
          {ACTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={actionType === type ? "active" : ""}
              onClick={() => chooseType(type)}
            >
              {ACTION_TYPE_LABEL[type]}
            </button>
          ))}
        </div>

        <label className="na-label">Chi tiết việc cần làm</label>
        <input
          value={detail}
          onChange={(event) => { setDetail(event.target.value); setTouchedDetail(true); }}
          placeholder="VD: Gửi 3 mẫu gạch tone kem qua Zalo"
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <label className="na-label" style={{ margin: 0 }}>Ngày
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="na-label" style={{ margin: 0 }}>Giờ
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>

        <div className="modal-actions">
          {onSkip ? (
            <button type="button" className="outline-button" onClick={onSkip}>Khách đã đóng — bỏ qua</button>
          ) : (
            <button type="button" className="outline-button" onClick={onClose}>Huỷ</button>
          )}
          <button type="button" className="save-button" onClick={submit}>Lưu việc tiếp theo</button>
        </div>
      </div>
    </div>
  );
}
