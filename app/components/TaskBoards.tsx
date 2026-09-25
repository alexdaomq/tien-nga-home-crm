"use client";

import { useMemo, useState } from "react";
import type { Task } from "../../lib/types";
import { TASK_TYPE_LABEL } from "../../lib/labels";
import { formatDate, todayISO, addDays } from "../../lib/format";

const COMPLETED_TABLE_COLUMNS = "1.1fr 1.8fr 1.5fr 1.1fr 1fr 1fr";

function taskLabel(task: Task) {
  if (task.customerName) return task.customerName;
  if (task.projectCode) return `Công trình ${task.projectCode}`;
  return "Việc nội bộ";
}

function formatTime(value: string) {
  return value || "--:--";
}

function weekdayLabel(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(new Date(`${iso}T00:00:00`)).toLocaleUpperCase("vi");
}

function shortDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}` : iso;
}

export function TodayBoard({ tasks, onComplete, onAddTask }: { tasks: Task[]; onComplete: (task: Task) => void; onAddTask: () => void }) {
  const today = todayISO();
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index)), [today]);
  const openTasks = tasks.filter((task) => task.status === "open");
  const overdueTasks = openTasks.filter((task) => task.dueDate < today);
  const byDay = new Map(days.map((day) => [day, openTasks.filter((task) => task.dueDate === day).sort((a, b) => formatTime(a.dueTime).localeCompare(formatTime(b.dueTime)))]));

  return (
    <div className="simple-page">
      <section className="welcome-row week-welcome">
        <div><p>LỊCH CÔNG VIỆC 7 NGÀY</p><h1>Việc cần làm</h1><span>Từ {formatDate(days[0])} đến {formatDate(days[6])} · gồm cả nhắc bán chéo tự động theo công trình.</span></div>
        <button className="outline-button" onClick={onAddTask}>＋ Thêm công việc</button>
      </section>

      {overdueTasks.length > 0 && (
        <div className="overdue-strip">
          <div style={{ padding: 14 }}><strong>{overdueTasks.length} việc quá hạn</strong> — xử lý trước khi làm việc mới trong ngày.</div>
        </div>
      )}

      <div className="week-board" aria-label="Lịch công việc 7 ngày">
        {days.map((day) => (
          <div className="week-day" key={day}>
            <div className={`crm-day-header${day === today ? " is-today" : ""}`}>
              <span className="crm-day-label">{weekdayLabel(day)}{day === today ? " · Hôm nay" : ""}</span>
              <strong className="crm-day-date">{shortDate(day)}</strong>
            </div>
            <div className="week-task-list">
              {(byDay.get(day) ?? []).length === 0 ? (
                <div className="week-empty"><span>Không có việc</span></div>
              ) : (byDay.get(day) ?? []).map((task) => (
                <div className="week-task" key={task.id}>
                  <div className="week-task-time"><strong>{formatTime(task.dueTime)}</strong><span className="task-type">{TASK_TYPE_LABEL[task.type] ?? task.type}</span></div>
                  <div className="week-task-content">
                    <strong>{task.title}</strong>
                    <small>{taskLabel(task)} · {task.assignedTo}</small>
                  </div>
                  <button className="task-complete" onClick={() => onComplete(task)} title="Đánh dấu hoàn thành" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <section className="week-summary">
        <div><strong>{openTasks.length}</strong><span>việc mở</span></div>
        <div><strong>{(byDay.get(today) ?? []).length}</strong><span>việc hôm nay</span></div>
        <div className={overdueTasks.length ? "danger" : ""}><strong>{overdueTasks.length}</strong><span>việc quá hạn</span></div>
        <button onClick={onAddTask}>＋ Thêm việc mới</button>
      </section>
    </div>
  );
}

export function AppointmentsBoard({ tasks, onComplete, onAddAppointment }: { tasks: Task[]; onComplete: (task: Task) => void; onAddAppointment: () => void }) {
  const appointments = tasks.filter((task) => task.type === "appointment").sort((a, b) => (a.dueDate + a.dueTime).localeCompare(b.dueDate + b.dueTime));
  return (
    <div className="simple-page">
      <section className="welcome-row">
        <div><p>LỊCH CHĂM SÓC</p><h1>Lịch hẹn khách hàng</h1><span>Tập trung tất cả cuộc hẹn khảo sát / showroom tại một nơi.</span></div>
        <button className="outline-button" onClick={onAddAppointment}>＋ Tạo lịch hẹn</button>
      </section>
      <div className="appointment-list">
        {appointments.length === 0 ? (
          <div className="empty-state"><strong>Chưa có lịch hẹn</strong><small>Tạo lịch hẹn ngay khi khách đồng ý đến showroom.</small></div>
        ) : appointments.map((task) => (
          <div key={task.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr auto", gap: 14, alignItems: "center", padding: 14, borderBottom: "1px solid #e6ece9" }}>
            <div className="crm-appointment-date"><strong>{shortDate(task.dueDate)}</strong><span>{formatTime(task.dueTime)}</span></div>
            <div className="appointment-info"><strong>{taskLabel(task)}</strong><div style={{ fontSize: 12, color: "#647572" }}>{task.title} · phụ trách {task.assignedTo}</div></div>
            <div className="appointment-owner">
              {task.status === "done" ? <span className="status-pill" style={{ ["--status" as string]: "#08751d" }}>Đã hoàn thành</span> : (
                <button className="complete-appointment" onClick={() => onComplete(task)}>Đánh dấu hoàn thành</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompletedBoard({ tasks }: { tasks: Task[] }) {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const completed = useMemo(() => {
    const doneTasks = tasks.filter((task) => task.status === "done");
    return doneTasks
      .filter((task) => (ownerFilter === "all" ? true : task.assignedTo === ownerFilter))
      .filter((task) => (search.trim() ? `${task.title} ${taskLabel(task)}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")) : true))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [tasks, search, ownerFilter]);
  const owners = Array.from(new Set(tasks.map((task) => task.assignedTo))).filter(Boolean);

  return (
    <div className="simple-page">
      <section className="welcome-row completed-welcome">
        <div><p>NHẬT KÝ HOẠT ĐỘNG</p><h1>Việc đã làm</h1><span>Mọi công việc sau khi hoàn thành đều được lưu lại để cả nhóm tra cứu.</span></div>
      </section>
      <section className="completed-filters" aria-label="Bộ lọc việc đã làm">
        <input placeholder="Tìm theo tên việc hoặc khách hàng" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
          <option value="all">Tất cả sale</option>
          {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
        </select>
        <span>{completed.length} việc đã hoàn thành</span>
      </section>
      <div className="crm-table-scroll">
        {completed.length === 0 ? (
          <div className="crm-table-empty"><strong>Chưa có việc nào hoàn thành</strong></div>
        ) : (
          <>
            <div className="crm-table-head" style={{ gridTemplateColumns: COMPLETED_TABLE_COLUMNS }}>
              <span>Hoàn thành lúc</span><span>Công việc</span><span>Khách hàng</span><span>Loại việc</span><span>Sale phụ trách</span><span>Ngày dự kiến</span>
            </div>
            {completed.map((task) => (
              <div className="crm-table-row" style={{ gridTemplateColumns: COMPLETED_TABLE_COLUMNS, cursor: "default" }} key={task.id}>
                <div className="crm-cell"><span>{formatDate((task.updatedAt || "").slice(0, 10))}</span></div>
                <div className="crm-cell"><strong>{task.title}</strong></div>
                <div className="crm-cell"><span>{taskLabel(task)}</span></div>
                <div className="crm-cell"><span className="completed-type">{TASK_TYPE_LABEL[task.type] ?? task.type}</span></div>
                <div className="crm-cell"><span>{task.assignedTo}</span></div>
                <div className="crm-cell"><span>{formatDate(task.dueDate)}</span></div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
