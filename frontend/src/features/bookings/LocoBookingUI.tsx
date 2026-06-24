import { useState, useEffect, useCallback } from "react";
import { Train, ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../shared/services/api";
import { AxiosError } from "axios";
import ThemeToggle from "../../shared/components/ThemeToggle";
import LocoBookingTabs from "./components/loco/LocoBookingTabs";
import LocoBookingForm from "./components/loco/LocoBookingForm";
import LocoBookingList from "./components/loco/LocoBookingList";
import LocoBookingHistory from "./components/loco/LocoBookingHistory";
import "./LocoBooking.css";

/* ── types ─────────────────────────────────────────────────────────── */
interface Loco { loco_number: string; loco_type_id: number; date_time: string; stage: number; shift: number; despatched: boolean; }
interface LocoType { loco_type_id: number; loco_type_name: string; }
interface Job { job_id: number; job_description: string; stage: number; }
interface RawBooking {
  loco_number: string; date_time: string; job_id: number; job_description: string;
  task_id: number | null; task_description: string | null;
  ticket_number: number; employee_name: string; shift: number;
}

/* ── helpers ────────────────────────────────────────────────────────── */
const getLocalDateString = (dateInput: Date | string) => {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayISO = () => getLocalDateString(new Date());

const guessShift = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 1;
  if (h >= 14 && h < 22) return 2;
  return 1; // Default fallback for off-shift night hours
};

function groupBookings(list: RawBooking[]) {
  const groups: Record<string, Record<number, Record<string, { employee_name: string; date_time: string; jobs: Record<number, { job_description: string; tasks: { id: number, desc: string }[] }> }>>> = {};
  list.forEach((b) => {
    const dateStr = new Date(b.date_time).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const shift = b.shift;
    const loco = b.loco_number;
    if (!groups[dateStr]) groups[dateStr] = {};
    if (!groups[dateStr][shift]) groups[dateStr][shift] = {};
    if (!groups[dateStr][shift][loco]) groups[dateStr][shift][loco] = { employee_name: b.employee_name, date_time: b.date_time, jobs: {} };
    if (!groups[dateStr][shift][loco].jobs[b.job_id])
      groups[dateStr][shift][loco].jobs[b.job_id] = { job_description: b.job_description, tasks: [] };
    if (b.task_description && b.task_id)
      groups[dateStr][shift][loco].jobs[b.job_id].tasks.push({ id: b.task_id, desc: b.task_description });
  });
  return groups;
}

/* ── component ──────────────────────────────────────────────────────── */
const LocoBookingUI = () => {
  const navigate = useNavigate();

  /* data */
  const [locos, setLocos] = useState<Loco[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [locoTypes, setLocoTypes] = useState<LocoType[]>([]);
  const [bookings, setBookings] = useState<RawBooking[]>([]);
  const [todayBookings, setTodayBookings] = useState<RawBooking[]>([]);

  /* search + selection */
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLoco, setSelectedLoco] = useState<Loco | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<Job[]>([]);
  const [jobTasks, setJobTasks] = useState<Record<number, string[]>>({});
  const [taskInputs, setTaskInputs] = useState<Record<number, string>>({});

  /* booking date/shift (user-supplied) */
  const [bookingDate, setBookingDate] = useState(todayISO());
  const [bookingShift, setBookingShift] = useState<number>(guessShift());

  /* add-loco form */
  const [isAddingLoco, setIsAddingLoco] = useState(false);
  const [newLcoNum, setNewLcoNum] = useState("");
  const [newLcoType, setNewLcoType] = useState("");
  const [newLcoStage, setNewLcoStage] = useState("5");
  const [newLcoShift, setNewLcoShift] = useState("1");
  const [showStage6, setShowStage6] = useState(false);

  /* tabs */
  const [activeTab, setActiveTab] = useState<"booking" | "list" | "history">("booking");
  const [expandedLocos, setExpandedLocos] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [collapsedShifts, setCollapsedShifts] = useState<Set<string>>(new Set());

  /* list & history search/filter states */
  const [historyBookings, setHistoryBookings] = useState<RawBooking[]>([]);
  const [listSearch, setListSearch] = useState("");
  const [listShift, setListShift] = useState<string>("all");

  const [historySearch, setHistorySearch] = useState("");
  const [historyShift, setHistoryShift] = useState<string>("all");

  const [historyStartDate, setHistoryStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getLocalDateString(d);
  });
  const [historyEndDate, setHistoryEndDate] = useState(todayISO);

  /* misc */
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  /* edit modal states */
  const [editingJob, setEditingJob] = useState<{ locoNum: string; dateTime: string; oldJobId: number; newJobId: number } | null>(null);
  const [editingTask, setEditingTask] = useState<{ taskId: number; description: string } | null>(null);

  /* add single job/task modal/input states */
  const [addingJobLoco, setAddingJobLoco] = useState<{ locoNum: string; dateTime: string; shift: number } | null>(null);
  const [selectedAddJobId, setSelectedAddJobId] = useState<number | "">("");
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});

  /* ── access guard ── */
  useEffect(() => {
    api.get("/auth/me").then(r => {
      if (!r.data.is_supervisor) { alert("Access Denied: Supervisor only area."); navigate("/dashboard", { replace: true }); }
    }).catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  /* ── fetch initial data ── */
  const fetchData = useCallback(async () => {
    if (!bookingDate) return;
    const today = todayISO();
    const promises = [
      api.get("/locos/"),
      api.get("/jobs/"),
      api.get("/locos/types"),
      api.get(`/bookings/?start_date=${bookingDate}&end_date=${bookingDate}`),
    ];
    if (bookingDate !== today) {
      promises.push(api.get(`/bookings/?start_date=${today}&end_date=${today}`));
    }
    const [locosRes, jobsRes, typesRes, bookingsRes, todayBookingsRes] = await Promise.all(promises);
    setLocos(locosRes.data);
    setJobs(jobsRes.data);
    setLocoTypes(typesRes.data);
    setBookings(bookingsRes.data);
    if (bookingDate === today) {
      setTodayBookings(bookingsRes.data);
    } else if (todayBookingsRes) {
      setTodayBookings(todayBookingsRes.data);
    }
  }, [bookingDate]);

  const fetchHistoryData = useCallback(async () => {
    if (!historyStartDate || !historyEndDate) return;
    try {
      const res = await api.get(`/bookings/?start_date=${historyStartDate}&end_date=${historyEndDate}`);
      setHistoryBookings(res.data);
    } catch (err) {
      console.error("Failed to fetch history bookings", err);
    }
  }, [historyStartDate, historyEndDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "history") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchHistoryData();
    }
  }, [activeTab, fetchHistoryData]);

  /* ── loco type name helper ── */
  const typeName = (id: number) => locoTypes.find(t => t.loco_type_id === id)?.loco_type_name ?? String(id);

  /* ── when date or shift changes, reload preloaded booking ── */
  useEffect(() => {
    if (!selectedLoco) return;
    const existing = bookings.filter(b =>
      b.loco_number === selectedLoco.loco_number &&
      b.shift === bookingShift &&
      getLocalDateString(b.date_time) === bookingDate
    );
    if (existing.length > 0) {
      const preJobs: Job[] = [];
      const preTasks: Record<number, string[]> = {};
      existing.forEach(b => {
        const jobObj = jobs.find(j => j.job_id === b.job_id);
        if (jobObj && !preJobs.some(j => j.job_id === jobObj.job_id)) preJobs.push(jobObj);
        if (b.task_description) { if (!preTasks[b.job_id]) preTasks[b.job_id] = []; preTasks[b.job_id].push(b.task_description); }
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedJobs(preJobs);
      setJobTasks(preTasks);
      setMessage("Editing existing booking for this locomotive.");
    } else {
      setSelectedJobs([]);
      setJobTasks({});
      setMessage("");
    }
  }, [bookingDate, bookingShift, selectedLoco, bookings, jobs]);

  /* ── add new loco ── */
  const handleAddLocoSubmit = async () => {
    if (!newLcoNum || !newLcoType) return;
    setLoading(true);
    try {
      const stageInt = parseInt(newLcoStage);
      const res = await api.post("/locos/", {
        loco_number: newLcoNum.trim(), loco_type_id: parseInt(newLcoType),
        date_time: new Date().toISOString(), stage: stageInt, shift: parseInt(newLcoShift),
        despatched: stageInt === 9
      });
      const nl: Loco = res.data;
      setLocos(p => [...p, nl]); setSelectedLoco(nl); setSearchTerm(nl.loco_number);
      setIsAddingLoco(false); setNewLcoNum(""); setNewLcoType("");
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert("Failed to add locomotive: " + (axiosError.response?.data?.detail ?? "Unknown error"));
    }
    finally { setLoading(false); }
  };

  /* ── job selection ── */
  const handleToggleJob = (job: Job) => {
    if (selectedJobs.some(j => j.job_id === job.job_id)) {
      setSelectedJobs(p => p.filter(j => j.job_id !== job.job_id));
      setJobTasks(p => { const n = { ...p }; delete n[job.job_id]; return n; });
    } else {
      setSelectedJobs(p => [...p, job]);
      setJobTasks(p => ({ ...p, [job.job_id]: [] }));
    }
  };

  /* ── task management ── */
  const handleAddTask = (jobId: number) => {
    const desc = taskInputs[jobId]?.trim(); if (!desc) return;
    setJobTasks(p => ({ ...p, [jobId]: [...(p[jobId] || []), desc] }));
    setTaskInputs(p => ({ ...p, [jobId]: "" }));
  };
  const handleRemoveTask = (jobId: number, idx: number) =>
    setJobTasks(p => ({ ...p, [jobId]: p[jobId].filter((_, i) => i !== idx) }));

  /* ── save booking ── */
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDate) {
      alert("Please select a booking date.");
      return;
    }
    if (!selectedLoco || selectedJobs.length === 0) return;
    setLoading(true); setMessage("");
    try {
      // Build datetime from chosen date + current time-of-day
      const dateTimeISO = new Date(`${bookingDate}T${new Date().toTimeString().slice(0, 8)}`).toISOString();
      await api.post("/bookings/", {
        loco_number: selectedLoco.loco_number,
        date_time: dateTimeISO,
        shift: bookingShift,
        bookings: selectedJobs.map(job => ({
          job_id: job.job_id,
          tasks: (jobTasks[job.job_id] || []).map(t => ({ task_description: t })),
        })),
      });
      setMessage("Locomotive booking saved successfully!");
      setSelectedLoco(null); setSelectedJobs([]); setJobTasks({}); setSearchTerm("");
      fetchData();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setMessage("Booking failed: " + (axiosError.response?.data?.detail ?? "Unknown error"));
    }
    finally { setLoading(false); }
  };

  /* ── main bookings feed ── */

  /* accordion utility */

  const toggleLoco = (key: string) => {
    setExpandedLocos(p => {
      const n = new Set(p);
      if (n.has(key)) {
        n.delete(key);
      } else {
        n.add(key);
      }
      return n;
    });
  };

  const toggleDate = (key: string) => {
    setCollapsedDates(p => {
      const n = new Set(p);
      if (n.has(key)) {
        n.delete(key);
      } else {
        n.add(key);
      }
      return n;
    });
  };

  const toggleShift = (key: string) => {
    setCollapsedShifts(p => {
      const n = new Set(p);
      if (n.has(key)) {
        n.delete(key);
      } else {
        n.add(key);
      }
      return n;
    });
  };

  const handleDeleteJob = async (locoNum: string, dateTime: string, jobId: number) => {
    if (!confirm("Delete this job?")) return;
    try { await api.delete(`/bookings/${locoNum}/${dateTime}/${jobId}`); fetchData(); }
    catch { alert("Failed to delete job"); }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("Delete this task?")) return;
    try { await api.delete(`/bookings/tasks/${taskId}`); fetchData(); }
    catch { alert("Failed to delete task"); }
  };

  const handleEditTask = (taskId: number, oldDesc: string) => {
    setEditingTask({ taskId, description: oldDesc });
  };

  const handleEditJob = (locoNum: string, dateTime: string, oldJobId: number) => {
    setEditingJob({ locoNum, dateTime, oldJobId, newJobId: oldJobId });
  };

  const handleDeleteLocoBooking = async (locoNum: string, dateTime: string) => {
    if (!confirm(`Delete all bookings for Locomotive #${locoNum} on this shift?`)) return;
    try {
      await api.delete(`/bookings/${locoNum}/${dateTime}`);
      fetchData();
    } catch {
      alert("Failed to delete locomotive booking");
    }
  };

  const handleAddSingleTask = async (locoNum: string, dateTime: string, jobId: number) => {
    const key = `${locoNum}-${dateTime}-${jobId}`;
    const desc = newTaskInputs[key]?.trim();
    if (!desc) return;
    try {
      await api.post("/bookings/tasks", {
        loco_number: locoNum,
        date_time: dateTime,
        job_id: jobId,
        task_description: desc
      });
      setNewTaskInputs(p => ({ ...p, [key]: "" }));
      fetchData();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      alert("Failed to add task: " + (axiosError.response?.data?.detail ?? "Unknown error"));
    }
  };

  const filteredTodayBookings = todayBookings.filter(b => {
    const matchesSearch = b.loco_number.toString().includes(listSearch.trim());
    const matchesShift = listShift === "all" || b.shift.toString() === listShift;
    const matchesStage = showStage6 || (() => {
      const loco = locos.find(l => l.loco_number.toString() === b.loco_number.toString());
      return loco ? loco.stage !== 6 : true;
    })();
    return getLocalDateString(b.date_time) === todayISO() && matchesSearch && matchesShift && matchesStage;
  });
  const groupedToday = groupBookings(filteredTodayBookings);

  const filteredHistoryBookings = historyBookings.filter(b => {
    const matchesSearch = b.loco_number.toString().includes(historySearch.trim());
    const matchesShift = historyShift === "all" || b.shift.toString() === historyShift;
    const matchesStage = showStage6 || (() => {
      const loco = locos.find(l => l.loco_number.toString() === b.loco_number.toString());
      return loco ? loco.stage !== 6 : true;
    })();
    return matchesSearch && matchesShift && matchesStage;
  });
  const groupedAll = groupBookings(filteredHistoryBookings);

  // View Control Actions for Today's Booking List
  const expandAllToday = () => {
    const datesToExpand: string[] = [];
    const shiftsToExpand: string[] = [];
    const locosToExpand: string[] = [];

    Object.keys(groupedToday).forEach(dateStr => {
      datesToExpand.push(dateStr);
      Object.keys(groupedToday[dateStr]).forEach(shiftStr => {
        const shift = parseInt(shiftStr);
        shiftsToExpand.push(`${dateStr}-${shift}`);
        Object.keys(groupedToday[dateStr][shift]).forEach(locoStr => {
          locosToExpand.push(`${dateStr}-${shift}-${locoStr}`);
        });
      });
    });

    setCollapsedDates(prev => {
      const next = new Set(prev);
      datesToExpand.forEach(d => next.delete(d));
      return next;
    });
    setCollapsedShifts(prev => {
      const next = new Set(prev);
      shiftsToExpand.forEach(s => next.delete(s));
      return next;
    });
    setExpandedLocos(prev => {
      const next = new Set(prev);
      locosToExpand.forEach(l => next.add(l));
      return next;
    });
  };

  const collapseAllToday = () => {
    const datesToCollapse: string[] = [];
    const shiftsToCollapse: string[] = [];
    const locosToCollapse: string[] = [];

    Object.keys(groupedToday).forEach(dateStr => {
      datesToCollapse.push(dateStr);
      Object.keys(groupedToday[dateStr]).forEach(shiftStr => {
        const shift = parseInt(shiftStr);
        shiftsToCollapse.push(`${dateStr}-${shift}`);
        Object.keys(groupedToday[dateStr][shift]).forEach(locoStr => {
          locosToCollapse.push(`${dateStr}-${shift}-${locoStr}`);
        });
      });
    });

    setCollapsedDates(prev => {
      const next = new Set(prev);
      datesToCollapse.forEach(d => next.add(d));
      return next;
    });
    setCollapsedShifts(prev => {
      const next = new Set(prev);
      shiftsToCollapse.forEach(s => next.add(s));
      return next;
    });
    setExpandedLocos(prev => {
      const next = new Set(prev);
      locosToCollapse.forEach(l => next.delete(l));
      return next;
    });
  };

  // View Control Actions for Booking History
  const expandAllHistory = () => {
    const datesToExpand: string[] = [];
    const shiftsToExpand: string[] = [];
    const locosToExpand: string[] = [];

    Object.keys(groupedAll).forEach(dateStr => {
      datesToExpand.push(`hist-${dateStr}`);
      Object.keys(groupedAll[dateStr]).forEach(shiftStr => {
        const shift = parseInt(shiftStr);
        shiftsToExpand.push(`hist-${dateStr}-${shift}`);
        Object.keys(groupedAll[dateStr][shift]).forEach(locoStr => {
          locosToExpand.push(`hist-${dateStr}-${shift}-${locoStr}`);
        });
      });
    });

    setCollapsedDates(prev => {
      const next = new Set(prev);
      datesToExpand.forEach(d => next.delete(d));
      return next;
    });
    setCollapsedShifts(prev => {
      const next = new Set(prev);
      shiftsToExpand.forEach(s => next.delete(s));
      return next;
    });
    setExpandedLocos(prev => {
      const next = new Set(prev);
      locosToExpand.forEach(l => next.add(l));
      return next;
    });
  };

  const collapseAllHistory = () => {
    const datesToCollapse: string[] = [];
    const shiftsToCollapse: string[] = [];
    const locosToCollapse: string[] = [];

    Object.keys(groupedAll).forEach(dateStr => {
      datesToCollapse.push(`hist-${dateStr}`);
      Object.keys(groupedAll[dateStr]).forEach(shiftStr => {
        const shift = parseInt(shiftStr);
        shiftsToCollapse.push(`hist-${dateStr}-${shift}`);
        Object.keys(groupedAll[dateStr][shift]).forEach(locoStr => {
          locosToCollapse.push(`hist-${dateStr}-${shift}-${locoStr}`);
        });
      });
    });

    setCollapsedDates(prev => {
      const next = new Set(prev);
      datesToCollapse.forEach(d => next.add(d));
      return next;
    });
    setCollapsedShifts(prev => {
      const next = new Set(prev);
      shiftsToCollapse.forEach(s => next.add(s));
      return next;
    });
    setExpandedLocos(prev => {
      const next = new Set(prev);
      locosToCollapse.forEach(l => next.delete(l));
      return next;
    });
  };


  /* ─────────────────────── RENDER ──────────────────────────────────── */
  return (
    <div className="loco-booking-workspace">
      {/* ── HEADER ── */}
      <header className="workspace-header">
        <div className="header-actions">
          <button className="back-btn" onClick={() => navigate("/dashboard")} type="button">
            <ArrowLeft size={18} /> Dashboard
          </button>
          <ThemeToggle />
        </div>
        
        <div className="title-area">
          <Train className="header-icon" />
          <div>
            <h1>Locomotive Work Bookings</h1>
            <p>Assign tasks, schedule jobs, and track workshop activity.</p>
          </div>
        </div>
        
        <LocoBookingTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      </header>

      <div className="workspace-grid">
        {activeTab === 'booking' && (
          <LocoBookingForm
            locos={locos}
            jobs={jobs}
            locoTypes={locoTypes}
            loading={loading}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedLoco={selectedLoco}
            setSelectedLoco={setSelectedLoco}
            selectedJobs={selectedJobs}
            setSelectedJobs={setSelectedJobs}
            jobTasks={jobTasks}
            setJobTasks={setJobTasks}
            taskInputs={taskInputs}
            setTaskInputs={setTaskInputs}
            bookingDate={bookingDate}
            setBookingDate={setBookingDate}
            bookingShift={bookingShift}
            setBookingShift={setBookingShift}
            isAddingLoco={isAddingLoco}
            setIsAddingLoco={setIsAddingLoco}
            newLcoNum={newLcoNum}
            setNewLcoNum={setNewLcoNum}
            newLcoType={newLcoType}
            setNewLcoType={setNewLcoType}
            newLcoStage={newLcoStage}
            setNewLcoStage={setNewLcoStage}
            newLcoShift={newLcoShift}
            setNewLcoShift={setNewLcoShift}
            showStage6={showStage6}
            setShowStage6={setShowStage6}
            handleAddLocoSubmit={handleAddLocoSubmit}
            handleToggleJob={handleToggleJob}
            handleRemoveTask={handleRemoveTask}
            handleAddTask={handleAddTask}
            handleSubmit={handleBookingSubmit}
            message={message}
            setMessage={setMessage}
            typeName={typeName}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'list' && (
          <LocoBookingList
            bookings={bookings}
            locos={locos}
            jobs={jobs}
            locoTypes={locoTypes}
            listSearch={listSearch}
            setListSearch={setListSearch}
            listShift={listShift}
            setListShift={setListShift}
            isEditMode={isEditMode}
            setIsEditMode={setIsEditMode}
            showStage6={showStage6}
            setShowStage6={setShowStage6}
            expandedLocos={expandedLocos}
            toggleLoco={toggleLoco}
            collapsedDates={collapsedDates}
            toggleDate={toggleDate}
            collapsedShifts={collapsedShifts}
            toggleShift={toggleShift}
            expandAllToday={expandAllToday}
            collapseAllToday={collapseAllToday}
            handleDeleteLocoBooking={handleDeleteLocoBooking}
            handleEditJob={handleEditJob}
            handleDeleteJob={handleDeleteJob}
            handleEditTask={handleEditTask}
            handleDeleteTask={handleDeleteTask}
            newTaskInputs={newTaskInputs}
            setNewTaskInputs={setNewTaskInputs}
            handleAddSingleTask={handleAddSingleTask}
            setAddingJobLoco={setAddingJobLoco}
            typeName={typeName}
          />
        )}

        {activeTab === 'history' && (
          <LocoBookingHistory
            historyBookings={historyBookings}
            locos={locos}
            jobs={jobs}
            locoTypes={locoTypes}
            historySearch={historySearch}
            setHistorySearch={setHistorySearch}
            historyShift={historyShift}
            setHistoryShift={setHistoryShift}
            historyStartDate={historyStartDate}
            setHistoryStartDate={setHistoryStartDate}
            historyEndDate={historyEndDate}
            setHistoryEndDate={setHistoryEndDate}
            showStage6={showStage6}
            setShowStage6={setShowStage6}
            expandedLocos={expandedLocos}
            toggleLoco={toggleLoco}
            collapsedDates={collapsedDates}
            toggleDate={toggleDate}
            collapsedShifts={collapsedShifts}
            toggleShift={toggleShift}
            expandAllHistory={expandAllHistory}
            collapseAllHistory={collapseAllHistory}
            isEditMode={isEditMode}
            handleDeleteLocoBooking={handleDeleteLocoBooking}
            handleEditJob={handleEditJob}
            handleDeleteJob={handleDeleteJob}
            handleEditTask={handleEditTask}
            handleDeleteTask={handleDeleteTask}
            newTaskInputs={newTaskInputs}
            setNewTaskInputs={setNewTaskInputs}
            handleAddSingleTask={handleAddSingleTask}
            setAddingJobLoco={setAddingJobLoco}
            typeName={typeName}
          />
        )}
      </div>

      {/* ── EDIT JOB MODAL ── */}
      {editingJob && (
        <div className="modal-overlay" onClick={() => setEditingJob(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Job Assignment</h3>
              <button className="close-modal-btn" onClick={() => setEditingJob(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label className="form-label">Select Job</label>
              <select
                className="modal-select"
                value={editingJob.newJobId}
                onChange={e => setEditingJob({ ...editingJob, newJobId: parseInt(e.target.value) })}
              >
                {jobs.map(j => (
                  <option key={j.job_id} value={j.job_id}>
                    {j.job_description} (Stage {j.stage})
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setEditingJob(null)}>Cancel</button>
              <button
                className="btn-submit"
                onClick={async () => {
                  try {
                    await api.put(`/bookings/${editingJob.locoNum}/${editingJob.dateTime}/${editingJob.oldJobId}`, {
                      new_job_id: editingJob.newJobId
                    });
                    setEditingJob(null);
                    fetchData();
                  } catch (err) {
                    const axiosError = err as AxiosError<{ detail?: string }>;
                    alert("Failed to update job: " + (axiosError.response?.data?.detail ?? "Unknown error"));
                  }
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT TASK MODAL ── */}
      {editingTask && (
        <div className="modal-overlay" onClick={() => setEditingTask(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Task Description</h3>
              <button className="close-modal-btn" onClick={() => setEditingTask(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label className="form-label">Task Details</label>
              <textarea
                className="modal-textarea"
                rows={3}
                value={editingTask.description}
                onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setEditingTask(null)}>Cancel</button>
              <button
                className="btn-submit"
                onClick={async () => {
                  try {
                    await api.put(`/bookings/tasks/${editingTask.taskId}`, {
                      task_description: editingTask.description
                    });
                    setEditingTask(null);
                    fetchData();
                  } catch (err) {
                    const axiosError = err as AxiosError<{ detail?: string }>;
                    alert("Failed to update task: " + (axiosError.response?.data?.detail ?? "Unknown error"));
                  }
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD JOB MODAL ── */}
      {addingJobLoco && (
        <div className="modal-overlay" onClick={() => setAddingJobLoco(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Job Assignment</h3>
              <button className="close-modal-btn" onClick={() => setAddingJobLoco(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label className="form-label">Select Job to Add</label>
              <select
                className="modal-select"
                value={selectedAddJobId}
                onChange={e => setSelectedAddJobId(e.target.value ? parseInt(e.target.value) : "")}
              >
                <option value="">-- Choose Job --</option>
                {jobs.map(j => (
                  <option key={j.job_id} value={j.job_id}>
                    {j.job_description} (Stage {j.stage})
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setAddingJobLoco(null)}>Cancel</button>
              <button
                className="btn-submit"
                disabled={!selectedAddJobId}
                onClick={async () => {
                  if (!selectedAddJobId) return;
                  try {
                    await api.post("/bookings/jobs", {
                      loco_number: addingJobLoco.locoNum,
                      date_time: addingJobLoco.dateTime,
                      job_id: selectedAddJobId,
                      shift: addingJobLoco.shift
                    });
                    setAddingJobLoco(null);
                    setSelectedAddJobId("");
                    fetchData();
                  } catch (err) {
                    const axiosError = err as AxiosError<{ detail?: string }>;
                    alert("Failed to add job: " + (axiosError.response?.data?.detail ?? "Unknown error"));
                  }
                }}
              >
                Add Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocoBookingUI;
