"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { FUNNEL_STAGE_LABEL, PRIORITY_LABEL } from "../../lib/labels";
import { checkImportRows, parseCsv, sheetToImportRows, templateCsv, type ImportRow, type RowCheck } from "../../lib/customer-import";

type Props = {
  person: string;
  existingPhones: Set<string>;
  onClose: () => void;
  onDone: (created: number) => void;
};

const CHUNK = 10; // số khách gửi lên mỗi lần (giới hạn truy vấn D1 mỗi lần gọi)

async function readRows(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsv(await file.text());
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  throw new Error("Chỉ nhận file .xlsx hoặc .csv. Nếu là file .xls cũ: mở bằng Excel rồi chọn Lưu thành (Save As) → .xlsx.");
}

function downloadTemplate() {
  const blob = new Blob([templateCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mau-nhap-khach-hang.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportCustomersModal({ person, existingPhones, onClose, onDone }: Props) {
  const [step, setStep] = useState<"pick" | "preview" | "importing" | "done">("pick");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [serverStatus, setServerStatus] = useState<Record<number, RowCheck>>({});

  const checks = useMemo(() => checkImportRows(rows, existingPhones), [rows, existingPhones]);
  const okIdx = checks.map((c, i) => (c.status === "ok" ? i : -1)).filter((i) => i >= 0);
  const dupCount = checks.filter((c) => c.status === "duplicate").length;
  const errCount = checks.filter((c) => c.status === "error").length;

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setReading(true);
    try {
      const raw = await readRows(file);
      const parsed = sheetToImportRows(raw, person);
      if (parsed.error) { setError(parsed.error); return; }
      if (parsed.rows.length === 0) { setError("File không có dòng khách nào dưới dòng tiêu đề."); return; }
      setFileName(file.name);
      setRows(parsed.rows);
      setServerStatus({});
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được file.");
    } finally {
      setReading(false);
    }
  }

  async function runImport() {
    setStep("importing");
    setProgress({ done: 0, total: okIdx.length });
    const status: Record<number, RowCheck> = {};
    for (let start = 0; start < okIdx.length; start += CHUNK) {
      const batch = okIdx.slice(start, start + CHUNK);
      try {
        const res = await fetch("/api/customers/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enteredBy: person, rows: batch.map((i) => rows[i]) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Lỗi máy chủ");
        for (const r of data.results as { index: number; status: string; message: string }[]) {
          status[batch[r.index]] = { status: r.status === "created" ? "ok" : r.status === "duplicate" ? "duplicate" : "error", message: r.message };
        }
      } catch (e) {
        for (const i of batch) status[i] = { status: "error", message: e instanceof Error ? e.message : "Không gửi được" };
      }
      setProgress({ done: Math.min(start + CHUNK, okIdx.length), total: okIdx.length });
    }
    setServerStatus(status);
    setStep("done");
  }

  const created = Object.values(serverStatus).filter((s) => s.status === "ok").length;
  const dupTotal = dupCount + Object.values(serverStatus).filter((s) => s.status === "duplicate").length;
  const failedRows = rows
    .map((row, i) => ({ row, i, check: serverStatus[i] ?? checks[i] }))
    .filter((x) => x.check.status === "error");

  return (
    <div className="modal-overlay">
      <div className="simple-modal na-modal imp-modal">
        <div className="modal-title">
          <div>
            <h2>Nhập khách từ file Excel</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Người nhập: {person}</span>
          </div>
          <button className="close-button" onClick={onClose} disabled={step === "importing"}>×</button>
        </div>

        {step === "pick" && (
          <div className="imp-body">
            <ol className="imp-steps">
              <li><b>Tải file mẫu</b>, mỗi dòng điền 1 khách. Bắt buộc có <b>Tên khách hàng</b> và <b>Số điện thoại</b>; các cột khác có thể để trống.</li>
              <li><b>Chọn file</b> đã điền (Excel <code>.xlsx</code> hoặc <code>.csv</code>).</li>
              <li>Xem lại bảng kiểm tra rồi bấm <b>Nhập</b>. Số đã có trong CRM sẽ tự bỏ qua.</li>
            </ol>
            <button type="button" className="outline-button imp-template" onClick={downloadTemplate}>⬇ Tải file mẫu</button>
            <label className={`imp-pick${reading ? " busy" : ""}`}>
              <input type="file" accept=".xlsx,.csv" onChange={pickFile} disabled={reading} />
              <span className="imp-pick-icon">📄</span>
              <strong>{reading ? "Đang đọc file…" : "Bấm để chọn file Excel"}</strong>
              <small>.xlsx hoặc .csv</small>
            </label>
            {error ? <div className="warn-banner" style={{ marginTop: 12 }}>{error}</div> : null}
          </div>
        )}

        {step === "preview" && (
          <div className="imp-body">
            <div className="imp-file">📄 {fileName} · {rows.length} dòng</div>
            <div className="imp-summary">
              <span className="ok">✓ {okIdx.length} khách sẽ được thêm</span>
              {dupCount ? <span className="dup">↺ {dupCount} trùng — bỏ qua</span> : null}
              {errCount ? <span className="err">✗ {errCount} dòng lỗi — bỏ qua</span> : null}
            </div>
            <div className="imp-table-wrap">
              <table className="imp-table">
                <thead>
                  <tr><th>#</th><th>Tên khách</th><th>SĐT</th><th>Địa chỉ</th><th>Nhu cầu</th><th>Sale</th><th>Giai đoạn</th><th>Kiểm tra</th></tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={checks[i].status}>
                      <td>{i + 1}</td>
                      <td><b>{row.fullName || "—"}</b></td>
                      <td>{row.phone || row.rawPhone || "—"}</td>
                      <td>{row.address || "—"}</td>
                      <td>{row.need || "—"}</td>
                      <td>{row.owner}</td>
                      <td>{FUNNEL_STAGE_LABEL[row.stage]}{row.priority !== "warm" ? ` · ${PRIORITY_LABEL[row.priority]}` : ""}</td>
                      <td className="imp-status">{checks[i].message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button type="button" className="outline-button" onClick={() => { setStep("pick"); setRows([]); }}>← Chọn file khác</button>
              <button type="button" className="save-button" onClick={runImport} disabled={okIdx.length === 0}>
                {okIdx.length ? `Nhập ${okIdx.length} khách` : "Không có khách hợp lệ"}
              </button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="imp-body imp-center">
            <strong>Đang nhập {progress.done}/{progress.total} khách…</strong>
            <div className="imp-bar"><div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
            <small>Vui lòng không đóng cửa sổ.</small>
          </div>
        )}

        {step === "done" && (
          <div className="imp-body">
            <div className="imp-result">
              <div className="imp-result-big">🎉 Đã thêm {created} khách mới</div>
              {dupTotal ? <div>↺ Bỏ qua {dupTotal} khách trùng số điện thoại.</div> : null}
              {failedRows.length ? <div className="imp-err-title">✗ {failedRows.length} dòng không nhập được (sửa trong file rồi nhập lại):</div> : null}
              {failedRows.length ? (
                <ul className="imp-err-list">
                  {failedRows.slice(0, 20).map((x) => <li key={x.i}>Dòng {x.i + 1}: {x.row.fullName || "(không tên)"} — {x.check.message}</li>)}
                </ul>
              ) : null}
              {created ? <div className="imp-hint">Khách mới đã có việc "Gọi khách lần đầu" hôm nay trong mục <b>Việc hôm nay</b> của sale phụ trách.</div> : null}
            </div>
            <div className="modal-actions">
              <button type="button" className="save-button" onClick={() => onDone(created)}>Xong</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
