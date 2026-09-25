"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Customer, MetricsResponse } from "../../lib/types";
import { TEAM_MEMBERS } from "../../lib/types";
import { money, formatDate, todayISO } from "../../lib/format";
import { LOSS_REASON_LABEL, FUNNEL_STAGE_LABEL, FUNNEL_STAGE_COLOR } from "../../lib/labels";
import { PIPELINE_STAGES } from "../../db/enums";
import { deriveCalendarToken } from "../../lib/calendar-feed";

const CALENDAR_PEOPLE = ["all", ...TEAM_MEMBERS] as const;
const CALENDAR_PEOPLE_LABEL: Record<string, string> = { all: "Toàn đội (Tuấn xem hết)" };

const FB_PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Hôm nay" },
  { value: "yesterday", label: "Hôm qua" },
  { value: "last_7d", label: "7 ngày qua" },
  { value: "last_30d", label: "30 ngày qua" },
  { value: "this_month", label: "Tháng này" },
  { value: "last_month", label: "Tháng trước" },
];

type FbMetrics = {
  spend: number; impressions: number; reach: number; clicks: number;
  cpc: number; ctr: number; cpm: number; frequency: number;
  results: number; costPerResult: number;
};

const FB_ADS_MANAGER_URL = "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1378071637200779&business_id=1695978451198571";
const SOLD_STAGES = new Set(["won", "delivering", "aftercare"]);

// Màu cho tỷ lệ Ads/Doanh thu: càng thấp càng tốt.
function ratioColor(pct: number | null): string {
  if (pct === null) return "#8b8b8b";
  if (pct < 15) return "#08751d";
  if (pct < 30) return "#178d12";
  if (pct < 50) return "#f5a623";
  return "#e4542d";
}

function BarChart({ items, empty }: { items: { label: string; value: number; color: string; display: string }[]; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <div className="radar-empty">{empty}</div>;
  return (
    <div className="bar-chart">
      {items.map((item) => (
        <div key={item.label} className="bar-row">
          <div className="bar-label" title={item.label}>{item.label}</div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color }} /></div>
          <div className="bar-value">{item.display}</div>
        </div>
      ))}
    </div>
  );
}

export default function MetricsView({
  metrics,
  customers,
  person,
  onToast,
  onRefresh,
}: {
  metrics: MetricsResponse | null;
  customers: Customer[];
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

  const [fbAccountId, setFbAccountId] = useState("1378071637200779");
  const [fbHasToken, setFbHasToken] = useState(false);
  const [fbToken, setFbToken] = useState("");
  const [fbEditToken, setFbEditToken] = useState(false);
  const [fbPreset, setFbPreset] = useState("last_30d");
  const [fbMetrics, setFbMetrics] = useState<FbMetrics | null>(null);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState("");
  const [fbSaving, setFbSaving] = useState(false);

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
    fetch("/api/ads").then((res) => res.json()).then((data) => {
      if (data.adAccountId) setFbAccountId(String(data.adAccountId).replace(/^act_/, ""));
      setFbHasToken(Boolean(data.hasToken));
      if (data.hasToken) loadFbInsights("last_30d");
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFbInsights(preset: string) {
    setFbLoading(true);
    setFbError("");
    const res = await fetch(`/api/ads/insights?preset=${preset}`);
    const data = await res.json();
    setFbLoading(false);
    if (!res.ok) { setFbMetrics(null); setFbError(data.error ?? "Không tải được số liệu."); return; }
    setFbMetrics(data.metrics ?? null);
  }

  async function saveFbConfig() {
    setFbSaving(true);
    setFbError("");
    const body: Record<string, unknown> = { adAccountId: fbAccountId };
    if (fbToken.trim()) body.accessToken = fbToken.trim();
    const res = await fetch("/api/ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setFbSaving(false);
    if (!res.ok) { setFbError(data.error ?? "Không lưu được kết nối."); return; }
    setFbHasToken(Boolean(data.hasToken));
    setFbToken("");
    setFbEditToken(false);
    onToast("Đã lưu kết nối Facebook");
    if (data.hasToken) await loadFbInsights(fbPreset);
  }

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

  // ---- Tổng hợp tài chính từ dữ liệu khách ----
  const fin = useMemo(() => {
    const month = metrics?.month ?? "";
    const byStage = new Map<string, { count: number; value: number }>();
    const bySource = new Map<string, number>();
    let pipelineValue = 0, wonRevenue = 0, monthWonRevenue = 0;
    for (const c of customers) {
      const st = byStage.get(c.funnelStage) ?? { count: 0, value: 0 };
      st.count += 1; st.value += c.value; byStage.set(c.funnelStage, st);
      if (!["lost", "paused"].includes(c.funnelStage) && !SOLD_STAGES.has(c.funnelStage)) pipelineValue += c.value;
      if (SOLD_STAGES.has(c.funnelStage)) {
        wonRevenue += c.value;
        bySource.set(c.source, (bySource.get(c.source) ?? 0) + c.value);
        if (month && c.closedDate.slice(0, 7) === month) monthWonRevenue += c.value;
      }
    }
    const adSpend = funnel?.adSpend ?? 0;
    const revenueForRatio = monthWonRevenue || wonRevenue;
    const adsRatio = revenueForRatio > 0 ? (adSpend / revenueForRatio) * 100 : null;
    const roas = adSpend > 0 ? revenueForRatio / adSpend : null;
    return { byStage, bySource, pipelineValue, wonRevenue, monthWonRevenue, adSpend, adsRatio, roas, revenueForRatio };
  }, [customers, metrics, funnel]);

  const funnelBars = PIPELINE_STAGES.map((stage) => {
    const s = fin.byStage.get(stage) ?? { count: 0, value: 0 };
    return { label: FUNNEL_STAGE_LABEL[stage], value: s.count, color: FUNNEL_STAGE_COLOR[stage], display: `${s.count} · ${money(s.value)}` };
  }).filter((b) => b.value > 0);

  const sourceBars = [...fin.bySource.entries()].sort((a, b) => b[1] - a[1]).map(([source, value]) => ({ label: source, value, color: "#178d12", display: money(value) }));

  const lossBars = Object.entries(funnel?.lossReasonBreakdown ?? {}).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ label: LOSS_REASON_LABEL[reason] ?? reason, value: count, color: "#e4542d", display: String(count) }));

  const dailySpend = (metrics?.dailyMetrics ?? []).slice(0, 14).reverse();
  const maxDaily = Math.max(1, ...dailySpend.map((d) => d.adSpend));

  return (
    <div className="simple-page">
      <section className="welcome-row">
        <div><p>BÁO CÁO</p><h1>Bức tranh tài chính & hiệu quả</h1><span>Số liệu tháng {metrics?.month ?? ""} — quảng cáo, doanh thu, phễu bán hàng.</span></div>
      </section>

      {/* Quảng cáo Facebook */}
      <div className="map-card fb-ads-card">
        <div className="dashboard-card-title">
          <strong>📊 Quảng cáo Facebook</strong>
          <a href={FB_ADS_MANAGER_URL} target="_blank" rel="noreferrer" className="outline-button" style={{ width: "auto", textDecoration: "none" }}>Mở Trình quản lý QC ↗</a>
        </div>
        {(!fbHasToken || fbEditToken) ? (
          <div style={{ padding: 16, display: "grid", gap: 10 }}>
            <p style={{ fontSize: 12, color: "#647572", margin: 0 }}>Dán mã tài khoản quảng cáo và access token để kéo số liệu thật từ Facebook về. Token lưu an toàn, không hiển thị lại.</p>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Mã tài khoản quảng cáo (act_...)
              <input value={fbAccountId} onChange={(e) => setFbAccountId(e.target.value)} placeholder="VD: 1378071637200779" style={{ fontFamily: "monospace" }} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Access token {fbHasToken ? "(để trống nếu giữ token cũ)" : ""}
              <input type="password" value={fbToken} onChange={(e) => setFbToken(e.target.value)} placeholder="Dán access token Facebook" style={{ fontFamily: "monospace" }} />
            </label>
            {fbError ? <div className="warn-banner" style={{ padding: "8px 12px" }}>{fbError}</div> : null}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="save-button" style={{ width: "auto" }} onClick={saveFbConfig} disabled={fbSaving}>{fbSaving ? "Đang lưu..." : "Lưu & kết nối"}</button>
              {fbEditToken ? <button className="outline-button" style={{ width: "auto" }} onClick={() => { setFbEditToken(false); setFbError(""); }}>Huỷ</button> : null}
            </div>
            <details style={{ fontSize: 11, color: "#647572" }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, color: "#41625b" }}>Cách lấy access token (mở để xem)</summary>
              <ol style={{ paddingLeft: 18, marginTop: 8, display: "grid", gap: 4 }}>
                <li>Mở <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a>, đăng nhập Facebook.</li>
                <li>Chọn app ở &quot;Ứng dụng trên Meta&quot; → thêm quyền <code>ads_read</code>.</li>
                <li>Bấm &quot;Generate Access Token&quot;, đồng ý cấp quyền.</li>
                <li>Sao chép token dán vào ô trên (token ngắn hạn ~1 giờ để thử).</li>
              </ol>
            </details>
          </div>
        ) : (
          <div style={{ padding: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={fbPreset} onChange={(e) => { setFbPreset(e.target.value); loadFbInsights(e.target.value); }} style={{ width: "auto" }}>
                {FB_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button className="outline-button" style={{ width: "auto" }} onClick={() => loadFbInsights(fbPreset)} disabled={fbLoading}>{fbLoading ? "Đang tải..." : "↻ Tải lại"}</button>
              <span style={{ flex: 1 }} />
              <button className="outline-button" style={{ width: "auto", fontSize: 11 }} onClick={() => setFbEditToken(true)}>Đổi token / tài khoản</button>
            </div>
            {fbError ? <div className="warn-banner" style={{ padding: "8px 12px" }}>{fbError}</div> : null}
            {fbMetrics ? (
              <div className="fb-metrics-grid">
                <div className="kpi-card"><span>Chi tiêu</span><strong>{money(fbMetrics.spend)}</strong></div>
                <div className="kpi-card"><span>Kết quả (tin nhắn/lead)</span><strong>{fbMetrics.results.toLocaleString("vi-VN")}</strong></div>
                <div className="kpi-card"><span>Chi phí / kết quả</span><strong>{money(fbMetrics.costPerResult)}</strong></div>
                <div className="kpi-card"><span>Tiếp cận</span><strong>{fbMetrics.reach.toLocaleString("vi-VN")}</strong></div>
                <div className="kpi-card"><span>Hiển thị</span><strong>{fbMetrics.impressions.toLocaleString("vi-VN")}</strong></div>
                <div className="kpi-card"><span>Lượt click</span><strong>{fbMetrics.clicks.toLocaleString("vi-VN")}</strong></div>
                <div className="kpi-card"><span>CPC (giá/click)</span><strong>{money(fbMetrics.cpc)}</strong></div>
                <div className="kpi-card"><span>CTR</span><strong>{fbMetrics.ctr.toFixed(2)}%</strong></div>
                <div className="kpi-card"><span>CPM</span><strong>{money(fbMetrics.cpm)}</strong></div>
                <div className="kpi-card"><span>Tần suất</span><strong>{fbMetrics.frequency.toFixed(2)}</strong></div>
              </div>
            ) : !fbLoading && !fbError ? <div className="empty-state"><strong>Chưa có số liệu trong khoảng này.</strong></div> : null}
          </div>
        )}
      </div>

      {/* Bức tranh tài chính */}
      <section className="report-cards" style={{ marginTop: 18 }}>
        <div className="report-card" style={{ ["--accent" as string]: "#08751d" }}><span>Doanh thu chốt (tháng)</span><strong>{money(fin.revenueForRatio)}</strong></div>
        <div className="report-card" style={{ ["--accent" as string]: "#e4542d" }}><span>Chi quảng cáo (tháng)</span><strong>{money(fin.adSpend)}</strong></div>
        <div className="report-card" style={{ ["--accent" as string]: ratioColor(fin.adsRatio) }}>
          <span>Ads / Doanh thu</span>
          <strong style={{ color: ratioColor(fin.adsRatio) }}>{fin.adsRatio === null ? "—" : `${fin.adsRatio.toFixed(1)}%`}</strong>
          <small>{fin.adsRatio === null ? "chưa có doanh thu" : fin.adsRatio < 30 ? "hiệu quả tốt" : fin.adsRatio < 50 ? "cần chú ý" : "chi phí cao"}</small>
        </div>
        <div className="report-card" style={{ ["--accent" as string]: "#0f9b8e" }}><span>ROAS (doanh thu/ads)</span><strong>{fin.roas === null ? "—" : `${fin.roas.toFixed(1)}×`}</strong></div>
        <div className="report-card" style={{ ["--accent" as string]: "#3a7bd5" }}><span>Giá trị pipeline</span><strong>{money(fin.pipelineValue)}</strong></div>
        <div className="report-card" style={{ ["--accent" as string]: "#f5a623" }}><span>Giá trị đơn TB (AOV)</span><strong>{money(funnel?.aov ?? 0)}</strong></div>
      </section>

      <div className="charts-2">
        <div className="map-card">
          <div className="dashboard-card-title"><strong>Phễu pipeline (số khách · giá trị)</strong></div>
          <div style={{ padding: 14 }}><BarChart items={funnelBars} empty="Chưa có khách trong pipeline." /></div>
        </div>
        <div className="map-card">
          <div className="dashboard-card-title"><strong>Doanh thu chốt theo nguồn</strong></div>
          <div style={{ padding: 14 }}><BarChart items={sourceBars} empty="Chưa có doanh thu chốt." /></div>
        </div>
      </div>

      <div className="charts-2">
        <div className="map-card">
          <div className="dashboard-card-title"><strong>Chi quảng cáo theo ngày</strong></div>
          <div style={{ padding: 14 }}>
            {dailySpend.length === 0 ? <div className="radar-empty">Chưa nhập chi ads ngày nào.</div> : (
              <div className="vbar-chart">
                {dailySpend.map((d) => (
                  <div key={d.id} className="vbar" title={`${formatDate(d.date)} · ${money(d.adSpend)}`}>
                    <div className="vbar-fill" style={{ height: `${(d.adSpend / maxDaily) * 100}%` }} />
                    <div className="vbar-label">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="map-card">
          <div className="dashboard-card-title"><strong>Lý do mất khách</strong></div>
          <div style={{ padding: 14 }}><BarChart items={lossBars} empty="Chưa mất khách nào trong tháng." /></div>
        </div>
      </div>

      {/* Chỉ số phễu (rút gọn) */}
      {funnel && (
        <section className="dashboard-kpis" style={{ marginTop: 18 }}>
          <div className="kpi-card"><span>CPL hợp lệ (trong vùng)</span><strong>{money(funnel.cplValid)}</strong></div>
          <div className="kpi-card"><span>CPL trần</span><strong>{money(funnel.cplCeiling)}</strong></div>
          <div className="kpi-card"><span>% liên hệ được</span><strong>{funnel.pctContacted}%</strong></div>
          <div className="kpi-card"><span>% đến showroom</span><strong>{funnel.pctArrived}%</strong></div>
          <div className="kpi-card"><span>% chốt trên khách đến</span><strong>{funnel.pctWon}%</strong></div>
          <div className="kpi-card"><span>Gọi lần 1 (trung vị)</span><strong>{funnel.medianFirstCallMinutes} phút</strong></div>
        </section>
      )}

      {/* Nhập chi ads hằng ngày */}
      <div className="map-card" style={{ marginTop: 18 }}>
        <div className="dashboard-card-title"><strong>Nhập chi phí quảng cáo hằng ngày</strong></div>
        <form onSubmit={submitDailySpend} style={{ display: "flex", gap: 10, padding: 16, alignItems: "end", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Ngày
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, flex: 1, minWidth: 160 }}>Chi ads trong ngày (đ)
            <input type="number" min={0} value={adSpend} onChange={(event) => setAdSpend(event.target.value)} placeholder="VD: 220000" required />
          </label>
          <button type="submit" className="save-button" style={{ width: "auto" }} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
        </form>
      </div>

      {/* Cấu hình & tích hợp — thu gọn */}
      <details className="map-card config-details" style={{ marginTop: 18 }}>
        <summary className="dashboard-card-title" style={{ cursor: "pointer" }}><strong>⚙ Cấu hình & tích hợp nâng cao</strong></summary>
        <div style={{ padding: 16, display: "grid", gap: 20 }}>
          <div>
            <strong style={{ fontSize: 13 }}>Biên lợi nhuận (tính CPL trần)</strong>
            <div style={{ display: "flex", gap: 10, alignItems: "end", marginTop: 8 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Biên lợi nhuận TB (%)
                <input type="number" min={1} max={90} value={marginRate} onChange={(event) => setMarginRate(Number(event.target.value) || 0)} style={{ width: 120 }} />
              </label>
              <button className="outline-button" style={{ width: "auto" }} onClick={saveMarginRate}>Lưu</button>
            </div>
          </div>

          <div>
            <strong style={{ fontSize: 13 }}>Tích hợp AI tự động (Business Suite / n8n)</strong>
            <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Endpoint (POST)
                <div style={{ display: "flex", gap: 8 }}>
                  <input readOnly value={webhookEndpoint} style={{ flex: 1, fontFamily: "monospace", fontSize: 11 }} />
                  <button type="button" className="outline-button" style={{ width: "auto" }} onClick={() => copyToClipboard(webhookEndpoint, "endpoint")}>Sao chép</button>
                </div>
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Khoá bí mật (header <code>x-webhook-secret</code>)
                <div style={{ display: "flex", gap: 8 }}>
                  <input readOnly type={showSecret ? "text" : "password"} value={webhookSecret} style={{ flex: 1, fontFamily: "monospace", fontSize: 11 }} />
                  <button type="button" className="outline-button" style={{ width: "auto" }} onClick={() => setShowSecret((v) => !v)}>{showSecret ? "Ẩn" : "Hiện"}</button>
                  <button type="button" className="outline-button" style={{ width: "auto" }} onClick={() => copyToClipboard(webhookSecret, "khoá bí mật")}>Sao chép</button>
                </div>
              </label>
              <div><button type="button" className="outline-button" style={{ width: "auto" }} onClick={regenerateSecret}>Tạo khoá mới</button></div>
            </div>
          </div>

          <div>
            <strong style={{ fontSize: 13 }}>Nhắc hẹn qua Lịch iPhone</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {CALENDAR_PEOPLE.map((name) => (
                <div key={name} style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 8, alignItems: "center" }}>
                  <strong style={{ fontSize: 12 }}>{CALENDAR_PEOPLE_LABEL[name] ?? name}</strong>
                  <input readOnly value={calendarLinks[name] ?? "Đang tạo link..."} style={{ fontFamily: "monospace", fontSize: 10 }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <a href={calendarLinks[name]} className="outline-button" style={{ width: "auto", textDecoration: "none", textAlign: "center" }}>Mở</a>
                    <button type="button" className="outline-button" style={{ width: "auto" }} onClick={() => copyToClipboard(calendarLinks[name] ?? "", `link lịch ${name}`)}>Sao chép</button>
                  </div>
                </div>
              ))}
              <div><button type="button" className="outline-button" style={{ width: "auto" }} onClick={regenerateCalendarSecret}>Tạo lại toàn bộ link lịch</button></div>
            </div>
          </div>

          {crossSell && (
            <div>
              <strong style={{ fontSize: 13 }}>4 chỉ số bán chéo công trình</strong>
              <div style={{ display: "grid", gap: 8, fontSize: 12, marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Số hạng mục / công trình</span><strong>{crossSell.avgItemsPerProject}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>% mua đơn thứ 2 trong 90 ngày</span><strong>{crossSell.pctSecondPurchaseWithin90Days}%</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Khoảng cách giữa 2 đơn (ngày)</span><strong>{crossSell.avgGapDays}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Giá trị vòng đời công trình (TB)</span><strong>{money(crossSell.avgLifetimeValue)}</strong></div>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
