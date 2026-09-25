"use client";

import { useMemo } from "react";
import type { Customer, Task } from "../../lib/types";
import { FUNNEL_STAGE_LABEL, FUNNEL_STAGE_COLOR, PRIORITY_EMOJI, PRIORITY_LABEL } from "../../lib/labels";
import { money, formatDate, addDays } from "../../lib/format";

type Props = {
  person: string;
  tasks: Task[];
  customers: Customer[];
  today: string;
  onOpenCustomer: (id: number) => void;
  onComplete: (task: Task) => void;
  onAddTask: () => void;
};

function CustomerLine({ customer }: { customer: Customer }) {
  return (
    <div className="today-cust">
      <strong>{customer.fullName}</strong>
      <a href={`tel:${customer.phone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()} className="today-phone">{customer.phone}</a>
    </div>
  );
}

export default function TodayView({ person, tasks, customers, today, onOpenCustomer, onComplete, onAddTask }: Props) {
  const customerById = useMemo(() => {
    const map = new Map<number, Customer>();
    for (const customer of customers) map.set(customer.id, customer);
    return map;
  }, [customers]);

  const openTasks = useMemo(() => tasks.filter((task) => task.status === "open"), [tasks]);
  const overdue = useMemo(() => openTasks.filter((task) => task.dueDate < today), [openTasks, today]);
  const dueToday = useMemo(() => openTasks.filter((task) => task.dueDate === today), [openTasks, today]);
  const weekAhead = addDays(today, 7);
  const upcoming = useMemo(
    () => openTasks.filter((task) => task.dueDate > today && task.dueDate <= weekAhead),
    [openTasks, today, weekAhead],
  );

  const newLeads = useMemo(
    () => customers.filter((c) => c.funnelStage === "lead" && c.contactResult === "chua_lien_he"),
    [customers],
  );
  const hotCustomers = useMemo(
    () => customers
      .filter((c) => c.priority === "hot" && !["won", "aftercare", "delivering", "lost", "paused"].includes(c.funnelStage))
      .sort((a, b) => (a.nextContactDate || "9999").localeCompare(b.nextContactDate || "9999")),
    [customers],
  );

  function TaskCard({ task, tone }: { task: Task; tone: "danger" | "today" | "soft" }) {
    const customer = task.customerId != null ? customerById.get(task.customerId) : undefined;
    return (
      <div className={`today-card ${tone}`} onClick={() => customer && onOpenCustomer(customer.id)} role="button" tabIndex={0}>
        <div className="today-card-main">
          {customer ? <CustomerLine customer={customer} /> : <strong>{task.title}</strong>}
          <div className="today-card-need">
            {customer ? (
              <>
                <span className="mini-pill" style={{ ["--status" as string]: FUNNEL_STAGE_COLOR[customer.funnelStage] }}>{FUNNEL_STAGE_LABEL[customer.funnelStage]}</span>
                <span className="mini-temp">{PRIORITY_EMOJI[customer.priority]} {PRIORITY_LABEL[customer.priority]}</span>
                <span className="today-money">{money(customer.value)}</span>
              </>
            ) : null}
          </div>
          <div className="today-next">
            <span>▶ {task.title}</span>
            <small>{formatDate(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ""} · {task.assignedTo}</small>
          </div>
        </div>
        <button
          className="complete-btn"
          onClick={(event) => { event.stopPropagation(); onComplete(task); }}
        >
          Hoàn thành
        </button>
      </div>
    );
  }

  function CustomerCard({ customer, tone }: { customer: Customer; tone: "danger" | "today" | "soft" }) {
    const overdueNext = /^\d{4}-\d{2}-\d{2}$/.test(customer.nextContactDate) && customer.nextContactDate < today;
    const noNext = !(customer.nextAction.trim() && /^\d{4}-\d{2}-\d{2}$/.test(customer.nextContactDate));
    return (
      <div className={`today-card ${tone}`} onClick={() => onOpenCustomer(customer.id)} role="button" tabIndex={0}>
        <div className="today-card-main">
          <CustomerLine customer={customer} />
          <div className="today-card-need">
            <span className="mini-pill" style={{ ["--status" as string]: FUNNEL_STAGE_COLOR[customer.funnelStage] }}>{FUNNEL_STAGE_LABEL[customer.funnelStage]}</span>
            <span className="mini-temp">{PRIORITY_EMOJI[customer.priority]} {PRIORITY_LABEL[customer.priority]}</span>
            <span className="today-money">{money(customer.value)}</span>
          </div>
          {noNext ? (
            <div className="today-next warn"><span>⚠ CHƯA CÓ VIỆC TIẾP THEO</span></div>
          ) : (
            <div className={`today-next${overdueNext ? " warn" : ""}`}>
              <span>▶ {customer.nextAction}</span>
              <small>{formatDate(customer.nextContactDate)}{customer.nextActionTime ? ` · ${customer.nextActionTime}` : ""}{overdueNext ? " · QUÁ HẠN" : ""}</small>
            </div>
          )}
        </div>
      </div>
    );
  }

  const totalToDo = overdue.length + dueToday.length + newLeads.length;

  return (
    <div className="simple-page">
      <section className="welcome-row">
        <div>
          <p>VIỆC HÔM NAY · {person}</p>
          <h1>Hôm nay cần xử lý {totalToDo} việc</h1>
          <span>Quá hạn {overdue.length} · Lead mới {newLeads.length} · Đến hạn hôm nay {dueToday.length}</span>
        </div>
        <button className="mobile-add" onClick={onAddTask}>＋ Thêm việc</button>
      </section>

      <Group title="1 · Quá hạn" count={overdue.length} tone="danger" empty="Không có việc quá hạn 🎉">
        {overdue.map((task) => <TaskCard key={task.id} task={task} tone="danger" />)}
      </Group>

      <Group title="2 · Lead mới chưa xử lý" count={newLeads.length} tone="danger" empty="Không có lead mới chờ xử lý.">
        {newLeads.map((customer) => <CustomerCard key={customer.id} customer={customer} tone="danger" />)}
      </Group>

      <Group title="3 · Việc hôm nay" count={dueToday.length} tone="today" empty="Hôm nay chưa có việc đến hạn.">
        {dueToday.map((task) => <TaskCard key={task.id} task={task} tone="today" />)}
      </Group>

      <Group title="4 · Khách nóng cần ưu tiên" count={hotCustomers.length} tone="today" empty="Không có khách nóng đang chờ.">
        {hotCustomers.map((customer) => <CustomerCard key={customer.id} customer={customer} tone="today" />)}
      </Group>

      <Group title="5 · Việc sắp tới (7 ngày)" count={upcoming.length} tone="soft" empty="Chưa có việc trong 7 ngày tới.">
        {upcoming.map((task) => <TaskCard key={task.id} task={task} tone="soft" />)}
      </Group>
    </div>
  );
}

function Group({ title, count, tone, empty, children }: { title: string; count: number; tone: string; empty: string; children: React.ReactNode }) {
  return (
    <section className={`today-group ${tone}`}>
      <div className="today-group-head">
        <strong>{title}</strong>
        <span>{count}</span>
      </div>
      <div className="today-group-body">
        {count === 0 ? <div className="today-empty">{empty}</div> : children}
      </div>
    </section>
  );
}
