import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Train,
  Clock,
  Calendar,
  Lock,
  RefreshCw,
  Bell,
  AlertTriangle,
  ClipboardList
} from "lucide-react";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import "./EmployeesBooking.css";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
}

interface RawBooking {
  loco_number: string;
  date_time: string;
  shift: number;
  supervisor_ticket_number: number;
  staff_ticket_number: number | null;
  is_forwarded: boolean;
}

interface ViewsData {
  by_loco: Array<{
    loco_number: string;
    supervisors: Array<{
      supervisor_ticket_number: number;
      supervisor_name: string;
      is_forwarded: boolean;
      staff: Array<{ staff_ticket_number: number; staff_name: string }>;
    }>;
  }>;
  by_supervisor: Array<{
    supervisor_ticket_number: number;
    supervisor_name: string;
    locos: Array<{
      loco_number: string;
      is_forwarded: boolean;
      staff: Array<{ staff_ticket_number: number; staff_name: string }>;
    }>;
  }>;
  by_staff: Array<{
    staff_ticket_number: number;
    staff_name: string;
    assignments: Array<{
      loco_number: string;
      supervisor_ticket_number: number;
      supervisor_name: string;
    }>;
  }>;
}

interface Notification {
  notification_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface TaskInfo {
  task_id: number;
  task_description: string;
}

interface JobInfo {
  job_id: number;
  job_description: string;
  stage: number;
  tasks: TaskInfo[];
}

interface ActiveLocoJobs {
  loco_number: string;
  jobs: JobInfo[];
}


const todayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const guessShift = () => {
  const hour = new Date().getHours();
  return hour >= 8 && hour < 20 ? 1 : 2;
};

const EmployeesBookingWizard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // User info
  const [currentUser, setCurrentUser] = useState<{ ticket_number: number; name: string; designation_id: number; is_supervisor: boolean } | null>(null);

  // Filters & State
  const [dateStr, setDateStr] = useState(todayISO());
  const [shift, setShift] = useState(guessShift());

  // Data lists
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableTickets, setAvailableTickets] = useState<Set<number>>(new Set());
  const [locos, setLocos] = useState<string[]>([]);
  const [bookings, setBookings] = useState<RawBooking[]>([]);
  const [viewsData, setViewsData] = useState<ViewsData | null>(null);
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Lock management
  const [lockOwner, setLockOwner] = useState<{ name: string; ticket_number: number } | null>(null);
  const lockTimer = useRef<number | null>(null);

  // Wizard selections
  const [selectedLoco, setSelectedLoco] = useState<string | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<number | "">("");
  const [tempSupervisorLocos, setTempSupervisorLocos] = useState<Record<number, string[]>>({});
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  
  // Staff Selection Map (Loco ID -> array of Staff tickets)
  const [locoStaffMap, setLocoStaffMap] = useState<Record<string, number[]>>({});

  // Carry Forward State
  const [locoJobs, setLocoJobs] = useState<ActiveLocoJobs | null>(null);
  const [remarksState, setRemarksState] = useState<Record<number, { completed: boolean; remarks: string }>>({});
  const [taskRemarksState, setTaskRemarksState] = useState<Record<number, { completed: boolean; remarks: string }>>({});
  const [newJobs, setNewJobs] = useState<number[]>([]);
  const [newTasks, setNewTasks] = useState<Array<{ job_id: number; task_description: string }>>([]);
  const [typedTask, setTypedTask] = useState<Record<number, string>>({});
  const [allMasterJobs, setAllMasterJobs] = useState<Array<{ job_id: number; job_description: string }>>([]);

  // Active View Tab
  const [activeViewTab, setActiveViewTab] = useState<"loco" | "supervisor" | "staff">("loco");
  const [searchTerm, setSearchTerm] = useState("");

  // Telemetry WS connection
  useEffect(() => {
    const wsUrl = `wss://${window.location.host}/api/v1/realtime/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "employee_notification") {
          const payload = data.payload ? JSON.parse(data.payload) : data;
          if (currentUser && payload.ticket_number === currentUser.ticket_number) {
            // Add to notification list
            setNotifications(prev => [
              {
                notification_id: Date.now(),
                message: payload.message,
                is_read: false,
                created_at: new Date().toISOString()
              },
              ...prev
            ]);
          }
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [currentUser]);


  // ── Access validation ──
  useEffect(() => {
    api.get("/auth/me").then(r => {
      setCurrentUser(r.data);
      if (!r.data.is_supervisor) {
        alert("Access Denied: Supervisors only area.");
        navigate("/dashboard", { replace: true });
      }
      // Set default tab based on designation
      if (r.data.designation_id === 1) {
        setActiveViewTab("loco");
      } else if (r.data.designation_id === 2) {
        setActiveViewTab("supervisor");
      } else {
        setActiveViewTab("staff");
      }
    }).catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  // Handle selectLoco redirection from Dashboard
  useEffect(() => {
    if (location.state && (location.state as any).selectLoco) {
      const targetLoco = (location.state as any).selectLoco.toString();
      setSelectedLoco(targetLoco);
      
      // Clean up the location state so it doesn't trigger on refresh
      navigate(location.pathname, { replace: true, state: {} });

      // Scroll to the carry forward panel after it renders
      setTimeout(() => {
        const el = document.getElementById("remarks-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 500);
    }
  }, [location, navigate]);


  // Acquire lock heartbeat
  const refreshLock = useCallback(async () => {
    try {
      await api.post("/bookings/employees/bookings/lock", { date_str: dateStr, shift });
      setLockOwner(null); // Success
    } catch (err: any) {
      if (err.response && err.response.status === 409) {
        const detail = err.response.data?.detail;
        const match = detail.match(/locked by (.+?) \(Ticket #(\d+)\)/);
        if (match) {
          setLockOwner({ name: match[1], ticket_number: parseInt(match[2]) });
        } else {
          setLockOwner({ name: "Another Supervisor", ticket_number: 0 });
        }
      }
    }
  }, [dateStr, shift]);

  // Handle locking heartbeats
  useEffect(() => {
    if (lockTimer.current) {
      clearInterval(lockTimer.current);
    }
    
    if (currentUser && currentUser.is_supervisor) {
      refreshLock();
      lockTimer.current = window.setInterval(refreshLock, 15000);
    }

    return () => {
      if (lockTimer.current) {
        clearInterval(lockTimer.current);
      }
      // Unlock on component clean-up
      api.post("/bookings/employees/bookings/unlock", { date_str: dateStr, shift }).catch(() => {});
    };
  }, [currentUser, dateStr, shift, refreshLock]);


  // Fetch all master jobs for carry forward additions
  useEffect(() => {
    api.get("/jobs/").then(res => setAllMasterJobs(res.data)).catch(() => {});
  }, []);

  // Primary Fetch Function
  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch all employees
      const empRes = await api.get("/employees/");
      setEmployees(empRes.data);

      // 2. Fetch availabilities
      const availRes = await api.get(`/bookings/employees/availabilities?date_str=${dateStr}&shift=${shift}`);
      setAvailableTickets(new Set(availRes.data.available_tickets));

      // 3. Fetch booked locos
      const locosRes = await api.get(`/bookings/employees/locos?date_str=${dateStr}&shift=${shift}`);
      setLocos(locosRes.data.locos);

      // 4. Fetch raw employee bookings
      const bookingsRes = await api.get(`/bookings/employees/bookings?date_str=${dateStr}&shift=${shift}`);
      setBookings(bookingsRes.data);

      // Reset selection forms if loco no longer available
      if (selectedLoco && !locosRes.data.locos.includes(selectedLoco)) {
        setSelectedLoco(null);
      }

      // Map existing staff bookings to state
      const newMap: Record<string, number[]> = {};
      bookingsRes.data.forEach((b: RawBooking) => {
        if (b.staff_ticket_number) {
          const key = `${b.loco_number}_${b.supervisor_ticket_number}`;
          if (!newMap[key]) newMap[key] = [];
          if (!newMap[key].includes(b.staff_ticket_number)) {
            newMap[key].push(b.staff_ticket_number);
          }
        }
      });
      setLocoStaffMap(newMap);
      
      // Map existing supervisor bookings (locomotives assigned to each supervisor)
      const supLocoMap: Record<number, string[]> = {};
      bookingsRes.data.forEach((b: RawBooking) => {
        if (!supLocoMap[b.supervisor_ticket_number]) {
          supLocoMap[b.supervisor_ticket_number] = [];
        }
        if (!supLocoMap[b.supervisor_ticket_number].includes(b.loco_number)) {
          supLocoMap[b.supervisor_ticket_number].push(b.loco_number);
        }
      });
      setTempSupervisorLocos(supLocoMap);

      // Proactively set selected locomotive for preview if none is set
      if (!selectedLoco && locosRes.data.locos.length > 0) {
        setSelectedLoco(locosRes.data.locos[0]);
      }

      // 5. Fetch Views Compiled Data
      const viewsRes = await api.get(`/bookings/employees/views?date_str=${dateStr}&shift=${shift}`);
      setViewsData(viewsRes.data);

      // 6. Fetch user notifications
      const notifRes = await api.get("/bookings/employees/notifications");
      setNotifications(notifRes.data);

    } catch (err) {
      console.error("Error fetching wizard data", err);
    }
  }, [dateStr, shift, selectedLoco]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, dateStr, shift, fetchData]);

  useEffect(() => {
    if (selectedLoco) {
      loadLocoJobs(selectedLoco);
    } else {
      setLocoJobs(null);
    }
  }, [selectedLoco, dateStr, shift]);

  // Reset wizard steps when date or shift changes to verify supervisors first
  useEffect(() => {
    setActiveStep(1);
    setSelectedLoco(null);
    setSelectedSupervisor("");
  }, [dateStr, shift]);


  // ── Availability Toggler ──
  const handleToggleAvailability = async (ticket: number) => {
    if (lockOwner) return;
    const newAvails = new Set(availableTickets);
    if (newAvails.has(ticket)) {
      newAvails.delete(ticket);
    } else {
      newAvails.add(ticket);
    }
    setAvailableTickets(newAvails);

    try {
      await api.post("/bookings/employees/availabilities", {
        date_str: dateStr,
        shift,
        ticket_numbers: Array.from(newAvails)
      });
      fetchData();
    } catch (err) {
      alert("Failed to update availability.");
    }
  };


  // ── Save Supervisors Booking submission ──
  const handleSaveSupervisors = async () => {
    if (lockOwner) return;
    if (locos.length === 0) {
      alert("No locomotives available to assign supervisors to.");
      return;
    }

    try {
      setSaving(true);
      const promises = locos.map(locoNum => {
        const assignedTickets: number[] = [];
        supervisorList
          .filter(sup => availableTickets.has(sup.ticket_number))
          .forEach(sup => {
            const assignedLocos = tempSupervisorLocos[sup.ticket_number] || [];
            if (assignedLocos.includes(locoNum)) {
              assignedTickets.push(sup.ticket_number);
            }
          });

        return api.post("/bookings/employees/bookings", {
          date_str: dateStr,
          shift,
          loco_number: locoNum,
          supervisor_ticket_numbers: assignedTickets,
          forward: true
        });
      });

      await Promise.all(promises);
      alert("All supervisor assignments saved successfully and notifications triggered!");
      await fetchData();
      setActiveStep(2);
    } catch (err: any) {
      alert("Failed to save supervisor assignments: " + (err.response?.data?.detail ?? "Error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Save Staff Booking submission ──
  const handleSaveStaff = async () => {
    if (lockOwner || !selectedLoco || !selectedSupervisor) return;

    const key = `${selectedLoco}_${selectedSupervisor}`;
    const staffList = locoStaffMap[key] || [];

    try {
      const payload = {
        date_str: dateStr,
        shift,
        loco_number: selectedLoco,
        supervisor_ticket_number: parseInt(selectedSupervisor.toString()),
        staff_ticket_numbers: staffList,
        forward: true
      };

      await api.post("/bookings/employees/bookings", payload);
      alert("Staff assignments saved successfully!");
      fetchData();
    } catch (err: any) {
      alert("Failed to save staff: " + (err.response?.data?.detail ?? "Error"));
    }
  };

  // ── Supervisor Locomotive Toggler ──
  const handleToggleSupervisorLoco = (supTicket: number, locoNum: string) => {
    if (lockOwner) return;
    const currentLocos = tempSupervisorLocos[supTicket] || [];
    let updatedLocos: string[];
    if (currentLocos.includes(locoNum)) {
      updatedLocos = currentLocos.filter(l => l !== locoNum);
    } else {
      updatedLocos = [...currentLocos, locoNum];
    }
    setTempSupervisorLocos(prev => ({
      ...prev,
      [supTicket]: updatedLocos
    }));
  };

  // ── Staff Selection Toggler ──
  const handleToggleStaffSelection = (staffTicket: number) => {
    if (lockOwner || !selectedLoco || !currentUser || !selectedSupervisor) return;
    
    const key = `${selectedLoco}_${selectedSupervisor}`;
    const currentStaffList = locoStaffMap[key] || [];
    const isSelected = currentStaffList.includes(staffTicket);
    
    if (isSelected) {
      // Uncheck: remove from current loco
      const updatedStaff = currentStaffList.filter(t => t !== staffTicket);
      setLocoStaffMap(prev => ({ ...prev, [key]: updatedStaff }));
    } else {
      // Check: Check if selected anywhere under this supervisor on their assigned locos
      const assignedLocos = tempSupervisorLocos[selectedSupervisor] || [];
      const isSelectedAnywhere = assignedLocos.some(locoNum => {
        const k = `${locoNum}_${selectedSupervisor}`;
        return (locoStaffMap[k] || []).includes(staffTicket);
      });

      if (!isSelectedAnywhere) {
        // Auto-assign to all assigned locos
        setLocoStaffMap(prev => {
          const updated = { ...prev };
          assignedLocos.forEach(locoNum => {
            const k = `${locoNum}_${selectedSupervisor}`;
            const list = updated[k] || [];
            if (!list.includes(staffTicket)) {
              updated[k] = [...list, staffTicket];
            }
          });
          return updated;
        });
      } else {
        // Just add to current loco
        const updatedStaff = [...currentStaffList, staffTicket];
        setLocoStaffMap(prev => ({ ...prev, [key]: updatedStaff }));
      }
    }
  };


  // Helper: check if staff is booked on other locomotives or under other supervisors
  const getStaffWarning = (staffTicket: number) => {
    // Find all bookings for this staff member (excluding current assignment: same loco + same supervisor)
    const otherBookings = bookings.filter(
      b => b.staff_ticket_number === staffTicket && 
           !(b.loco_number === selectedLoco && b.supervisor_ticket_number === selectedSupervisor)
    );
    if (otherBookings.length > 0) {
      const details = otherBookings.map(ob => {
        const supervisor = employees.find(e => e.ticket_number === ob.supervisor_ticket_number);
        const name = supervisor ? supervisor.name : `Supervisor #${ob.supervisor_ticket_number}`;
        return `Loco #${ob.loco_number} under ${name}`;
      });
      return `Booked: ${Array.from(new Set(details)).join("; ")}`;
    }
    return null;
  };


  // ── Notification Mark as Read ──
  const handleMarkAsRead = async (notifId: number) => {
    try {
      await api.post(`/bookings/employees/notifications/${notifId}/read`);
      setNotifications(prev => prev.map(n => n.notification_id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {}
  };


  // ── Carry Forward / Completion panel ──
  const loadLocoJobs = async (locoNum: string) => {
    try {
      // We will look at bookings for this loco/shift, and retrieve the jobs and tasks
      const bookingsRes = await api.get(`/bookings/?start_date=${dateStr}&end_date=${dateStr}`);
      const locoBookings = bookingsRes.data.filter((b: any) => b.loco_number.toString() === locoNum.toString() && b.shift === shift);
      
      // Group them by job
      const jobMap: Record<number, JobInfo> = {};
      locoBookings.forEach((b: any) => {
        if (!jobMap[b.job_id]) {
          jobMap[b.job_id] = {
            job_id: b.job_id,
            job_description: b.job_description,
            stage: 5, // placeholder
            tasks: []
          };
        }
        if (b.task_id) {
          jobMap[b.job_id].tasks.push({
            task_id: b.task_id,
            task_description: b.task_description
          });
        }
      });
      
      setLocoJobs({ loco_number: locoNum, jobs: Object.values(jobMap) });
      
      // Pre-populate remarks/completion defaults
      const defRemarks: Record<number, { completed: boolean; remarks: string }> = {};
      const defTaskRemarks: Record<number, { completed: boolean; remarks: string }> = {};
      
      // Fetch existing remarks
      const remarksRes = await api.get(`/bookings/employees/remarks?date_str=${dateStr}&shift=${shift}`);
      remarksRes.data.forEach((r: any) => {
        if (r.loco_number === locoNum) {
          if (r.task_id === null) {
            defRemarks[r.job_id] = { completed: r.completed, remarks: r.remarks };
          } else {
            defTaskRemarks[r.task_id] = { completed: r.completed, remarks: r.remarks };
          }
        }
      });

      // Fill in default empty values for unremarked items
      Object.values(jobMap).forEach((j: JobInfo) => {
        if (!defRemarks[j.job_id]) {
          defRemarks[j.job_id] = { completed: false, remarks: "" };
        }
        j.tasks.forEach(t => {
          if (!defTaskRemarks[t.task_id]) {
            defTaskRemarks[t.task_id] = { completed: false, remarks: "" };
          }
        });
      });

      setRemarksState(defRemarks);
      setTaskRemarksState(defTaskRemarks);
      setNewJobs([]);
      setNewTasks([]);

    } catch (err) {
      console.error("Failed to load jobs/tasks", err);
    }
  };

  const handleAddCarryForwardJob = (jobId: number) => {
    if (!newJobs.includes(jobId)) {
      setNewJobs(prev => [...prev, jobId]);
    }
  };

  const handleRemoveCarryForwardJob = (jobId: number) => {
    setNewJobs(prev => prev.filter(id => id !== jobId));
  };

  const handleAddCarryForwardTask = (jobId: number) => {
    const desc = typedTask[jobId]?.trim();
    if (!desc) return;
    setNewTasks(prev => [...prev, { job_id: jobId, task_description: desc }]);
    setTypedTask(prev => ({ ...prev, [jobId]: "" }));
  };

  const handleRemoveCarryForwardTask = (idx: number) => {
    setNewTasks(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitRemarks = async () => {
    if (!locoJobs || lockOwner) return;

    try {
      const payload = {
        loco_number: locoJobs.loco_number,
        date_str: dateStr,
        shift,
        job_remarks: Object.keys(remarksState).map(jobIdStr => {
          const jobId = parseInt(jobIdStr);
          const jobData = remarksState[jobId];
          
          // Filter tasks belonging to this job
          const job = locoJobs.jobs.find(j => j.job_id === jobId);
          const taskRemarks = (job?.tasks || []).map(t => ({
            task_id: t.task_id,
            completed: taskRemarksState[t.task_id]?.completed ?? false,
            remarks: taskRemarksState[t.task_id]?.remarks ?? ""
          }));

          return {
            job_id: jobId,
            completed: jobData.completed,
            remarks: jobData.remarks,
            task_remarks: taskRemarks
          };
        }),
        new_jobs: newJobs,
        new_tasks: newTasks
      };

      await api.post("/bookings/employees/remarks", payload);
      alert("Remarks submitted and incomplete tasks successfully carried forward!");
      setLocoJobs(null);
      fetchData();
    } catch (err) {
      alert("Failed to submit remarks.");
    }
  };


  // ── Sorted and Filtered employees list ──
  const getSortedEmployeesList = () => {
    const sorted = [...employees].sort((a, b) => {
      const aAvail = availableTickets.has(a.ticket_number);
      const bAvail = availableTickets.has(b.ticket_number);
      if (aAvail !== bAvail) {
        return aAvail ? -1 : 1; // Available on top
      }
      if (a.designation_id !== b.designation_id) {
        return a.designation_id - b.designation_id; // Sort by hierarchy SSE > JE > staff
      }
      return a.ticket_number - b.ticket_number;
    });
    return sorted;
  };

  const supervisorList = getSortedEmployeesList().filter(e => e.designation_id === 1 || e.designation_id === 2);
  const hasSavedSupervisors = bookings.some(b => b.supervisor_ticket_number && !b.staff_ticket_number);
  const staffList = getSortedEmployeesList().filter(e => e.designation_id > 2);
  const filteredEmployees = [...employees]
    .filter(emp => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      return (
        emp.name.toLowerCase().includes(term) ||
        emp.designation_name.toLowerCase().includes(term) ||
        emp.ticket_number.toString().includes(term)
      );
    })
    .sort((a, b) => {
      if (a.designation_id !== b.designation_id) {
        return a.designation_id - b.designation_id;
      }
      return a.ticket_number - b.ticket_number;
    });

  // Grouped Staff segments
  const groupedStaffList = staffList.reduce((acc, emp) => {
    if (!acc[emp.designation_name]) {
      acc[emp.designation_name] = [];
    }
    acc[emp.designation_name].push(emp);
    return acc;
  }, {} as Record<string, Employee[]>);


  return (
    <div className="employees-booking-workspace">
      {/* ── HEADER ── */}
      <header className="workspace-header">
        <div className="header-actions">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <ThemeToggle />
            
            {/* Notification Center */}
            <div className="notification-bell-container" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell size={20} />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <div className="notification-badge">
                  {notifications.filter(n => !n.is_read).length}
                </div>
              )}
              {showNotifications && (
                <div className="notifications-popup" onClick={e => e.stopPropagation()}>
                  <h3>Notifications</h3>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "1rem 0" }}>No new notifications.</p>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.notification_id}
                        className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                        onClick={() => handleMarkAsRead(n.notification_id)}
                      >
                        <div>{n.message}</div>
                        <span className="notif-time">{new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="title-area">
          <Users className="header-icon" size={32} />
          <div>
            <h1>Employees Booking Wizard</h1>
            <p>Schedule supervisors and staff, track availability, assign tasks, and carry forward operations.</p>
          </div>
        </div>
      </header>

      {/* Lock Warn Overlay */}
      {lockOwner && (
        <div className="lock-banner">
          <Lock size={18} />
          <span>
            Locked: {lockOwner.name} (Ticket #{lockOwner.ticket_number}) is currently editing. You are in VIEW-ONLY mode.
          </span>
        </div>
      )}

      {/* ── Global Selection Bar ── */}
      <div className="global-config-bar">
        <div className="config-group">
          <label><Calendar size={14} style={{ marginRight: 4 }} /> Date</label>
          <input
            type="date"
            className="config-input"
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
          />
        </div>
        <div className="config-group">
          <label><Clock size={14} style={{ marginRight: 4 }} /> Shift</label>
          <select
            className="config-select"
            value={shift}
            onChange={e => setShift(parseInt(e.target.value))}
          >
            <option value={1}>Shift 1 (Day)</option>
            <option value={2}>Shift 2 (Night)</option>
          </select>
        </div>
        <button className="back-btn" onClick={fetchData} style={{ height: "38px" }}>
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      <div className="wizard-grid">
        {/* ── PANEL 1: Employee Availability ── */}
        <section className="panel-card">
          <h2>1. Set Employee Availability (Current Shift)</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "-0.5rem" }}>
            By default, all employees are marked Available. Toggle to Absent to exclude them.
          </p>

          <div style={{ margin: "1rem 0" }}>
            <input
              type="text"
              placeholder="Search by name, designation, or ticket..."
              className="config-input"
              style={{ width: "100%" }}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="availability-list">
            {filteredEmployees.length === 0 && <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No employees match search criteria.</p>}
            {filteredEmployees.map(emp => {
              const isAvailable = availableTickets.has(emp.ticket_number);
              return (
                <div key={emp.ticket_number} className={`employee-toggle-item ${isAvailable ? 'available' : ''}`}>
                  <div className="emp-meta">
                    <span className="emp-name">{emp.name} (Ticket #{emp.ticket_number})</span>
                    <span className="emp-badge">{emp.designation_name} — {emp.category_name}</span>
                  </div>
                  <button
                    className={`avail-toggle-btn ${isAvailable ? 'active' : ''}`}
                    onClick={() => handleToggleAvailability(emp.ticket_number)}
                    disabled={!!lockOwner}
                  >
                    {isAvailable ? "Available" : "Absent"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── PANEL 2: Actual Booking Wizard ── */}
        <section className="panel-card" style={{ gridColumn: "span 2" }}>
          <h2>2. Book Employees to Locomotives</h2>
          
          {locos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <Train size={36} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
              <p style={{ color: "var(--text-muted)" }}>No locomotives are booked in this shift. Assign locos under "Loco Booking" first.</p>
            </div>
          ) : (
            <div className="booking-form">
              {/* Step Navigation Indicator */}
              <div style={{ display: "flex", gap: "1rem", borderBottom: "2px solid var(--border)", marginBottom: "1.5rem" }}>
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  style={{
                    padding: "0.75rem 1rem",
                    border: "none",
                    background: "none",
                    fontWeight: "bold",
                    color: activeStep === 1 ? "var(--accent)" : "var(--text-muted)",
                    borderBottom: activeStep === 1 ? "3px solid var(--accent)" : "none",
                    cursor: "pointer",
                    fontSize: "1rem"
                  }}
                >
                  Step 1: Book Supervisors to Locomotives
                </button>
                <button
                  type="button"
                  onClick={() => hasSavedSupervisors && setActiveStep(2)}
                  disabled={!hasSavedSupervisors}
                  style={{
                    padding: "0.75rem 1rem",
                    border: "none",
                    background: "none",
                    fontWeight: "bold",
                    color: activeStep === 2 ? "var(--accent)" : "var(--text-muted)",
                    borderBottom: activeStep === 2 ? "3px solid var(--accent)" : "none",
                    cursor: hasSavedSupervisors ? "pointer" : "not-allowed",
                    opacity: hasSavedSupervisors ? 1 : 0.5,
                    fontSize: "1rem"
                  }}
                >
                  Step 2: Book Staff under Supervisors
                </button>
              </div>

              {/* Main Panel Layout: Split-screen column view */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem", marginTop: "1rem" }}>
                
                {/* Column 1: Forms based on active step */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  
                  {activeStep === 1 && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1.5rem", background: "rgba(255,255,255,0.01)" }}>
                      <h3 style={{ marginTop: 0, fontSize: "1.2rem", color: "var(--text-h)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        Assign Locomotives to Available Supervisors
                      </h3>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
                        Select the locomotive numbers assigned under each available supervisor. Booking of all available supervisors must be fully completed and saved to proceed to staff booking.
                      </p>

                      {supervisorList.filter(sup => availableTickets.has(sup.ticket_number)).length === 0 ? (
                        <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                          No available supervisors found. Please mark them available in the availability list.
                        </p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "400px", overflowY: "auto", paddingRight: "0.5rem", marginBottom: "1.5rem" }}>
                          {supervisorList
                            .filter(sup => availableTickets.has(sup.ticket_number))
                            .map(sup => {
                              const assignedLocos = tempSupervisorLocos[sup.ticket_number] || [];
                              return (
                                <div
                                  key={sup.ticket_number}
                                  style={{
                                    border: "1px solid var(--border)",
                                    borderRadius: "8px",
                                    padding: "1rem",
                                    background: "var(--bg)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.5rem"
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <strong style={{ fontSize: "0.95rem" }}>{sup.name}</strong>
                                    <span style={{ fontSize: "0.75rem", background: "var(--accent-bg)", color: "var(--accent)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                                      {sup.designation_name} (Ticket #{sup.ticket_number})
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                                    {locos.map(locoNum => {
                                      const isAssigned = assignedLocos.includes(locoNum);
                                      const isSelectedForPreview = selectedLoco === locoNum;
                                      return (
                                        <div
                                          key={locoNum}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.4rem",
                                            padding: "0.4rem 0.8rem",
                                            borderRadius: "20px",
                                            border: `1px solid ${isSelectedForPreview ? "var(--accent)" : "var(--border)"}`,
                                            background: isAssigned ? "var(--accent-bg)" : "var(--bg-secondary)",
                                            cursor: "pointer",
                                            userSelect: "none",
                                            fontSize: "0.85rem",
                                            fontWeight: "bold",
                                            color: isAssigned ? "var(--accent)" : "var(--text-muted)",
                                            boxShadow: isSelectedForPreview ? "0 0 0 1px var(--accent)" : "none",
                                          }}
                                          onClick={() => setSelectedLoco(locoNum)}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isAssigned}
                                            disabled={!!lockOwner}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              handleToggleSupervisorLoco(sup.ticket_number, locoNum);
                                            }}
                                            style={{ cursor: "pointer" }}
                                          />
                                          <span>#{locoNum}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn-primary-action"
                        style={{ width: "100%" }}
                        onClick={handleSaveSupervisors}
                        disabled={!!lockOwner || saving}
                      >
                        {saving ? "Saving Assignments..." : "Save Supervisor Assignments & Proceed"}
                      </button>
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1.5rem", background: "rgba(255,255,255,0.01)" }}>
                      <h3 style={{ marginTop: 0, fontSize: "1.2rem", color: "var(--text-h)" }}>
                        Assign Staff under Supervisor to Locomotive
                      </h3>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem", marginBottom: "1.5rem" }}>
                        <div>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Select Supervisor</label>
                          <select
                            className="config-select"
                            style={{ width: "100%", marginTop: "0.5rem" }}
                            value={selectedSupervisor}
                            onChange={e => {
                              setSelectedSupervisor(e.target.value ? parseInt(e.target.value) : "");
                              // Select the first assigned loco by default
                              const supVal = e.target.value ? parseInt(e.target.value) : "";
                              const supLocos = supVal ? (tempSupervisorLocos[supVal] || []) : [];
                              if (supLocos.length > 0) {
                                setSelectedLoco(supLocos[0]);
                              }
                            }}
                            disabled={!!lockOwner}
                          >
                            <option value="">-- Choose Supervisor --</option>
                            {supervisorList
                              .filter(sup => availableTickets.has(sup.ticket_number) && (tempSupervisorLocos[sup.ticket_number] || []).length > 0)
                              .map(sup => (
                                <option key={sup.ticket_number} value={sup.ticket_number}>
                                  {sup.name} ({sup.designation_name})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Select Locomotive</label>
                          <select
                            className="config-select"
                            style={{ width: "100%", marginTop: "0.5rem" }}
                            value={selectedLoco || ""}
                            onChange={e => setSelectedLoco(e.target.value || null)}
                            disabled={!!lockOwner || !selectedSupervisor}
                          >
                            <option value="">-- Choose Locomotive --</option>
                            {selectedSupervisor &&
                              (tempSupervisorLocos[selectedSupervisor] || []).map(locoNum => (
                                <option key={locoNum} value={locoNum}>
                                  Loco #{locoNum}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {selectedSupervisor && selectedLoco && (
                        <div>
                          <label style={{ marginBottom: "0.5rem", display: "block", fontWeight: "bold" }}>
                            Assign Staff to Loco #{selectedLoco} under {employees.find(e => e.ticket_number === selectedSupervisor)?.name}
                          </label>
                          
                          <div className="staff-hierarchy-list" style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", padding: "0.75rem", borderRadius: "6px", background: "var(--bg-card)", marginBottom: "1.5rem" }}>
                            {Object.entries(groupedStaffList)
                              .sort((a, b) => {
                                const aDesigId = a[1][0]?.designation_id || 99;
                                const bDesigId = b[1][0]?.designation_id || 99;
                                return aDesigId - bDesigId;
                              })
                              .map(([desigName, staffMembers]) => (
                                <div key={desigName} className="hierarchy-section" style={{ marginBottom: "1rem" }}>
                                  <h4 style={{ margin: "0 0 0.5rem 0", borderBottom: "1px solid var(--border)", paddingBottom: "0.25rem", color: "var(--accent)" }}>{desigName}</h4>
                                  <div className="hierarchy-items" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                    {staffMembers.map(staff => {
                                      const isAvailable = availableTickets.has(staff.ticket_number);
                                      const key = `${selectedLoco}_${selectedSupervisor}`;
                                      const isChecked = (locoStaffMap[key] || []).includes(staff.ticket_number);
                                      const warning = getStaffWarning(staff.ticket_number);

                                      return (
                                        <div
                                          key={staff.ticket_number}
                                          className={`staff-selection-row ${isChecked ? 'selected' : ''} ${!isAvailable ? 'unavailable' : ''}`}
                                          onClick={() => isAvailable && handleToggleStaffSelection(staff.ticket_number)}
                                          style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: isAvailable ? "pointer" : "not-allowed", padding: "0.25rem", borderRadius: "4px" }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={!isAvailable || !!lockOwner}
                                            onChange={() => {}}
                                          />
                                          <span style={{ fontSize: "0.85rem" }}>{staff.name} (Ticket #{staff.ticket_number})</span>
                                          {!isAvailable && <span className="warning-badge" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: "0.75rem" }}>Absent</span>}
                                          {warning && <span className="warning-badge" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: "0.75rem" }}><AlertTriangle size={10} style={{ marginRight: 3 }} /> {warning}</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                          </div>
                          <button
                            type="button"
                            className="btn-primary-action"
                            style={{ width: "100%" }}
                            onClick={handleSaveStaff}
                            disabled={!!lockOwner}
                          >
                            Save Staff Assignment
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* Column 2: Locomotive Operations Detail (visible in both steps!) */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {selectedLoco ? (
                    locoJobs ? (
                      <div className="loco-ops-preview" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px", padding: "1.5rem", height: "100%", minHeight: "350px" }}>
                        <h3 style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: "0.5rem", marginTop: 0 }}>
                          <ClipboardList size={18} /> Operations for Loco #{selectedLoco} (Current Shift)
                        </h3>
                        {locoJobs.jobs.length === 0 ? (
                          <p style={{ color: "var(--text-muted)", fontStyle: "italic", margin: "1rem 0 0 0" }}>No operations booked for this locomotive in this shift.</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem", maxHeight: "550px", overflowY: "auto", paddingRight: "0.5rem" }}>
                            {locoJobs.jobs.map(job => {
                              const remarkObj = remarksState[job.job_id];
                              return (
                                <div key={job.job_id} style={{ fontSize: "0.9rem", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "0.75rem" }}>
                                  <strong style={{ display: "block", color: "var(--text-h)" }}>Job {job.job_id}: {job.job_description}</strong>
                                  {remarkObj && (
                                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.35rem", background: "rgba(255,255,255,0.02)", padding: "0.5rem", borderRadius: "4px" }}>
                                      Status: <span style={{ color: remarkObj.completed ? "#10b981" : "#f59e0b", fontWeight: "bold" }}>{remarkObj.completed ? "Completed" : "In Progress"}</span>
                                      {remarkObj.remarks && <span style={{ display: "block", marginTop: "0.25rem", fontStyle: "italic" }}>Remarks: "{remarkObj.remarks}"</span>}
                                    </div>
                                  )}
                                  {job.tasks.length > 0 && (
                                    <div style={{ marginTop: "0.5rem" }}>
                                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "bold" }}>Tasks:</span>
                                      <ul style={{ margin: "0.25rem 0 0 1.2rem", padding: 0, listStyle: "disc", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                        {job.tasks.map(t => {
                                          const taskRemark = taskRemarksState[t.task_id];
                                          return (
                                            <li key={t.task_id} style={{ marginBottom: "0.25rem" }}>
                                              <span>{t.task_description}</span>
                                              {taskRemark && (
                                                <span style={{ display: "block", fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.15rem", background: "rgba(255,255,255,0.015)", padding: "0.15rem 0.4rem", borderRadius: "3px", borderLeft: `2px solid ${taskRemark.completed ? "#10b981" : "#f59e0b"}` }}>
                                                  Status: <span style={{ color: taskRemark.completed ? "#10b981" : "#f59e0b", fontWeight: "bold" }}>{taskRemark.completed ? "Completed" : "In Progress"}</span>
                                                  {taskRemark.remarks && ` | Remarks: "${taskRemark.remarks}"`}
                                                </span>
                                              )}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)", borderRadius: "8px", padding: "3rem", height: "100%", color: "var(--text-muted)" }}>
                        <p style={{ fontStyle: "italic" }}>Loading locomotive operations details...</p>
                      </div>
                    )
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)", borderRadius: "8px", padding: "3rem", height: "100%", color: "var(--text-muted)" }}>
                      <p style={{ fontStyle: "italic" }}>Select a locomotive number to see its active operations preview.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}
        </section>
      </div>

      {/* ── SECTION 3: Views ── */}
      <section className="view-content-card" style={{ marginBottom: "3rem" }}>
        <h2>Employee Assignments View</h2>
        <div className="views-tabs" style={{ marginTop: "1rem" }}>
          <button className={`view-tab-btn ${activeViewTab === "loco" ? "active" : ""}`} onClick={() => setActiveViewTab("loco")}>
            By Loco View
          </button>
          <button className={`view-tab-btn ${activeViewTab === "supervisor" ? "active" : ""}`} onClick={() => setActiveViewTab("supervisor")}>
            By Supervisor View
          </button>
          <button className={`view-tab-btn ${activeViewTab === "staff" ? "active" : ""}`} onClick={() => setActiveViewTab("staff")}>
            By Staff View
          </button>
        </div>

        {viewsData === null ? (
          <p>Loading views data...</p>
        ) : (
          <div>
            {activeViewTab === "loco" && (
              <div>
                {viewsData.by_loco.length === 0 && <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No assignments found.</p>}
                {viewsData.by_loco.map(lData => (
                  <div key={lData.loco_number} className="view-item-box">
                    <h3>Locomotive #{lData.loco_number}</h3>
                    <div className="view-details-grid">
                      {lData.supervisors.map(sup => (
                        <div key={sup.supervisor_ticket_number} className="sub-detail-group">
                          <div className="sub-detail-title">
                            Supervisor: {sup.supervisor_name} (Ticket #{sup.supervisor_ticket_number})
                            {!sup.is_forwarded && <span style={{ color: "red", fontSize: "0.75rem", marginLeft: 8 }}>(Draft)</span>}
                          </div>
                          {sup.staff.length === 0 ? (
                            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>No staff assigned.</p>
                          ) : (
                            <ul className="sub-detail-list">
                              {sup.staff.map(st => (
                                <li key={st.staff_ticket_number}>{st.staff_name} (Ticket #{st.staff_ticket_number})</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeViewTab === "supervisor" && (
              <div>
                {viewsData.by_supervisor.length === 0 && <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No supervisor assignments found.</p>}
                {viewsData.by_supervisor.map(sData => (
                  <div key={sData.supervisor_ticket_number} className="view-item-box">
                    <h3>Supervisor: {sData.supervisor_name} (Ticket #{sData.supervisor_ticket_number})</h3>
                    <div className="view-details-grid">
                      {sData.locos.map(l => (
                        <div key={l.loco_number} className="sub-detail-group">
                          <div className="sub-detail-title">Loco #{l.loco_number}</div>
                          {l.staff.length === 0 ? (
                            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>No staff assigned.</p>
                          ) : (
                            <ul className="sub-detail-list">
                              {l.staff.map(st => (
                                <li key={st.staff_ticket_number}>{st.staff_name} (Ticket #{st.staff_ticket_number})</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeViewTab === "staff" && (
              <div>
                {viewsData.by_staff.length === 0 && <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No staff assignments found.</p>}
                {viewsData.by_staff.map(stData => (
                  <div key={stData.staff_ticket_number} className="view-item-box">
                    <h3>Staff: {stData.staff_name} (Ticket #{stData.staff_ticket_number})</h3>
                    <div className="view-details-grid">
                      {stData.assignments.map((asg, idx) => (
                        <div key={idx} className="sub-detail-group">
                          <div className="sub-detail-title">Loco #{asg.loco_number}</div>
                          <span style={{ fontSize: "0.85rem" }}>Supervisor: {asg.supervisor_name} (Ticket #{asg.supervisor_ticket_number})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── SECTION 4: Remarks & Carry Forward ── */}
      {currentUser && (currentUser.designation_id === 1 || currentUser.designation_id === 2) && (
        <section className="view-content-card" id="remarks-section">
          <h2>Job Completion Status &amp; Carry Forward Panel</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "-0.5rem" }}>
            Submit remarks for non-completed operations or carry forward tasks to the next shift.
          </p>

          <div style={{ display: "flex", gap: "1rem", margin: "1.5rem 0", flexWrap: "wrap" }}>
            {locos.map(locoNum => (
              <button
                key={locoNum}
                className={`back-btn ${locoJobs?.loco_number === locoNum ? 'active' : ''}`}
                style={locoJobs?.loco_number === locoNum ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
                onClick={() => loadLocoJobs(locoNum)}
              >
                <ClipboardList size={16} /> Loco #{locoNum}
              </button>
            ))}
          </div>

          {locoJobs && (
            <div className="remarks-loco-card">
              <h3>In-Progress Operations for Loco #{locoJobs.loco_number}</h3>
              <div className="remarks-grid" style={{ marginTop: "1rem" }}>
                
                {locoJobs.jobs.length === 0 && <p>No operations booked for this locomotive.</p>}
                
                {locoJobs.jobs.map(job => (
                  <div key={job.job_id} className="remarks-row-item">
                    <div className="remarks-row-item-header">
                      <strong>{job.job_description}</strong>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                        <input
                          type="checkbox"
                          checked={remarksState[job.job_id]?.completed ?? false}
                          onChange={e => {
                            const val = e.target.checked;
                            setRemarksState(prev => ({
                              ...prev,
                              [job.job_id]: { ...prev[job.job_id], completed: val }
                            }));
                          }}
                        />
                        Completed
                      </label>
                    </div>
                    <textarea
                      placeholder="Add Job Remarks (reason for non-completion or faults found during testing)..."
                      className="remarks-textarea"
                      value={remarksState[job.job_id]?.remarks ?? ""}
                      onChange={e => {
                        const val = e.target.value;
                        setRemarksState(prev => ({
                          ...prev,
                          [job.job_id]: { ...prev[job.job_id], remarks: val }
                        }));
                      }}
                    />

                    {/* Task specific remarks */}
                    {job.tasks.length > 0 && (
                      <div style={{ marginLeft: "1.5rem", marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>Tasks</span>
                        {job.tasks.map(task => (
                          <div key={task.task_id} className="remarks-row-item" style={{ background: "var(--bg-secondary)", margin: 0, padding: "0.75rem" }}>
                            <div className="remarks-row-item-header">
                              <span style={{ fontSize: "0.85rem" }}>{task.task_description}</span>
                              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem" }}>
                                <input
                                  type="checkbox"
                                  checked={taskRemarksState[task.task_id]?.completed ?? false}
                                  onChange={e => {
                                    const val = e.target.checked;
                                    setTaskRemarksState(prev => ({
                                      ...prev,
                                      [task.task_id]: { ...prev[task.task_id], completed: val }
                                    }));
                                  }}
                                />
                                Completed
                              </label>
                            </div>
                            <input
                              type="text"
                              placeholder="Task specific remarks..."
                              className="config-input"
                              style={{ width: "100%", padding: "0.35rem 0.5rem", fontSize: "0.8rem" }}
                              value={taskRemarksState[task.task_id]?.remarks ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setTaskRemarksState(prev => ({
                                  ...prev,
                                  [task.task_id]: { ...prev[task.task_id], remarks: val }
                                }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Carry Forward Section */}
                <div className="carry-forward-section">
                  <h3>Carry Forward to Next Shift</h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Select new jobs or type additional tasks to be carry-forwarded directly into next shift's work bookings.
                  </p>

                  <div style={{ marginTop: "1rem" }}>
                    <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Add Carry Forward Job</label>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <select
                        id="carryForwardJobSelect"
                        className="config-select"
                        style={{ flex: 1 }}
                        defaultValue=""
                        onChange={e => {
                          const val = e.target.value;
                          if (val) {
                            handleAddCarryForwardJob(parseInt(val));
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="">-- Choose Job --</option>
                        {allMasterJobs.map(mj => (
                          <option key={mj.job_id} value={mj.job_id}>{mj.job_description}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {newJobs.length > 0 && (
                    <div style={{ marginTop: "1rem" }}>
                      <strong>Selected Jobs for Next Shift:</strong>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                        {newJobs.map(jobId => {
                          const job = allMasterJobs.find(mj => mj.job_id === jobId);
                          return (
                            <span key={jobId} className="warning-badge" style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent)", padding: "0.35rem 0.75rem", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                              {job ? job.job_description : `#${jobId}`}
                              <button style={{ background: "none", border: "none", color: "red", cursor: "pointer", fontWeight: "bold" }} onClick={() => handleRemoveCarryForwardJob(jobId)}>x</button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add carry forward tasks under selected jobs */}
                  {(locoJobs.jobs.map(j => j.job_id).concat(newJobs)).length > 0 && (
                    <div style={{ marginTop: "1.5rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Add New Tasks for Next Shift</label>
                      <div className="new-tasks-list">
                        {locoJobs.jobs.concat(newJobs.map(id => ({ job_id: id, job_description: allMasterJobs.find(mj => mj.job_id === id)?.job_description ?? "", stage: 5, tasks: [] }))).map(job => (
                          <div key={job.job_id} className="new-task-entry" style={{ marginTop: "0.5rem" }}>
                            <input
                              type="text"
                              placeholder={`Add task for "${job.job_description}"...`}
                              value={typedTask[job.job_id] || ""}
                              onChange={e => setTypedTask(prev => ({ ...prev, [job.job_id]: e.target.value }))}
                            />
                            <button onClick={() => handleAddCarryForwardTask(job.job_id)}>Add Task</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {newTasks.length > 0 && (
                    <div style={{ marginTop: "1rem" }}>
                      <strong>New Tasks added for Next Shift:</strong>
                      <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
                        {newTasks.map((nt, idx) => {
                          const job = allMasterJobs.find(mj => mj.job_id === nt.job_id);
                          return (
                            <li key={idx} style={{ marginBottom: "0.25rem" }}>
                              <strong>{job ? job.job_description : `#${nt.job_id}`}</strong>: {nt.task_description}
                              <button style={{ background: "none", border: "none", color: "red", cursor: "pointer", marginLeft: "0.5rem" }} onClick={() => handleRemoveCarryForwardTask(idx)}>Remove</button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                </div>

                <button
                  className="btn-primary-action"
                  style={{ width: "100%", marginTop: "1.5rem" }}
                  onClick={handleSubmitRemarks}
                  disabled={!!lockOwner}
                >
                  Submit Remarks &amp; Carry Forward Incomplete Work
                </button>

              </div>
            </div>
          )}
        </section>
      )}

    </div>
  );
};

export default EmployeesBookingWizard;
