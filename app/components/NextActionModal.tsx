"use client";

import { useEffect, useState } from "react";
import { ACTION_TYPES } from "../../db/enums";
import { ACTION_TYPE_LABEL } from "../../lib/labels";
import { addDays, todayISO } from "../../lib/format";

// 6 loại việc hay dùng nhất hiện sẵn; các loại còn lại nằm trong "Việc khác…".
const COMMON_TYPES = ["goi_khach", "nhan_zalo", "gui_bao_gia", "follow_bao_gia", "moi_showroom", "khao_sat_cong_trinh"];
const QUICK_DAYS = [
  { label: "Hôm nay", days: 0 },
  { label: "Ngày mai", days: 1 },
  { label: "3 ngày nữa", days: 3 },
  { label: "1 tuần nữa", days: 7 },
];

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
  const [showAllTypes, setShowAllTypes] = useState(false);

  useEffect(() => {
    if (!open) return;
    const type = initial?.actionType || "goi_khach";
    setActionType(type);
    setDetail(initial?.nextAction || ACTION_TYPE_LABEL[type]);
    setDate(initial?.nextContactDate || todayISO());
    setTime(initial?.nextActionTime || "09:00");
    setTouchedDetail(false);
    setShowAllTypes(!COMMON_TYPES.includes(type));
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

        <label className="na-label">1. Làm gì?</label>
        <div className="na-grid">
          {(showAllTypes ? ACTION_TYPES : COMMON_TYPES).map((type) => (
            <button
              key={type}
              type="button"
              className={actionType === type ? "active" : ""}
              onClick={() => chooseType(type)}
            >
              {ACTION_TYPE_LABEL[type]}
            </button>
          ))}
          {!showAllTypes ? (
            <button type="button" className="na-more" onClick={() => setShowAllTypes(true)}>Việc khác…</button>
          ) : null}
        </div>

        <label className="na-label">Ghi rõ (không bắt buộc)</label>
        <input
          value={detail}
          onChange={(event) => { setDetail(event.target.value); setTouchedDetail(true); }}
          placeholder="VD: Gửi 3 mẫu gạch tone kem qua Zalo"
        />

        <label className="na-label">2. Khi nào?</label>
        <div className="na-quick-days">
          {QUICK_DAYS.map((q) => {
            const value = addDays(todayISO(), q.days);
            return (
              <button key={q.label} type="button" className={date === value ? "active" : ""} onClick={() => setDate(value)}>{q.label}</button>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
          <label className="na-label" style={{ margin: 0 }}>Hoặc chọn ngày
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="na-label" style={{ margin: 0 }}>Giờ
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>

        <div className="modal-actions">
          {onSkip ? (
            <button type="button" className="outline-button" onClick={onSkip}>Không cần việc tiếp — bỏ qua</button>
          ) : (
            <button type="button" className="outline-button" onClick={onClose}>Huỷ</button>
          )}
          <button type="button" className="save-button" onClick={submit}>Lưu việc tiếp theo</button>
        </div>
      </div>
    </div>
  );
}
