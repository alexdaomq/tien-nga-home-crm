"use client";

import { FormEvent, useEffect, useState } from "react";
import type { MetricsResponse } from "../../lib/types";
import { TEAM_MEMBERS } from "../../lib/types";
import { money, formatDate, todayISO } from "../../lib/format";
import { LOSS_REASON_LABEL } from "../../lib/labels";
import { deriveCalendarToken } from "../../lib/calendar-feed";

const CALENDAR_PEOPLE = ["all", ...TEAM_MEMBERS] as const;
const CALENDAR_PEOPLE_LABEL: Record<string, string> = { all: "Toàn đội (Tuấn xem hết)" };

export default function MetricsView({
  metrics,
  person,
  onToast,
  onRefresh,
}: {
  metrics: MetricsResponse | null;
  person: string;
  onToast: (message: string) => void;
  onRefresh: () => Promise<void> | void;
}) {
  const [adSpend, setAdSpend] = useState("");
  const [date, setDate] = useState(todayISO());
  const [marginRate, setMarginRate] = useState(metrics?.marginRate ?? 25);
  const [saving, setSaving] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookEndpoint, setWebhookEndpoint] = useState("/api/customers/webhook");
  const [showSecret, setShowSecret] = useState(false);
  const [calendarLinks, setCalendarLinks] = useState<Record<string, string>>({});

  async function buildCalendarLinks(secret: string) {
    if (!secret) { setCalendarLinks({}); return; }
    const entries = await Promise.all(CALENDAR_PEOPLE.map(async (name) => {
      const token = await deriveCalendarToken(name, secret);
      return [name, `webcal://${window.location.host}/api/calendar?person=${encodeURIComponent(name)}&token=${token}`] as const;
    }));
    setCalendarLinks(Object.fromEntries(entries));
  }

  useEffect(() => {
    setWebhookEndpoint(`${window.location.origin}/api/customers/webhook`);
    fetch("/api/settings").then((res) => res.json()).then((data) => {
      setWebhookSecret(data.settings?.webhookSecret ?? "");
      buildCalendarLinks(data.settings?.calendarSecret ?? "");
    });
  }, []);

  async function regenerateSecret() {
    if (!window.confirm("Tạo khoá mới sẽ làm khoá cũ ngừng hoạt động — luồng n8n/AI đang dùng khoá cũ sẽ phải cập nhật lại. Tiếp tục?")) return;
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regenerateWebhookSecret: true }) });
    const data = await res.json();
    if (!res.ok) { onToast("Không tạo được khoá mới."); return; }
    setWebhookSecret(data.settings.webhookSecret);
    setShowSecret(true);
    onToast("Đã tạo khoá bí mật mới");
  }

  async function regenerateCalendarSecret() {
    if (!window.confirm("Tạo khoá lịch mới sẽ làm TẤT CẢ link lịch cũ ngừng đồng bộ — mọi người phải xoá lịch cũ trên điện thoại và đăng ký lại link mới. Tiếp tục?")) return;
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regenerateCalendarSecret: true }) });
    const data = await res.json();
    if (!res.ok) { onToast("Không tạo được khoá lịch mới."); return; }
    await buildCalendarLinks(data.settings.calendarSecret);
    onToast("Đã tạo khoá lịch mới — cần đăng ký lại link trên từng điện thoại");
  }

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      onToast(`Đã sao chép ${label}`);
    } catch {
      onToast("Không sao chép được — hãy tự bôi đen và copy.");
    }
  }

  async function submitDailySpend(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const res = await fetch("/api/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, adSpend: Number(adSpend) || 0, enteredBy: person }) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { onToast(data.error ?? "Không lưu được chi phí quảng cáo."); return; }
    setAdSpend("");
    onToast(`Đã ghi nhận chi ads ngày ${formatDate(date)}`);
    await onRefresh();
  }

  async function saveMarginRate() {
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marginRate }) });
    if (!res.ok) { onToast("Không lưu được biên lợi nhuận."); return; }
    onToast("Đã cập nhật biên lợi nhuận dùng để tính CPL trần");
    await onRefresh();
  }

  const funnel = metrics?.funnel;
  const crossSell = metrics?.crossSell;

  return (
    <div className="simple-page">
      <section className="welcome-row">
        <div><p>CHỈ SỐ VẬN HÀNH</p><h1>Nhập chi ads & 8 chỉ số phễu B2C</h1><span>Chỉ chi ads cần nhập tay mỗi ngày — các chỉ số còn lại tính thẳng từ dữ liệu khách hàng của tháng {metrics?.month ?? ""}.</span></div>
      </section>

      <div className="dashboard-grid">
        <div className="map-card">
          <div className="dashboard-card-title"><strong>Ghi nhận chi phí quảng cáo (Tab NGÀY)</strong></div>
          <form onSubmit={submitDailySpend} style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 10, padding: 16, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Ngày
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Chi ads trong ngày (đ)
              <input type="number" min={0} value={adSpend} onChange={(event) => setAdSpend(event.target.value)} placeholder="VD: 220000" required />
            </label>
            <button type="submit" className="save-button" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
          </form>
          <div className="hub-table-scroll" style={{ maxHeight: 260, overflowY: "auto" }}>
            {(metrics?.dailyMetrics ?? []).length === 0 ? (
              <div className="empty-state"><strong>Chưa có dữ liệu chi ads nào được nhập.</strong></div>
            ) : (metrics?.dailyMetrics ?? []).map((row) => (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 8, padding: "8px 16px", borderBottom: "1px solid #eef2f0", fontSize: 12 }}>
                <strong>{formatDate(row.date)}</strong><span>{money(row.adSpend)}</span><span style={{ color: "#647572" }}>{row.enteredBy}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="map-card">
          <div className="dashboard-card-title"><strong>Biên lợi nhuận dùng để tính CPL trần</strong></div>
          <div style={{ padding: 16, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Biên lợi nhuận trung bình (%)
              <input type="number" min={1} max={90} value={marginRate} onChange={(event) => setMarginRate(Number(event.target.value) || 0)} />
            </label>
            <button className="outline-button" onClick={saveMarginRate}>Lưu biên lợi nhuận</button>
            <p style={{ fontSize: 11, color: "#647572" }}>CPL trần = AOV × biên lợi nhuận × (%chốt × %đến × %liên hệ) — mức tối đa được phép trả cho một lead hợp lệ mà vẫn hoà vốn.</p>
          </div>
        </div>
      </div>

      <div className="map-card" style={{ marginTop: 18 }}>
        <div className="dashboard-card-title"><strong>Tích hợp AI tự động (Business Suite / n8n)</strong></div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <p style={{ fontSize: 12, color: "#647572", margin: 0 }}>
            Khi AI đọc hội thoại Messenger/Instagram trong Business Suite và trích được đủ họ tên + SĐT (kèm địa chỉ nếu có), n8n gọi endpoint dưới đây để tự ghi vào CRM.
            Khách mới sẽ vào thẳng cột &quot;Lead mới&quot;, người phụ trách để &quot;Chưa phân công&quot; — sale vẫn phải xác nhận lại, AI không tự đẩy khách vào phễu.
          </p>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Endpoint (POST)
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={webhookEndpoint} style={{ flex: 1, fontFamily: "monospace", fontSize: 11 }} />
              <button type="button" className="outline-button" style={{ width: "auto", flex: "0 0 auto" }} onClick={() => copyToClipboard(webhookEndpoint, "endpoint")}>Sao chép</button>
            </div>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Khoá bí mật (header <code>x-webhook-secret</code>)
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly type={showSecret ? "text" : "password"} value={webhookSecret} style={{ flex: 1, fontFamily: "monospace", fontSize: 11 }} />
              <button type="button" className="outline-button" style={{ width: "auto", flex: "0 0 auto" }} onClick={() => setShowSecret((v) => !v)}>{showSecret ? "Ẩn" : "Hiện"}</button>
              <button type="button" className="outline-button" style={{ width: "auto", flex: "0 0 auto" }} onClick={() => copyToClipboard(webhookSecret, "khoá bí mật")}>Sao chép</button>
            </div>
          </label>
          <div>
            <button type="button" className="outline-button" onClick={regenerateSecret}>Tạo khoá mới</button>
          </div>
          <details style={{ fontSize: 11, color: "#647572" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, color: "#41625b" }}>Body mẫu để n8n gửi lên</summary>
            <pre style={{ background: "#f2f7f4", padding: 10, borderRadius: 8, overflowX: "auto", marginTop: 8 }}>
{`POST ${webhookEndpoint}
Header: x-webhook-secret: <khoá bí mật ở trên>
Body JSON:
{
  "fullName": "Nguyễn Văn A",
  "phone": "0987xxxxxx",
  "address": "Số 1, KĐT Hà Phong, Mê Linh",
  "source": "Facebook",
  "channel": "messenger",
  "note": "Khách hỏi combo phòng tắm WC1",
  "conversationUrl": "https://business.facebook.com/..."
}`}
            </pre>
          </details>
        </div>
      </div>

      <div className="map-card" style={{ marginTop: 18 }}>
        <div className="dashboard-card-title"><strong>Nhắc hẹn qua Lịch trên iPhone</strong></div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <p style={{ fontSize: 12, color: "#647572", margin: 0 }}>
            Mỗi người bấm đúng 1 lần vào link của mình trên iPhone (Safari) để đăng ký lịch — sau đó Việc cần làm/Lịch hẹn của người đó tự đồng bộ vào app Lịch,
            kèm nhắc giờ ngay trên điện thoại (trước 2 tiếng cho lịch hẹn showroom, trước 30 phút cho việc khác). Không cần cài thêm app, không cần Zalo/n8n.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {CALENDAR_PEOPLE.map((name) => (
              <div key={name} style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 8, alignItems: "center" }}>
                <strong style={{ fontSize: 12 }}>{CALENDAR_PEOPLE_LABEL[name] ?? name}</strong>
                <input readOnly value={calendarLinks[name] ?? "Đang tạo link..."} style={{ fontFamily: "monospace", fontSize: 10 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={calendarLinks[name]} className="outline-button" style={{ width: "auto", textDecoration: "none", textAlign: "center" }}>Mở trên điện thoại</a>
                  <button type="button" className="outline-button" style={{ width: "auto" }} onClick={() => copyToClipboard(calendarLinks[name] ?? "", `link lịch ${name}`)}>Sao chép</button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <button type="button" className="outline-button" onClick={regenerateCalendarSecret}>Tạo lại toàn bộ link lịch</button>
          </div>
          <details style={{ fontSize: 11, color: "#647572" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, color: "#41625b" }}>Cách đăng ký trên iPhone</summary>
            <ol style={{ paddingLeft: 18, marginTop: 8, display: "grid", gap: 4 }}>
              <li>Mở link đúng tên mình bằng Safari trên iPhone (bấm "Mở trên điện thoại" hoặc dán link đã sao chép vào Safari).</li>
              <li>iPhone tự hỏi "Thêm lịch đăng ký?" — bấm <strong>Đăng ký</strong> (Subscribe).</li>
              <li>Xong — mở app Lịch (Calendar) sẽ thấy các việc/lịch hẹn xuất hiện, có nhắc giờ tự động.</li>
              <li>Nếu không thấy hộp thoại tự bật: vào Cài đặt → Lịch → Tài khoản → Thêm tài khoản → Khác → Thêm lịch đăng ký, rồi dán link (đổi <code>webcal://</code> thành <code>https://</code>).</li>
            </ol>
          </details>
        </div>
      </div>

      {funnel && (
        <>
          <section className="dashboard-kpis" style={{ marginTop: 18 }}>
            <div className="kpi-card"><span>Lead thô / tháng</span><strong>{funnel.rawLeads}</strong></div>
            <div className="kpi-card"><span>CPL (thô)</span><strong>{money(funnel.cpl)}</strong></div>
            <div className="kpi-card"><span>CPL hợp lệ (trong vùng)</span><strong>{money(funnel.cplValid)}</strong></div>
            <div className="kpi-card"><span>CPL trần</span><strong>{money(funnel.cplCeiling)}</strong></div>
          </section>
          <section className="dashboard-kpis">
            <div className="kpi-card"><span>% lead trong vùng</span><strong>{funnel.pctInZone}%</strong></div>
            <div className="kpi-card"><span>Thời gian gọi lần 1 (trung vị)</span><strong>{funnel.medianFirstCallMinutes} phút</strong></div>
            <div className="kpi-card"><span>% liên hệ được</span><strong>{funnel.pctContacted}%</strong></div>
            <div className="kpi-card"><span>% đến showroom</span><strong>{funnel.pctArrived}%</strong></div>
          </section>
          <section className="dashboard-kpis">
            <div className="kpi-card"><span>% chốt trên khách đến</span><strong>{funnel.pctWon}%</strong></div>
            <div className="kpi-card"><span>AOV</span><strong>{money(funnel.aov)}</strong></div>
            <div className="kpi-card"><span>Số món / đơn</span><strong>{funnel.avgItemCount}</strong></div>
            <div className="kpi-card"><span>Tỷ lệ khách đến qua giới thiệu</span><strong>{funnel.referralRate}%</strong></div>
          </section>

          <div className="dashboard-lower">
            <div className="map-card">
              <div className="dashboard-card-title"><strong>Lý do mất khách trong tháng</strong></div>
              <div style={{ padding: 16, display: "grid", gap: 8 }}>
                {Object.keys(funnel.lossReasonBreakdown).length === 0 ? (
                  <span style={{ color: "#647572", fontSize: 12 }}>Chưa ghi nhận khách nào bị mất trong tháng này.</span>
                ) : Object.entries(funnel.lossReasonBreakdown).map(([reason, count]) => (
                  <div key={reason} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>{LOSS_REASON_LABEL[reason] ?? reason}</span><strong>{count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="map-card">
              <div className="dashboard-card-title"><strong>4 chỉ số bán chéo công trình</strong></div>
              <div style={{ padding: 16, display: "grid", gap: 8, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Số hạng mục / công trình</span><strong>{crossSell?.avgItemsPerProject ?? 0}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>% mua đơn thứ 2 trong 90 ngày</span><strong>{crossSell?.pctSecondPurchaseWithin90Days ?? 0}%</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Khoảng cách giữa 2 đơn (ngày)</span><strong>{crossSell?.avgGapDays ?? 0}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Giá trị vòng đời công trình (TB)</span><strong>{money(crossSell?.avgLifetimeValue ?? 0)}</strong></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
