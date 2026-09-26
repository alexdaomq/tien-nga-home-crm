"use client";
/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/no-autofocus, @next/next/no-img-element, jsx-a11y/click-events-have-key-events */

import { FormEvent, useEffect, useMemo, useState } from "react";
import SupplierDirectory from "./supplier-directory";
import ProjectsView from "./components/ProjectsView";
import { AppointmentsBoard, CompletedBoard } from "./components/TaskBoards";
import MetricsView from "./components/MetricsView";
import TodayView from "./components/TodayView";
import PipelineBoard from "./components/PipelineBoard";
import PipelineMap from "./components/PipelineMap";
import CustomerDetail from "./components/CustomerDetail";
import CustomerForm from "./components/CustomerForm";
import NextActionModal, { NextActionPayload } from "./components/NextActionModal";
import LostReasonModal, { LostPayload } from "./components/LostReasonModal";
import WonModal, { WonPayload } from "./components/WonModal";
import type { Activity, Customer, MetricsResponse, Project, Task, ViewKey } from "../lib/types";
import { TEAM_MEMBERS, roleOf } from "../lib/types";
import { money, formatDate, todayISO } from "../lib/format";
import { groupTasksByCustomer } from "../lib/flags";
import {
  FUNNEL_STAGE_COLOR,
  FUNNEL_STAGE_LABEL,
  PRIORITY_COLOR,
  PRIORITY_EMOJI,
  PRIORITY_LABEL,
  ROLE_LABEL,
  ACTION_TYPE_LABEL,
} from "../lib/labels";
import { FUNNEL_STAGES, PIPELINE_STAGES, PRIORITIES, SOURCES, STAGE_ALIAS } from "../db/enums";

const funnelStageOptions = FUNNEL_STAGES.map((value) => ({ value, label: FUNNEL_STAGE_LABEL[value] }));
const priorityOptions = PRIORITIES.map((value) => ({ value, label: `${PRIORITY_EMOJI[value]} ${PRIORITY_LABEL[value]}` }));

type NaState = { open: boolean; customer: Customer | null; task: Task | null; mode: "complete" | "edit" | "create" };

export default function Home() {
  const [person, setPerson] = useState(() => TEAM_MEMBERS[0]);
  const role = roleOf(person);
  const [restrictByOwner, setRestrictByOwner] = useState(true);
  const [view, setView] = useState<ViewKey>("dashboard");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const [selected, setSelected] = useState<Customer | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formCustomer, setFormCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);

  const [na, setNa] = useState<NaState>({ open: false, customer: null, task: null, mode: "create" });
  const [lost, setLost] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  const [won, setWon] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", type: "followup", dueDate: todayISO(), dueTime: "", assignedTo: TEAM_MEMBERS[0], notes: "", customerId: null as number | null });
  const [presetProjectCustomerId, setPresetProjectCustomerId] = useState<number | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [toast, setToast] = useState("");

  // ------- khởi tạo & lưu lựa chọn cục bộ -------
  useEffect(() => {
    try {
      const savedPerson = window.localStorage.getItem("tnh-crm-person");
      if (savedPerson && TEAM_MEMBERS.includes(savedPerson)) setPerson(savedPerson);
      const savedRestrict = window.localStorage.getItem("tnh-crm-restrict");
      if (savedRestrict != null) setRestrictByOwner(savedRestrict === "1");
    } catch { /* localStorage không khả dụng */ }
  }, []);

  // Sale mặc định mở "Việc hôm nay"; quản lý mở Dashboard.
  useEffect(() => {
    setView(roleOf(person) === "sales" ? "today" : "dashboard");
  }, [person]);

  function choosePerson(value: string) {
    setPerson(value);
    try { window.localStorage.setItem("tnh-crm-person", value); } catch { /* bỏ qua */ }
  }
  function chooseRestrict(value: boolean) {
    setRestrictByOwner(value);
    try { window.localStorage.setItem("tnh-crm-restrict", value ? "1" : "0"); } catch { /* bỏ qua */ }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function fetchCustomers() {
    const res = await fetch("/api/customers");
    const data = await res.json();
    if (res.ok) setCustomers(data.customers ?? []);
  }
  async function fetchProjects() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (res.ok) setProjects(data.projects ?? []);
  }
  async function fetchTasks() {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    if (res.ok) setTasks(data.tasks ?? []);
  }
  async function fetchMetrics() {
    const res = await fetch("/api/metrics");
    const data = await res.json();
    if (res.ok) setMetrics(data);
  }
  async function refreshCore() {
    await Promise.all([fetchCustomers(), fetchTasks()]);
  }
  async function refreshAll() {
    await Promise.all([fetchCustomers(), fetchProjects(), fetchTasks(), fetchMetrics()]);
  }

  useEffect(() => {
    refreshAll().finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!selected) { setActivities([]); return; }
    fetch(`/api/activities?customerId=${selected.id}`).then((res) => res.json()).then((data) => setActivities(data.activities ?? []));
  }, [selected]);

  // Đồng bộ khách đang mở với dữ liệu mới nhất sau mỗi lần refresh.
  useEffect(() => {
    if (!selected) return;
    const fresh = customers.find((c) => c.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [customers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------- giới hạn theo vai trò -------
  const isManager = role === "manager";
  const visibleCustomers = useMemo(
    () => (isManager || !restrictByOwner ? customers : customers.filter((c) => c.owner === person)),
    [customers, isManager, restrictByOwner, person],
  );
  const visibleTasks = useMemo(
    () => (isManager || !restrictByOwner ? tasks : tasks.filter((t) => t.assignedTo === person)),
    [tasks, isManager, restrictByOwner, person],
  );
  const tasksByCustomer = useMemo(() => groupTasksByCustomer(visibleTasks), [visibleTasks]);

  // Khách đã mất/tạm hoãn thì bỏ việc của họ ra khỏi danh sách cần làm (tránh nhắc việc chết).
  const closedCustomerIds = useMemo(() => {
    const set = new Set<number>();
    for (const c of visibleCustomers) if (c.funnelStage === "lost" || c.funnelStage === "paused") set.add(c.id);
    return set;
  }, [visibleCustomers]);
  const actionableTasks = useMemo(
    () => visibleTasks.filter((t) => t.customerId == null || !closedCustomerIds.has(t.customerId)),
    [visibleTasks, closedCustomerIds],
  );

  const today = todayISO();
  const openTasks = useMemo(() => actionableTasks.filter((t) => t.status === "open"), [actionableTasks]);
  const overdueTasks = useMemo(() => openTasks.filter((t) => t.dueDate < today), [openTasks, today]);
  const dueTodayTasks = useMemo(() => openTasks.filter((t) => t.dueDate === today), [openTasks, today]);
  const newLeads = useMemo(() => visibleCustomers.filter((c) => c.funnelStage === "lead" && c.contactResult === "chua_lien_he"), [visibleCustomers]);
  const hotCustomers = useMemo(
    () => visibleCustomers.filter((c) => c.priority === "hot" && !["won", "aftercare", "delivering", "lost", "paused"].includes(c.funnelStage)),
    [visibleCustomers],
  );
  const showroomToday = useMemo(() => visibleCustomers.filter((c) => c.appointmentDate.slice(0, 10) === today && !c.arrived), [visibleCustomers, today]);
  const siteVisitToday = useMemo(() => visibleCustomers.filter((c) => c.estimatedTileDate.slice(0, 10) === today), [visibleCustomers, today]);

  const searchResults = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("vi");
    if (!term) return [];
    return visibleCustomers.filter((c) => `${c.fullName} ${c.phone} ${c.address} ${c.ward} ${c.need}`.toLocaleLowerCase("vi").includes(term)).slice(0, 8);
  }, [search, visibleCustomers]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("vi");
    return visibleCustomers.filter((c) => {
      if (stageFilter === "uncontacted") { if (c.contactResult !== "chua_lien_he" || c.funnelStage === "lost") return false; }
      else if (stageFilter !== "all" && c.funnelStage !== stageFilter) return false;
      if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
      if (ownerFilter !== "all" && c.owner !== ownerFilter) return false;
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      if (!term) return true;
      return `${c.fullName} ${c.phone} ${c.address} ${c.ward} ${c.need}`.toLocaleLowerCase("vi").includes(term);
    });
  }, [visibleCustomers, search, stageFilter, priorityFilter, ownerFilter, sourceFilter]);

  const pipelineValue = useMemo(
    () => visibleCustomers.filter((c) => !["lost", "paused"].includes(c.funnelStage)).reduce((s, c) => s + c.value, 0),
    [visibleCustomers],
  );
  const wonRevenue = useMemo(
    () => visibleCustomers.filter((c) => ["won", "aftercare", "delivering"].includes(c.funnelStage)).reduce((s, c) => s + c.value, 0),
    [visibleCustomers],
  );

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of visibleCustomers) counts.set(c.funnelStage, (counts.get(c.funnelStage) ?? 0) + 1);
    return counts;
  }, [visibleCustomers]);

  const notifTotal = overdueTasks.length + newLeads.length + showroomToday.length + siteVisitToday.length;

  // ------- các thao tác -------
  function openCustomerById(id: number) {
    const found = customers.find((c) => c.id === id);
    if (found) { setSelected(found); setSearch(""); }
  }

  async function submitCustomerForm(payload: Record<string, unknown>) {
    setSaving(true);
    const isEdit = formMode === "edit" && formCustomer;
    const body = isEdit ? { ...payload, id: formCustomer!.id, enteredBy: person } : { ...payload, enteredBy: person };
    const res = await fetch("/api/customers", { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setToast(data.error ?? "Không lưu được khách hàng."); return; }
    setFormMode(null);
    setToast(isEdit ? "Đã cập nhật hồ sơ khách hàng" : "Đã tạo khách hàng mới");
    await refreshCore();
    setSelected(data.customer);
  }

  async function deleteCustomer(customer: Customer) {
    if (!window.confirm(`Xoá khách hàng ${customer.fullName}? Hành động này không thể hoàn tác.`)) return;
    const res = await fetch("/api/customers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: customer.id }) });
    if (!res.ok) { setToast("Không xoá được khách hàng."); return; }
    setToast(`Đã xoá ${customer.fullName}`);
    setSelected(null);
    await refreshCore();
  }

  async function addActivity(customerId: number, content: string) {
    const res = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, content, enteredBy: person }) });
    const data = await res.json();
    if (res.ok && selected?.id === customerId) setActivities((prev) => [data.activity, ...prev]);
    return res.ok;
  }

  async function patchCustomer(id: number, patch: Record<string, unknown>) {
    const res = await fetch("/api/customers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, enteredBy: person, ...patch }) });
    const data = await res.json();
    if (!res.ok) { setToast(data.error ?? "Không cập nhật được."); return false; }
    return true;
  }

  // Hoàn thành một việc -> bắt buộc mở modal "việc tiếp theo".
  async function completeTaskFlow(task: Task) {
    const res = await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, status: "done" }) });
    if (!res.ok) { setToast("Không cập nhật được công việc."); return; }
    if (task.customerId != null) {
      await addActivity(task.customerId, `HOÀN THÀNH: ${task.title}`);
      const customer = customers.find((c) => c.id === task.customerId) ?? null;
      await fetchTasks();
      setNa({ open: true, customer, task, mode: "complete" });
    } else {
      setToast("Đã đánh dấu hoàn thành");
      await fetchTasks();
    }
  }

  async function onCompleteNextAction(customer: Customer) {
    const openForCustomer = visibleTasks.filter((t) => t.customerId === customer.id && t.status === "open");
    const target = openForCustomer.find((t) => t.type === "auto_followup") ?? openForCustomer.sort((a, b) => (a.dueDate + a.dueTime).localeCompare(b.dueDate + b.dueTime))[0];
    if (target) { await completeTaskFlow(target); return; }
    setNa({ open: true, customer, task: null, mode: "create" });
  }

  async function applyNextAction(payload: NextActionPayload) {
    const customer = na.customer;
    setNa({ open: false, customer: null, task: null, mode: "create" });
    if (!customer) return;
    const ok = await patchCustomer(customer.id, {
      nextAction: payload.nextAction,
      nextActionType: payload.actionType,
      nextContactDate: payload.nextContactDate,
      nextActionTime: payload.nextActionTime,
    });
    if (!ok) return;
    await addActivity(customer.id, `VIỆC TIẾP THEO: ${ACTION_TYPE_LABEL[payload.actionType]} — ${payload.nextAction} (${formatDate(payload.nextContactDate)} ${payload.nextActionTime})`);
    setToast("Đã đặt việc tiếp theo");
    await refreshCore();
  }

  async function changeStage(customer: Customer, stage: string) {
    if (stage === customer.funnelStage) return;
    if (stage === "lost") { setLost({ open: true, customer }); return; }
    // Chốt đơn: bắt buộc nhập giá trị đơn hàng (mở modal).
    if (stage === "won") { setWon({ open: true, customer }); return; }
    // Chuyển sang "Đã đến showroom" thì đánh dấu luôn đã đến (đồng bộ dữ liệu phễu).
    const patch: Record<string, unknown> = { funnelStage: stage };
    if (stage === "arrived" && customer.arrived !== 1) patch.arrived = true;
    const ok = await patchCustomer(customer.id, patch);
    if (!ok) return;
    await addActivity(customer.id, `CHUYỂN GIAI ĐOẠN: ${FUNNEL_STAGE_LABEL[stage]}`);
    setToast(`Đã chuyển sang "${FUNNEL_STAGE_LABEL[stage]}"`);
    await refreshCore();
  }

  async function applyWon(payload: WonPayload) {
    const customer = won.customer;
    setWon({ open: false, customer: null });
    if (!customer) return;
    const ok = await patchCustomer(customer.id, {
      funnelStage: "won",
      value: payload.value,
      closedDate: payload.closedDate,
      itemCount: payload.itemCount,
    });
    if (!ok) return;
    await addActivity(customer.id, `CHỐT ĐƠN: ${money(payload.value)}${payload.itemCount ? ` · ${payload.itemCount} món` : ""}${payload.note ? ` · ${payload.note}` : ""}`);
    setToast("Đã chốt đơn 🎉");
    await refreshCore();
  }

  async function applyLost(payload: LostPayload) {
    const customer = lost.customer;
    setLost({ open: false, customer: null });
    if (!customer) return;
    const ok = await patchCustomer(customer.id, {
      funnelStage: "lost",
      lossReason: payload.lossReason,
      lostNote: payload.lostNote,
      lostCompetitor: payload.lostCompetitor,
      lostBy: person,
    });
    if (!ok) return;
    await addActivity(customer.id, `MẤT KHÁCH: ${payload.lossReason}${payload.lostCompetitor ? ` · ${payload.lostCompetitor}` : ""}${payload.lostNote ? ` · ${payload.lostNote}` : ""}`);
    setToast("Đã đánh dấu không chốt");
    await refreshCore();
  }

  function openNewTask(type: string, customerId: number | null = null) {
    setTaskForm({ title: "", type, dueDate: todayISO(), dueTime: "", assignedTo: person, notes: "", customerId });
    setShowTaskForm(true);
  }

  async function submitTaskForm(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taskForm) });
    const data = await res.json();
    if (!res.ok) { setToast(data.error ?? "Không tạo được công việc."); return; }
    setShowTaskForm(false);
    setToast("Đã thêm công việc");
    await fetchTasks();
  }

  const naInitial = useMemo(() => {
    if (na.mode === "edit" && na.customer) {
      return { actionType: na.customer.nextActionType || "goi_khach", nextAction: na.customer.nextAction, nextContactDate: na.customer.nextContactDate || today, nextActionTime: na.customer.nextActionTime || "09:00" };
    }
    return undefined;
  }, [na, today]);

  const customerProjects = selected ? projects.filter((p) => p.customerId === selected.id) : [];
  const selectedTasks = selected ? visibleTasks.filter((t) => t.customerId === selected.id) : [];

  const NAV: { key: ViewKey; icon: string; label: string; badge?: number }[] = [
    { key: "dashboard", icon: "⌂", label: "Dashboard" },
    { key: "today", icon: "✓", label: "Việc hôm nay", badge: overdueTasks.length + dueTodayTasks.length + newLeads.length },
    { key: "pipeline", icon: "▤", label: "Pipeline" },
    { key: "customers", icon: "◎", label: "Khách hàng", badge: visibleCustomers.length },
    { key: "appointments", icon: "□", label: "Lịch" },
    { key: "projects", icon: "⌗", label: "Công trình" },
    { key: "completed", icon: "≡", label: "Việc đã làm" },
    { key: "metrics", icon: "%", label: "Báo cáo" },
    { key: "suppliers", icon: "▦", label: "Nhà cung cấp" },
    { key: "settings", icon: "⚙", label: "Cài đặt" },
  ];

  return (
    <div className="simple-crm">
      <aside className="simple-sidebar">
        <div className="simple-brand">
          <img src="/tien-nga-logo.jpg" alt="Tiến Nga Home" className="mobile-logo-frame" style={{ width: 42, height: 42, borderRadius: 12 }} />
          <div><strong>Tiến Nga Home</strong><small>CRM BÁN HÀNG B2C</small></div>
        </div>
        <nav>
          {NAV.map((item) => (
            <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>
              <i>{item.icon}</i><span>{item.label}</span>{item.badge ? <em>{item.badge}</em> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>!</span>
          <div><strong>{notifTotal} mục cần chú ý</strong><small>Mở “Việc hôm nay” để xử lý trước.</small></div>
        </div>
      </aside>

      <main className="simple-main">
        <div className="simple-topbar">
          <div className="global-search">
            <input placeholder="Tìm khách theo tên, SĐT, địa chỉ, công trình..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((c) => (
                  <button key={c.id} onClick={() => openCustomerById(c.id)}>
                    <strong>{c.fullName}</strong>
                    <small>{c.phone} · {c.ward || "—"} · {FUNNEL_STAGE_LABEL[c.funnelStage]}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="topbar-right">
            <div className="notif-wrap">
              <button className="notif-bell" onClick={() => setShowNotif((v) => !v)}>🔔{notifTotal ? <em>{notifTotal}</em> : null}</button>
              {showNotif && (
                <div className="notif-pop">
                  <NotifRow label="Việc quá hạn" count={overdueTasks.length} onClick={() => { setView("today"); setShowNotif(false); }} tone="danger" />
                  <NotifRow label="Khách chưa liên hệ" count={newLeads.length} onClick={() => { setView("today"); setShowNotif(false); }} tone="danger" />
                  <NotifRow label="Lịch showroom hôm nay" count={showroomToday.length} onClick={() => { setView("today"); setShowNotif(false); }} tone="info" />
                  <NotifRow label="Khảo sát công trình hôm nay" count={siteVisitToday.length} onClick={() => { setView("today"); setShowNotif(false); }} tone="info" />
                  <NotifRow label="Khách HOT đang chờ" count={hotCustomers.length} onClick={() => { setView("today"); setShowNotif(false); }} tone="warm" />
                </div>
              )}
            </div>
            <div className="entry-person">
              <span className={`role-pill ${role}`}>{ROLE_LABEL[role]}</span>
              <select value={person} onChange={(e) => choosePerson(e.target.value)}>
                {TEAM_MEMBERS.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {!loaded ? (
          <div className="simple-page"><div className="empty-state"><strong>Đang tải dữ liệu...</strong></div></div>
        ) : view === "dashboard" ? (
          <Dashboard
            person={person} isManager={isManager} customers={visibleCustomers}
            newLeadsToday={newLeads} overdueTasks={overdueTasks} hotCustomers={hotCustomers}
            showroomToday={showroomToday} siteVisitToday={siteVisitToday}
            pipelineValue={pipelineValue} wonRevenue={wonRevenue}
            stageCounts={stageCounts} totalCustomers={visibleCustomers.length}
            onOpenCustomer={(id) => openCustomerById(id)} onAddCustomer={() => { setFormCustomer(null); setFormMode("create"); }}
            onGoStage={(stage) => { setStageFilter(stage); setView("customers"); }}
          />
        ) : view === "today" ? (
          <TodayView
            person={person} tasks={actionableTasks} customers={visibleCustomers} today={today}
            onOpenCustomer={openCustomerById} onComplete={completeTaskFlow} onAddTask={() => openNewTask("followup")}
          />
        ) : view === "pipeline" ? (
          <PipelineBoard
            customers={visibleCustomers} tasksByCustomer={tasksByCustomer} today={today}
            onOpen={setSelected} onChangeStage={changeStage} onRequestLost={(c) => setLost({ open: true, customer: c })}
          />
        ) : view === "customers" ? (
          <CustomersTable
            customers={filteredCustomers} count={filteredCustomers.length} person={person}
            stageFilter={stageFilter} setStageFilter={setStageFilter}
            priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter}
            ownerFilter={ownerFilter} setOwnerFilter={setOwnerFilter}
            sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
            today={today}
            onOpen={setSelected} onAddCustomer={() => { setFormCustomer(null); setFormMode("create"); }}
          />
        ) : view === "appointments" ? (
          <AppointmentsBoard tasks={actionableTasks} onComplete={completeTaskFlow} onAddAppointment={() => openNewTask("appointment")} />
        ) : view === "projects" ? (
          <ProjectsView projects={projects} customers={customers} person={person} onToast={setToast} onRefresh={refreshAll} presetCustomerId={presetProjectCustomerId} onConsumePreset={() => setPresetProjectCustomerId(null)} />
        ) : view === "completed" ? (
          <CompletedBoard tasks={visibleTasks} />
        ) : view === "metrics" ? (
          <MetricsView metrics={metrics} customers={visibleCustomers} person={person} onToast={setToast} onRefresh={fetchMetrics} />
        ) : view === "settings" ? (
          <Settings role={role} restrictByOwner={restrictByOwner} onToggleRestrict={chooseRestrict} />
        ) : (
          <SupplierDirectory person={person} createSignal={0} />
        )}
      </main>

      {selected && (
        <CustomerDetail
          customer={selected} activities={activities} tasks={selectedTasks} projects={customerProjects} person={person}
          onClose={() => setSelected(null)}
          onEdit={(c) => { setFormCustomer(c); setFormMode("edit"); }}
          onAddNote={async (text) => { const ok = await addActivity(selected.id, text); if (ok) { setToast("Đã lưu tương tác"); await refreshCore(); } }}
          onCompleteNextAction={onCompleteNextAction}
          onEditNextAction={(c) => setNa({ open: true, customer: c, task: null, mode: "edit" })}
          onCreateNextAction={(c) => setNa({ open: true, customer: c, task: null, mode: "create" })}
          onChangeStage={changeStage}
          onRequestLost={(c) => setLost({ open: true, customer: c })}
          onDelete={deleteCustomer}
        />
      )}

      {formMode && (
        <CustomerForm mode={formMode} customer={formMode === "edit" ? formCustomer : null} person={person} saving={saving} onSubmit={submitCustomerForm} onClose={() => setFormMode(null)} />
      )}

      <NextActionModal
        open={na.open} customerName={na.customer?.fullName}
        heading={na.mode === "complete" ? "Việc tiếp theo với khách hàng này là gì?" : na.mode === "edit" ? "Đổi lịch / sửa việc tiếp theo" : "Tạo việc tiếp theo"}
        initial={naInitial}
        onSubmit={applyNextAction}
        onClose={() => setNa({ open: false, customer: null, task: null, mode: "create" })}
        onSkip={na.mode === "complete" ? () => { setNa({ open: false, customer: null, task: null, mode: "create" }); setToast("Đã hoàn thành việc"); refreshCore(); } : undefined}
      />

      <LostReasonModal open={lost.open} customerName={lost.customer?.fullName} onSubmit={applyLost} onClose={() => setLost({ open: false, customer: null })} />

      <WonModal open={won.open} customer={won.customer} onSubmit={applyWon} onClose={() => setWon({ open: false, customer: null })} />

      {showTaskForm && (
        <div className="modal-overlay">
          <div className="simple-modal">
            <div className="modal-title"><h2>Thêm công việc</h2><button className="close-button" onClick={() => setShowTaskForm(false)}>×</button></div>
            <form onSubmit={submitTaskForm} className="modal-grid-flow">
              <input placeholder="Tên công việc" required value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} />
              <select value={taskForm.type} onChange={(e) => setTaskForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="call">Gọi điện</option>
                <option value="followup">Theo dõi</option>
                <option value="appointment">Lịch hẹn</option>
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input type="date" required value={taskForm.dueDate} onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))} />
                <input type="time" value={taskForm.dueTime} onChange={(e) => setTaskForm((p) => ({ ...p, dueTime: e.target.value }))} />
              </div>
              <select value={taskForm.assignedTo} onChange={(e) => setTaskForm((p) => ({ ...p, assignedTo: e.target.value }))}>
                {TEAM_MEMBERS.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select value={taskForm.customerId ?? ""} onChange={(e) => setTaskForm((p) => ({ ...p, customerId: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Không gắn khách hàng cụ thể</option>
                {visibleCustomers.map((c) => <option key={c.id} value={c.id}>{c.fullName} · {c.phone}</option>)}
              </select>
              <textarea placeholder="Ghi chú" value={taskForm.notes} onChange={(e) => setTaskForm((p) => ({ ...p, notes: e.target.value }))} />
              <div className="modal-actions">
                <button type="button" className="outline-button" onClick={() => setShowTaskForm(false)}>Huỷ</button>
                <button type="submit" className="save-button">Lưu công việc</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="simple-toast">{toast}</div>}
    </div>
  );
}

function NotifRow({ label, count, onClick, tone }: { label: string; count: number; onClick: () => void; tone: string }) {
  return (
    <button className={`notif-row ${tone}`} onClick={onClick}>
      <span>{label}</span><em>{count}</em>
    </button>
  );
}

// ---------------- Dashboard ----------------
function Dashboard(props: {
  person: string; isManager: boolean; customers: Customer[];
  newLeadsToday: Customer[]; overdueTasks: Task[]; hotCustomers: Customer[];
  showroomToday: Customer[]; siteVisitToday: Customer[];
  pipelineValue: number; wonRevenue: number;
  stageCounts: Map<string, number>; totalCustomers: number;
  onOpenCustomer: (id: number) => void; onAddCustomer: () => void; onGoStage: (stage: string) => void;
}) {
  const { customers, newLeadsToday, overdueTasks, hotCustomers, showroomToday, siteVisitToday, pipelineValue, wonRevenue, onOpenCustomer, onAddCustomer, onGoStage } = props;
  // Đếm theo mốc — nhất quán với Big Map: Chưa liên hệ (đầu) + 9 giai đoạn + Không chốt (cuối).
  const funnelCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of customers) {
      let key: string;
      if (c.contactResult === "chua_lien_he" && c.funnelStage !== "lost") key = "uncontacted";
      else if (c.funnelStage === "lost") key = "lost";
      else key = (PIPELINE_STAGES as readonly string[]).includes(c.funnelStage) ? c.funnelStage : (STAGE_ALIAS[c.funnelStage] ?? "");
      if (key) m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [customers]);
  const cards = [
    { label: "Chưa liên hệ", value: newLeadsToday.length, tone: "danger" },
    { label: "Việc quá hạn", value: overdueTasks.length, tone: "danger" },
    { label: "Khách HOT", value: hotCustomers.length, tone: "warm" },
    { label: "Showroom hôm nay", value: showroomToday.length, tone: "info" },
    { label: "Khảo sát hôm nay", value: siteVisitToday.length, tone: "info" },
    { label: "Giá trị pipeline", value: money(pipelineValue), tone: "green", big: true },
    { label: "Doanh thu chốt", value: money(wonRevenue), tone: "green", big: true },
  ];
  return (
    <div className="simple-page">
      <section className="welcome-row dashboard-welcome">
        <div><p>BẢN ĐỒ BÁN HÀNG HÔM NAY</p><h1>Dashboard điều hành</h1><span>Ai đang bỏ quên lead, việc nào quá hạn, tiền đang nằm ở đâu.</span></div>
        <button className="mobile-add" onClick={onAddCustomer}>＋ Thêm khách</button>
      </section>

      <div style={{ marginBottom: 16 }}>
        <PipelineMap customers={customers} onOpen={(c) => onOpenCustomer(c.id)} />
      </div>

      <section className="dash-cards">
        {cards.map((c) => (
          <div key={c.label} className={`dash-card ${c.tone}${c.big ? " big" : ""}`}>
            <span>{c.label}</span><strong>{c.value}</strong>
          </div>
        ))}
      </section>

      <div className="map-card" style={{ marginTop: 16 }}>
        <div className="dashboard-card-title"><strong>Phễu pipeline</strong><span>{props.totalCustomers} khách</span></div>
        <div className="pipeline-track">
          <button style={{ ["--stage" as string]: "#8b8b8b" }} onClick={() => onGoStage("uncontacted")}>
            <div className="stage-step">{funnelCounts.get("uncontacted") ?? 0}</div>
            <small>Chưa liên hệ</small>
          </button>
          {PIPELINE_STAGES.map((stage) => (
            <button key={stage} style={{ ["--stage" as string]: FUNNEL_STAGE_COLOR[stage] }} onClick={() => onGoStage(stage)}>
              <div className="stage-step">{funnelCounts.get(stage) ?? 0}</div>
              <small>{FUNNEL_STAGE_LABEL[stage]}</small>
            </button>
          ))}
          <button style={{ ["--stage" as string]: "#94a3a0" }} onClick={() => onGoStage("lost")}>
            <div className="stage-step">{funnelCounts.get("lost") ?? 0}</div>
            <small>Không chốt</small>
          </button>
        </div>
      </div>

      <div className="dashboard-lower" style={{ marginTop: 16 }}>
        <DashList title="Việc quá hạn" tone="danger" empty="Không có việc quá hạn.">
          {overdueTasks.slice(0, 8).map((t) => (
            <button key={t.id} className="dash-row" onClick={() => t.customerId && onOpenCustomer(t.customerId)}>
              <strong>{t.customerName || t.title}</strong><small>{t.title} · {formatDate(t.dueDate)} · {t.assignedTo}</small>
            </button>
          ))}
        </DashList>
        <DashList title="Khách HOT cần chăm" tone="warm" empty="Không có khách nóng đang chờ.">
          {hotCustomers.slice(0, 8).map((c) => (
            <button key={c.id} className="dash-row" onClick={() => onOpenCustomer(c.id)}>
              <strong>{c.fullName}</strong><small>{c.nextAction || "Chưa có việc tiếp theo"} · {c.owner}</small>
            </button>
          ))}
        </DashList>
        <DashList title="Khách chưa liên hệ" tone="danger" empty="Không còn khách nào chờ liên hệ.">
          {newLeadsToday.slice(0, 8).map((c) => (
            <button key={c.id} className="dash-row" onClick={() => onOpenCustomer(c.id)}>
              <strong>{c.fullName}</strong><small>{c.source} · {c.ward || "—"} · {c.owner}</small>
            </button>
          ))}
        </DashList>
      </div>
    </div>
  );
}

function DashList({ title, tone, empty, children }: { title: string; tone: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.filter(Boolean).length === 0;
  return (
    <div className={`map-card dash-list ${tone}`}>
      <div className="dashboard-card-title"><strong>{title}</strong></div>
      <div className="dash-list-body">{isEmpty ? <div className="radar-empty">{empty}</div> : children}</div>
    </div>
  );
}

// ---------------- Customers table ----------------
const SEGMENTS: { key: string; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "mine", label: "Của tôi" },
  { key: "hot", label: "🔥 Nóng" },
  { key: "new", label: "Chưa liên hệ" },
  { key: "quote", label: "Cần follow báo giá" },
  { key: "overdue", label: "Quá hạn" },
];

function passSegment(c: Customer, seg: string, person: string, today: string): boolean {
  const active = !["won", "aftercare", "delivering", "lost", "paused"].includes(c.funnelStage);
  switch (seg) {
    case "mine": return c.owner === person;
    case "hot": return c.priority === "hot" && active;
    case "new": return c.funnelStage === "lead" && c.contactResult === "chua_lien_he";
    case "quote": return c.funnelStage === "quoted";
    case "overdue": return /^\d{4}-\d{2}-\d{2}$/.test(c.nextContactDate) && c.nextContactDate < today;
    default: return true;
  }
}

const PAGE_SIZE = 25;

function CustomersTable(props: {
  customers: Customer[]; count: number; today: string; person: string;
  stageFilter: string; setStageFilter: (v: string) => void;
  priorityFilter: string; setPriorityFilter: (v: string) => void;
  ownerFilter: string; setOwnerFilter: (v: string) => void;
  sourceFilter: string; setSourceFilter: (v: string) => void;
  onOpen: (c: Customer) => void; onAddCustomer: () => void;
}) {
  const { customers, today, person, stageFilter, setStageFilter, priorityFilter, setPriorityFilter, ownerFilter, setOwnerFilter, sourceFilter, setSourceFilter, onOpen, onAddCustomer } = props;
  const COLS = "1.6fr 1fr 1fr 0.9fr 1fr 0.8fr 1.6fr";
  const [segment, setSegment] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const segmented = useMemo(() => customers.filter((c) => passSegment(c, segment, person, today)), [customers, segment, person, today]);
  const shown = segmented.slice(0, limit);

  function chooseSegment(key: string) { setSegment(key); setLimit(PAGE_SIZE); }

  return (
    <div className="simple-page">
      <section className="welcome-row customer-hub-welcome">
        <div><p>TRUNG TÂM KHÁCH HÀNG</p><h1>Toàn cảnh khách hàng & cơ hội</h1><span>Ai đang ở đâu, cần gì, ai phụ trách và bước tiếp theo là gì.</span></div>
        <button className="mobile-add" onClick={onAddCustomer}>＋ Thêm khách</button>
      </section>

      <div className="seg-chips">
        {SEGMENTS.map((s) => (
          <button key={s.key} className={segment === s.key ? "active" : ""} onClick={() => chooseSegment(s.key)}>{s.label}</button>
        ))}
      </div>

      <section className="customer-hub-filters">
        <select value={stageFilter} onChange={(e) => { setStageFilter(e.target.value); setLimit(PAGE_SIZE); }}>
          <option value="all">Tất cả giai đoạn</option>
          {funnelStageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setLimit(PAGE_SIZE); }}>
          <option value="all">Tất cả mức độ</option>
          {priorityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={ownerFilter} onChange={(e) => { setOwnerFilter(e.target.value); setLimit(PAGE_SIZE); }}>
          <option value="all">Tất cả sale</option>
          {TEAM_MEMBERS.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setLimit(PAGE_SIZE); }}>
          <option value="all">Tất cả nguồn</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>{segmented.length} khách</span>
      </section>

      <section className="customer-hub-table">
        <div className="crm-table-scroll">
          <div className="crm-table-head" style={{ gridTemplateColumns: COLS }}>
            <span>Khách hàng</span><span>Khu vực</span><span>Giai đoạn</span><span>Mức độ</span><span>Giá trị</span><span>Sale</span><span>Việc tiếp theo</span>
          </div>
          {shown.length === 0 ? (
            <div className="crm-table-empty"><strong>Chưa có khách phù hợp bộ lọc</strong></div>
          ) : shown.map((c) => {
            const overdue = /^\d{4}-\d{2}-\d{2}$/.test(c.nextContactDate) && c.nextContactDate < today;
            const active = !["won", "aftercare", "delivering", "lost", "paused"].includes(c.funnelStage);
            const noNext = active && !(c.nextAction.trim() && /^\d{4}-\d{2}-\d{2}$/.test(c.nextContactDate));
            return (
              <button key={c.id} className="crm-table-row" style={{ gridTemplateColumns: COLS, ["--row-accent" as string]: FUNNEL_STAGE_COLOR[c.funnelStage] }} onClick={() => onOpen(c)}>
                <div className="crm-cell"><strong>{c.fullName}</strong><small>{c.phone}</small></div>
                <div className="crm-cell"><span>{c.ward || "—"}</span></div>
                <div className="crm-cell"><span className="status-pill" style={{ ["--status" as string]: FUNNEL_STAGE_COLOR[c.funnelStage] }}>{FUNNEL_STAGE_LABEL[c.funnelStage]}</span></div>
                <div className="crm-cell"><span className="temp-pill" style={{ ["--temp" as string]: PRIORITY_COLOR[c.priority] }}>{PRIORITY_EMOJI[c.priority]}</span></div>
                <div className="crm-cell"><strong>{money(c.value)}</strong></div>
                <div className="crm-cell"><span>{c.owner}</span></div>
                <div className="crm-cell">
                  {noNext ? <span className="cell-warn">⚠ Chưa có việc</span> : <span className={overdue ? "cell-warn" : ""}>{c.nextAction}{overdue ? " · quá hạn" : ""}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {segmented.length > shown.length && (
          <div className="load-more">
            <button className="outline-button" style={{ width: "auto" }} onClick={() => setLimit((l) => l + PAGE_SIZE)}>
              Xem thêm {Math.min(PAGE_SIZE, segmented.length - shown.length)} khách
            </button>
            <span>Đang hiện {shown.length} / {segmented.length}</span>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------- Settings ----------------
function Settings({ role, restrictByOwner, onToggleRestrict }: { role: string; restrictByOwner: boolean; onToggleRestrict: (v: boolean) => void }) {
  return (
    <div className="simple-page">
      <section className="welcome-row"><div><p>CÀI ĐẶT</p><h1>Cấu hình CRM</h1><span>Phân quyền xem dữ liệu theo sale.</span></div></section>
      <div className="map-card" style={{ padding: 18, maxWidth: 640 }}>
        <div className="dashboard-card-title"><strong>Giới hạn dữ liệu theo sale</strong></div>
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Khi bật: mỗi sale chỉ thấy khách và việc mình phụ trách. Quản lý (admin) luôn thấy toàn bộ, không bị ảnh hưởng bởi công tắc này.
          Vai trò hiện tại của bạn: <strong>{ROLE_LABEL[role]}</strong>.
        </p>
        <label className="switch-row">
          <input type="checkbox" checked={restrictByOwner} onChange={(e) => onToggleRestrict(e.target.checked)} />
          <span>{restrictByOwner ? "Đang BẬT — sale chỉ thấy dữ liệu của mình" : "Đang TẮT — mọi người thấy toàn bộ"}</span>
        </label>
      </div>
    </div>
  );
}
