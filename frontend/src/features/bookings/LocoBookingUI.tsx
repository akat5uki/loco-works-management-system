import { useState, useEffect, useCallback } from "react";
import {
  Train, Search, Plus, Trash2, Calendar, ClipboardList,
  Clock, User, FileText, ArrowLeft, History, X, ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Edit2 } from "lucide-react";
import api from "../../shared/services/api";
import { AxiosError } from "axios";
import ThemeToggle from "../../shared/components/ThemeToggle";
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
const tomorrowISO = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateString(tomorrow);
};



const guessShift = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 1;
  if (h >= 14 && h < 22) return 2;
  return 1; // Default fallback for off-shift night hours
};



const isCurrentOrNextShift = (selDateStr: string, selShift: number): boolean => {
  const curDateStr = todayISO();
  const curShift = guessShift();
  
  let nextDateStr = curDateStr;
  let nextShift = 1;
  
  if (curShift === 1) {
    nextShift = 2;
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const day = String(tomorrow.getDate()).padStart(2, "0");
    nextDateStr = `${year}-${month}-${day}`;
    nextShift = 1;
  }
  
  const isCurrent = (selDateStr === curDateStr && selShift === curShift);
  const isNext = (selDateStr === nextDateStr && selShift === nextShift);
  
  return isCurrent || isNext;
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

  /* ── select loco → preload existing booking for chosen date+shift ── */
  const handleSelectLoco = (loco: Loco) => {
    if (loco.despatched) return; // cannot book a despatched loco
    setSelectedLoco(loco);
    setSearchTerm(loco.loco_number.toString());
    setIsAddingLoco(false);

    const existing = bookings.filter(b =>
      b.loco_number === loco.loco_number &&
      b.shift === bookingShift &&
      getLocalDateString(b.date_time) === bookingDate
    );

    if (existing.length > 0) {
      const preJobs: Job[] = [];
      const preTasks: Record<number, string[]> = {};
      existing.forEach(b => {
        const jobObj = jobs.find(j => j.job_id === b.job_id);
        if (jobObj && !preJobs.some(j => j.job_id === jobObj.job_id)) preJobs.push(jobObj);
        if (b.task_description) {
          if (!preTasks[b.job_id]) preTasks[b.job_id] = [];
          preTasks[b.job_id].push(b.task_description);
        }
      });
      setSelectedJobs(preJobs); setJobTasks(preTasks);
      setMessage("Editing existing booking for this locomotive.");
    } else {
      setSelectedJobs([]); setJobTasks({}); setMessage("");
    }
  };

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

  /* ── filtered search ── */
  const filteredLocos = locos.filter(l => {
    const matchesSearch = l.loco_number.toString().includes(searchTerm);
    const matchesStage = showStage6 || l.stage !== 6;
    return matchesSearch && matchesStage;
  });

  /* ─────────────────────── RENDER ──────────────────────────────────── */
  return (
    <div className="loco-booking-workspace">
      {/* ── HEADER ── */}
      <header className="workspace-header">
        <div className="header-actions">
          <button className="back-btn" onClick={() => navigate("/dashboard")}><ArrowLeft size={18} /> Dashboard</button>
          <ThemeToggle />
        </div>
        
        <div className="title-area">
          <Train className="header-icon" />
          <div>
            <h1>Locomotive Work Bookings</h1>
            <p>Assign tasks, schedule jobs, and track workshop activity.</p>
          </div>
        </div>
        
        <div className="tabs-navigation">
          <button className={`tab-btn ${activeTab === 'booking' ? 'active' : ''}`} onClick={() => setActiveTab('booking')}>Loco Booking</button>
          <button className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>Booking List</button>
          <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Booking History</button>
        </div>
      </header>

      <div className="workspace-grid">
        {activeTab === 'booking' && (
          <section className="booking-entry-panel" style={{ width: '100%' }}>
            <div className="panel-card">
              <h2>Book Locomotive &amp; Jobs</h2>
              <form onSubmit={handleBookingSubmit} className="booking-wizard-form">
                {/* STEP 1 – Loco search */}
              <div className="wizard-step">
                <label className="step-label">1. Search &amp; Select Locomotive</label>
                <div className="search-box-wrapper">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Type Loco Number (e.g. 31012)…"
                    value={searchTerm}
                    onChange={e => {
                      const val = e.target.value;
                      setSearchTerm(val);
                      const found = locos.find(l => l.loco_number.toString() === val.trim());
                      if (found) {
                        handleSelectLoco(found);
                      } else {
                        setSelectedLoco(null);
                        setSelectedJobs([]);
                        setJobTasks({});
                        setMessage("");
                      }
                    }}
                  />
                </div>

                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="showStage6LocoBooking"
                    checked={showStage6}
                    onChange={e => setShowStage6(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                  />
                  <label htmlFor="showStage6LocoBooking" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                    Show Stage 6 Locomotives
                  </label>
                </div>

                {searchTerm && !selectedLoco && !isAddingLoco && (
                  <div className="search-results-dropdown">
                    {filteredLocos.map(l => (
                      <div
                        key={l.loco_number}
                        className="search-item"
                        onClick={() => handleSelectLoco(l)}
                        style={l.despatched ? { opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" } : {}}
                      >
                        <Train size={16} />
                        <span>Locomotive #{l.loco_number} ({typeName(l.loco_type_id)})</span>
                        {l.despatched && (
                          <span style={{
                            marginLeft: "auto",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.45rem",
                            borderRadius: "9999px",
                            background: "rgba(239,68,68,0.12)",
                            color: "#ef4444",
                          }}>Despatched</span>
                        )}
                      </div>
                    ))}
                    {filteredLocos.length === 0 && (
                      <div className="no-loco-banner">
                        <p>Locomotive #{searchTerm} is not in the system.</p>
                        <button type="button" className="btn-add-loco-trigger"
                          onClick={() => { setNewLcoNum(searchTerm); setIsAddingLoco(true); }}>
                          <Plus size={16} /> Add Locomotive #{searchTerm}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {selectedLoco && (
                  <div className="selected-loco-tag">
                    <Train size={18} />
                    <div className="tag-details">
                      <strong>Locomotive #{selectedLoco.loco_number} ({typeName(selectedLoco.loco_type_id)})</strong>
                      <span>Stage: {selectedLoco.stage}</span>
                    </div>
                    <div className="loco-tag-actions">
                      <button type="button" className="btn-history"
                        onClick={() => setActiveTab('history')}>
                        <History size={14} /> View History
                      </button>
                      <button type="button" className="clear-loco-btn"
                        onClick={() => { setSelectedLoco(null); setSearchTerm(""); setSelectedJobs([]); setJobTasks({}); setMessage(""); }}>
                        Change
                      </button>
                    </div>
                  </div>
                )}

                {isAddingLoco && (
                  <div className="add-loco-inline-form">
                    <h3>Create New Locomotive Entry</h3>
                    <div className="inline-grid">
                      <div className="form-group">
                        <label>Loco Number</label>
                        <input type="text" value={newLcoNum} onChange={e => setNewLcoNum(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label>Loco Type</label>
                        <select value={newLcoType} onChange={e => setNewLcoType(e.target.value)} required>
                          <option value="">-- Select Type --</option>
                          {locoTypes.map(t => <option key={t.loco_type_id} value={t.loco_type_id}>{t.loco_type_name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Current Stage</label>
                        <select value={newLcoStage} onChange={e => setNewLcoStage(e.target.value)} required style={{ width: '100%', height: '38px', borderRadius: '0.375rem', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                          <option value="0">0</option>
                          <option value="5">5</option>
                          <option value="6">6</option>
                          <option value="7">7</option>
                          <option value="9">9</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Current Shift</label>
                        <select value={newLcoShift} onChange={e => setNewLcoShift(e.target.value)} required>
                          <option value="1">Shift 1</option><option value="2">Shift 2</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn-cancel" onClick={() => setIsAddingLoco(false)}>Cancel</button>
                      <button type="button" className="btn-submit" onClick={handleAddLocoSubmit} disabled={loading}>Create &amp; Select</button>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2 – Date & Shift */}
              {selectedLoco && (
                <div className="wizard-step">
                  <label className="step-label">2. Select Booking Date &amp; Shift</label>
                  <div className="date-shift-row">
                    <div className="form-group date-field">
                      <label><Calendar size={14} /> Date</label>
                      <input
                        type="date"
                        required={true}
                        value={bookingDate}
                        min={todayISO()}
                        max={tomorrowISO()}
                        onChange={e => setBookingDate(e.target.value)}
                      />
                    </div>
                    <div className="form-group shift-field">
                      <label><Clock size={14} /> Shift</label>
                      <div className="shift-btn-group">
                        {[1, 2].map(s => (
                          <button key={s} type="button"
                            className={`shift-btn${bookingShift === s ? " active" : ""}`}
                            onClick={() => setBookingShift(s)}>
                            Shift {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {!isCurrentOrNextShift(bookingDate, bookingShift) && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid #f59e0b",
                      color: "#f59e0b",
                      padding: "0.75rem",
                      borderRadius: "0.375rem",
                      marginTop: "1rem",
                      fontSize: "0.85rem",
                      fontWeight: 600
                    }}>
                      <AlertTriangle size={16} />
                      <span>Warning: You are booking for a shift other than the current or next shift.</span>
                    </div>
                  )}
                  {message.includes("Editing") && (
                    <p className="editing-hint">⚠️ An existing booking for this date &amp; shift will be replaced.</p>
                  )}
                </div>
              )}

              {/* STEP 3 – Job selection */}
              {selectedLoco && (
                <div className="wizard-step">
                  <label className="step-label">3. Select Jobs</label>
                  <div className="jobs-checkbox-list">
                    {jobs.map(job => (
                      <label key={job.job_id} className="job-checkbox-item">
                        <input type="checkbox"
                          checked={selectedJobs.some(j => j.job_id === job.job_id)}
                          onChange={() => handleToggleJob(job)} />
                        <span className="job-desc">{job.job_description} (Stage {job.stage})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4 – Tasks */}
              {selectedLoco && selectedJobs.length > 0 && (
                <div className="wizard-step">
                  <label className="step-label">4. Write Tasks for Selected Jobs</label>
                  <div className="selected-jobs-tasks-panel">
                    {selectedJobs.map(job => (
                      <div key={job.job_id} className="selected-job-card">
                        <div className="card-header"><h4>{job.job_description}</h4></div>
                        <div className="added-tasks-list">
                          {(jobTasks[job.job_id] || []).map((taskDesc, idx) => (
                            <div key={idx} className="added-task-item">
                              <span>{taskDesc}</span>
                              <button type="button" className="remove-task-btn" onClick={() => handleRemoveTask(job.job_id, idx)}><Trash2 size={14} /></button>
                            </div>
                          ))}
                          {(jobTasks[job.job_id] || []).length === 0 && (
                            <p className="no-tasks-hint">No tasks written yet. (Will book job without tasks)</p>
                          )}
                        </div>
                        <div className="task-entry-row">
                          <input type="text" placeholder="Add task details…"
                            value={taskInputs[job.job_id] || ""}
                            onChange={e => setTaskInputs(p => ({ ...p, [job.job_id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddTask(job.job_id); } }}
                          />
                          <button type="button" className="btn-add-task" onClick={() => handleAddTask(job.job_id)}>Add</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLoco && selectedJobs.length > 0 && (
                <button type="submit" className="btn-confirm-booking" disabled={loading}>
                  {loading ? "Processing…" : "Confirm & Save Booking"}
                </button>
              )}
            </form>
          </div>
        </section>
      )}


        {activeTab === 'list' && (
          <section className="bookings-list-panel" style={{ width: '100%' }}>
            <div className="panel-card scrollable">
              <h2>Booked Workshop Operations (Today)</h2>
              
              <div className="list-filters-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Search Locomotive</label>
                  <div className="search-box-wrapper">
                    <Search className="search-icon" size={16} />
                    <input
                      type="text"
                      placeholder="Search by Loco Number..."
                      value={listSearch}
                      onChange={e => setListSearch(e.target.value)}
                      style={{ paddingLeft: '2.25rem' }}
                    />
                  </div>
                </div>
                <div className="filter-group" style={{ minWidth: '150px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Filter by Shift</label>
                  <select
                    className="modal-select"
                    value={listShift}
                    onChange={e => setListShift(e.target.value)}
                    style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}
                  >
                    <option value="all">All Shifts</option>
                    <option value="1">Shift 1</option>
                    <option value="2">Shift 2</option>
                  </select>
                </div>
                <div className="filter-group" style={{ minWidth: '120px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Actions</label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    background: isEditMode ? 'var(--accent-bg)' : 'transparent',
                    borderColor: isEditMode ? 'var(--accent)' : 'var(--border)',
                    height: '38px',
                    transition: 'all 0.2s',
                  }}>
                    <input
                      type="checkbox"
                      checked={isEditMode}
                      onChange={e => setIsEditMode(e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        accentColor: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: isEditMode ? 'var(--accent)' : 'var(--text-h)',
                    }}>
                      Edit Mode
                    </span>
                  </label>
                </div>
                <div className="filter-group" style={{ minWidth: '150px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Stage 6 Filter</label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    background: showStage6 ? 'var(--accent-bg)' : 'transparent',
                    borderColor: showStage6 ? 'var(--accent)' : 'var(--border)',
                    height: '38px',
                    transition: 'all 0.2s',
                  }}>
                    <input
                      type="checkbox"
                      checked={showStage6}
                      onChange={e => setShowStage6(e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        accentColor: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: showStage6 ? 'var(--accent)' : 'var(--text-h)',
                    }}>
                      Show Stage 6
                    </span>
                  </label>
                </div>
                <div className="filter-group" style={{ minWidth: '180px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>View Controls</label>
                  <div className="collapse-controls-group">
                    <button
                      type="button"
                      onClick={expandAllToday}
                      className="btn-collapse-control"
                      title="Expand all dates, shifts, and locomotives"
                    >
                      <ChevronDown size={14} /> Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllToday}
                      className="btn-collapse-control"
                      title="Collapse all dates, shifts, and locomotives"
                    >
                      <ChevronUp size={14} /> Collapse All
                    </button>
                  </div>
                </div>
              </div>

              <div className="timeline-grouped-bookings">
                {Object.keys(groupedToday).map(dateStr => {
                  const isDateCollapsed = collapsedDates.has(dateStr);
                  return (
                    <div key={dateStr} className="date-group-card">
                      <div
                        className="date-header"
                        onClick={() => toggleDate(dateStr)}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          userSelect: 'none',
                          borderBottom: isDateCollapsed ? 'none' : '1px solid var(--border)'
                        }}
                      >
                        <Calendar size={16} />
                        <h3>{dateStr}</h3>
                        <div style={{ flexGrow: 1 }} />
                        {!isDateCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>

                      {!isDateCollapsed && (
                        <div>
                          {Object.keys(groupedToday[dateStr]).map(shift => {
                            const shiftKey = `${dateStr}-${shift}`;
                            const isShiftCollapsed = collapsedShifts.has(shiftKey);
                            return (
                              <div key={shift} className="shift-block" style={{ borderBottom: isShiftCollapsed ? 'none' : '1px solid var(--border)' }}>
                                <div
                                  className="shift-header"
                                  onClick={() => toggleShift(shiftKey)}
                                  style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    userSelect: 'none',
                                    marginBottom: isShiftCollapsed ? 0 : '0.85rem'
                                  }}
                                >
                                  <Clock size={14} />
                                  <h4>Shift {shift}</h4>
                                  <div style={{ flexGrow: 1 }} />
                                  {!isShiftCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>

                                {!isShiftCollapsed && (
                                  <div className="locos-list">
                                    {Object.keys(groupedToday[dateStr][parseInt(shift)]).map(locoStr => {
                                      const locoNum = locoStr;
                                      const record = groupedToday[dateStr][parseInt(shift)][locoNum];
                                      const ml = locos.find(l => l.loco_number === locoNum);
                                      const tn = ml ? typeName(ml.loco_type_id) : null;
                                      const isExpanded = expandedLocos.has(`${dateStr}-${shift}-${locoNum}`);
                                      return (
                                        <div key={locoNum} className="loco-booking-card collapsible">
                                          <div className="loco-card-title" onClick={() => toggleLoco(`${dateStr}-${shift}-${locoNum}`)} style={{cursor: 'pointer'}}>
                                            <Train size={16} />
                                            <h5>Locomotive #{locoNum}{tn ? ` (${tn})` : ""}</h5>
                                            <span className="booked-by-badge"><User size={12} /> {record.employee_name}</span>
                                            <div style={{flexGrow:1}}/>
                                            {isEditMode && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteLocoBooking(locoNum, record.date_time);
                                                }}
                                                className="delete-loco-btn"
                                                title="Delete entire locomotive booking"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            )}
                                            {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                          </div>
                                          {isExpanded && (
                                            <div className="loco-jobs-list">
                                              {Object.keys(record.jobs).map(jobIdStr => {
                                                const jobId = parseInt(jobIdStr);
                                                const job = record.jobs[jobId];
                                                return (
                                                  <div key={jobIdStr} className="loco-job-item">
                                                    <div className="job-meta">
                                                      <ClipboardList size={14} /><h6>{job.job_description}</h6>
                                                      {isEditMode && (
                                                        <div className="action-buttons">
                                                          <button onClick={() => handleEditJob(locoNum, record.date_time, jobId)}><Edit2 size={12}/></button>
                                                          <button onClick={() => handleDeleteJob(locoNum, record.date_time, jobId)}><Trash2 size={12}/></button>
                                                        </div>
                                                      )}
                                                    </div>
                                                    {job.tasks.length > 0 && (
                                                      <ul className="job-tasks-sublist">
                                                        {job.tasks.map((t, i) => (
                                                          <li key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                                            <span><FileText size={12} style={{marginRight:4}}/>{t.desc}</span>
                                                            {isEditMode && (
                                                              <div className="action-buttons">
                                                                <button onClick={() => handleEditTask(t.id, t.desc)}><Edit2 size={12}/></button>
                                                                <button onClick={() => handleDeleteTask(t.id)}><Trash2 size={12}/></button>
                                                              </div>
                                                            )}
                                                          </li>
                                                        ))}
                                                      </ul>
                                                    )}
                                                    {isEditMode && (
                                                      <div className="job-add-task-row" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', paddingLeft: '1.5rem' }}>
                                                        <input
                                                          type="text"
                                                          placeholder="Add new task..."
                                                          className="list-add-task-input"
                                                          value={newTaskInputs[`${locoNum}-${record.date_time}-${jobId}`] || ""}
                                                          onChange={e => setNewTaskInputs(p => ({ ...p, [`${locoNum}-${record.date_time}-${jobId}`]: e.target.value }))}
                                                          onKeyDown={async e => {
                                                            if (e.key === "Enter") {
                                                              e.preventDefault();
                                                              await handleAddSingleTask(locoNum, record.date_time, jobId);
                                                            }
                                                          }}
                                                          style={{
                                                            flexGrow: 1,
                                                            fontSize: "0.75rem",
                                                            padding: "0.25rem 0.5rem",
                                                            borderRadius: "0.25rem",
                                                            border: "1px solid var(--border)",
                                                            background: "var(--bg)",
                                                            color: "var(--text)"
                                                          }}
                                                        />
                                                        <button
                                                          onClick={() => handleAddSingleTask(locoNum, record.date_time, jobId)}
                                                          style={{
                                                            fontSize: "0.75rem",
                                                            padding: "0.25rem 0.5rem",
                                                            background: "#10b981",
                                                            color: "white",
                                                            border: "none",
                                                            borderRadius: "0.25rem",
                                                            cursor: "pointer",
                                                            fontWeight: 600
                                                          }}
                                                        >
                                                          Add
                                                        </button>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                              {isEditMode && (
                                                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-start' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => setAddingJobLoco({ locoNum, dateTime: record.date_time, shift: parseInt(shift) })}
                                                    className="add-job-list-btn"
                                                    style={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: "0.35rem",
                                                      fontSize: "0.8rem",
                                                      fontWeight: 600,
                                                      color: "#2563eb",
                                                      background: "none",
                                                      border: "none",
                                                      cursor: "pointer",
                                                      padding: "0.4rem 0.6rem",
                                                      borderRadius: "0.375rem",
                                                      transition: "background 0.15s"
                                                    }}
                                                  >
                                                    <Plus size={14} /> Add Job
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredTodayBookings.length === 0 && <p className="no-records-hint">No workshop operations booked for today.</p>}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="bookings-list-panel" style={{ width: '100%' }}>
            <div className="panel-card scrollable">
              <h2>Booked Workshop Operations History</h2>

              <div className="history-filters-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="filter-group" style={{ flexGrow: 1, minWidth: '200px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Search Locomotive</label>
                  <div className="search-box-wrapper">
                    <Search className="search-icon" size={16} />
                    <input
                      type="text"
                      placeholder="Search by Loco Number..."
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      style={{ paddingLeft: '2.25rem' }}
                    />
                  </div>
                </div>
                <div className="filter-group" style={{ width: '120px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Shift</label>
                  <select
                    className="modal-select"
                    value={historyShift}
                    onChange={e => setHistoryShift(e.target.value)}
                    style={{ padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem' }}
                  >
                    <option value="all">All Shifts</option>
                    <option value="1">Shift 1</option>
                    <option value="2">Shift 2</option>
                  </select>
                </div>
                <div className="filter-group" style={{ width: '160px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}><Calendar size={14} style={{ marginRight: 4 }} /> Start Date</label>
                  <input
                    type="date"
                    required={true}
                    value={historyStartDate}
                    onChange={e => setHistoryStartDate(e.target.value)}
                    style={{ padding: '0.45rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', width: '100%' }}
                  />
                </div>
                 <div className="filter-group" style={{ width: '160px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}><Calendar size={14} style={{ marginRight: 4 }} /> End Date</label>
                  <input
                    type="date"
                    required={true}
                    value={historyEndDate}
                    onChange={e => setHistoryEndDate(e.target.value)}
                    style={{ padding: '0.45rem 0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem', width: '100%' }}
                  />
                </div>
                <div className="filter-group" style={{ minWidth: '150px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>Stage 6 Filter</label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border)',
                    background: showStage6 ? 'var(--accent-bg)' : 'transparent',
                    borderColor: showStage6 ? 'var(--accent)' : 'var(--border)',
                    height: '38px',
                    transition: 'all 0.2s',
                  }}>
                    <input
                      type="checkbox"
                      checked={showStage6}
                      onChange={e => setShowStage6(e.target.checked)}
                      style={{
                        width: '16px',
                        height: '16px',
                        accentColor: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: showStage6 ? 'var(--accent)' : 'var(--text-h)',
                    }}>
                      Show Stage 6
                    </span>
                  </label>
                </div>
                <div className="filter-group" style={{ minWidth: '180px' }}>
                  <label className="form-label" style={{ marginBottom: '0.25rem' }}>View Controls</label>
                  <div className="collapse-controls-group">
                    <button
                      type="button"
                      onClick={expandAllHistory}
                      className="btn-collapse-control"
                      title="Expand all dates, shifts, and locomotives"
                    >
                      <ChevronDown size={14} /> Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllHistory}
                      className="btn-collapse-control"
                      title="Collapse all dates, shifts, and locomotives"
                    >
                      <ChevronUp size={14} /> Collapse All
                    </button>
                  </div>
                </div>
              </div>

              <div className="timeline-grouped-bookings">
                {Object.keys(groupedAll).map(dateStr => {
                  const dateKey = `hist-${dateStr}`;
                  const isDateCollapsed = collapsedDates.has(dateKey);
                  return (
                    <div key={dateStr} className="date-group-card">
                      <div
                        className="date-header"
                        onClick={() => toggleDate(dateKey)}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          userSelect: 'none',
                          borderBottom: isDateCollapsed ? 'none' : '1px solid var(--border)'
                        }}
                      >
                        <Calendar size={16} />
                        <h3>{dateStr}</h3>
                        <div style={{ flexGrow: 1 }} />
                        {!isDateCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>

                      {!isDateCollapsed && (
                        <div>
                          {Object.keys(groupedAll[dateStr]).map(shift => {
                            const shiftKey = `hist-${dateStr}-${shift}`;
                            const isShiftCollapsed = collapsedShifts.has(shiftKey);
                            return (
                              <div key={shift} className="shift-block" style={{ borderBottom: isShiftCollapsed ? 'none' : '1px solid var(--border)' }}>
                                <div
                                  className="shift-header"
                                  onClick={() => toggleShift(shiftKey)}
                                  style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    userSelect: 'none',
                                    marginBottom: isShiftCollapsed ? 0 : '0.85rem'
                                  }}
                                >
                                  <Clock size={14} />
                                  <h4>Shift {shift}</h4>
                                  <div style={{ flexGrow: 1 }} />
                                  {!isShiftCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>

                                {!isShiftCollapsed && (
                                  <div className="locos-list">
                                    {Object.keys(groupedAll[dateStr][parseInt(shift)]).map(locoStr => {
                                      const locoNum = locoStr;
                                      const record = groupedAll[dateStr][parseInt(shift)][locoNum];
                                      const ml = locos.find(l => l.loco_number === locoNum);
                                      const tn = ml ? typeName(ml.loco_type_id) : null;
                                      const isExpanded = expandedLocos.has(`hist-${dateStr}-${shift}-${locoNum}`);
                                      return (
                                        <div key={locoNum} className="loco-booking-card collapsible">
                                          <div className="loco-card-title" onClick={() => toggleLoco(`hist-${dateStr}-${shift}-${locoNum}`)} style={{cursor: 'pointer'}}>
                                            <Train size={16} />
                                            <h5>Locomotive #{locoNum}{tn ? ` (${tn})` : ""}</h5>
                                            <span className="booked-by-badge"><User size={12} /> {record.employee_name}</span>
                                            <div style={{flexGrow:1}}/>
                                            {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                          </div>
                                          {isExpanded && (
                                            <div className="loco-jobs-list">
                                              {Object.keys(record.jobs).map(jobIdStr => {
                                                const jobId = parseInt(jobIdStr);
                                                const job = record.jobs[jobId];
                                                return (
                                                  <div key={jobIdStr} className="loco-job-item">
                                                    <div className="job-meta">
                                                      <ClipboardList size={14} /><h6>{job.job_description}</h6>
                                                    </div>
                                                    {job.tasks.length > 0 && (
                                                      <ul className="job-tasks-sublist">
                                                        {job.tasks.map((t, i) => (
                                                          <li key={i}>
                                                            <FileText size={12} style={{marginRight:4}}/><span>{t.desc}</span>
                                                          </li>
                                                        ))}
                                                      </ul>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredHistoryBookings.length === 0 && <p className="no-records-hint">No workshop operations booked in this range.</p>}
              </div>
            </div>
          </section>
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
