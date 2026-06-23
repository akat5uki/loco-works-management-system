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
  const [tempSupervisorLocos, setTempSupervisorLocos] = useState<Record<number, string[]>>({});
  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  
  // Staff Selection Map (Loco ID -> array of Staff tickets)
  const [locoStaffMap, setLocoStaffMap] = useState<Record<string, number[]>>({});

  // Carry Forward State (Read-only status preview)
  const [locoJobs, setLocoJobs] = useState<ActiveLocoJobs | null>(null);
  const [remarksState, setRemarksState] = useState<Record<number, { completed: boolean; remarks: string }>>({});
  const [taskRemarksState, setTaskRemarksState] = useState<Record<number, { completed: boolean; remarks: string }>>({});

  // Active View Tab
  const [activeViewTab, setActiveViewTab] = useState<"loco" | "supervisor" | "staff">("loco");

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
    if (!dateStr) return;
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
      if (dateStr) {
        api.post("/bookings/employees/bookings/unlock", { date_str: dateStr, shift }).catch(() => {});
      }
    };
  }, [currentUser, dateStr, shift, refreshLock]);




  // Primary Fetch Function
  const fetchData = useCallback(async () => {
    if (!dateStr) return;
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
          const key = String(b.loco_number);
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
  }, [dateStr, shift]);





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
    if (!dateStr) {
      alert("Please select a valid date.");
      return;
    }
    if (lockOwner || !selectedLoco) return;

    const staffList = locoStaffMap[selectedLoco] || [];

    // Find the supervisors linked to this locomotive from tempSupervisorLocos
    const linkedSupervisorTickets = supervisorList
      .filter(sup => {
        const assignedLocos = tempSupervisorLocos[sup.ticket_number] || [];
        return assignedLocos.includes(selectedLoco);
      })
      .map(sup => sup.ticket_number);

    if (linkedSupervisorTickets.length === 0) {
      alert(`No supervisors are assigned to Loco #${selectedLoco}. Cannot save staff bookings.`);
      return;
    }

    setSaving(true);
    try {
      // For each supervisor linked to this loco, save the staff list
      const promises = linkedSupervisorTickets.map(supTicket => {
        const payload = {
          date_str: dateStr,
          shift,
          loco_number: selectedLoco,
          supervisor_ticket_number: supTicket,
          staff_ticket_numbers: staffList,
          forward: true
        };
        return api.post("/bookings/employees/bookings", payload);
      });

      await Promise.all(promises);
      alert(`Staff assignments for Loco #${selectedLoco} saved successfully!`);
      fetchData();
    } catch (err: any) {
      alert("Failed to save staff: " + (err.response?.data?.detail ?? "Error"));
    } finally {
      setSaving(false);
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
    if (lockOwner || !selectedLoco || !currentUser) return;
    
    const key = selectedLoco;
    const currentStaffList = locoStaffMap[key] || [];
    let updatedStaffList: number[];
    if (currentStaffList.includes(staffTicket)) {
      updatedStaffList = currentStaffList.filter(t => t !== staffTicket);
    } else {
      updatedStaffList = [...currentStaffList, staffTicket];
    }
    setLocoStaffMap(prev => ({
      ...prev,
      [key]: updatedStaffList
    }));
  };

  // Helper: check if staff is booked on other locomotives or under other supervisors
  const getStaffWarning = (staffTicket: number) => {
    // 1. Check saved bookings from the database (excluding current locomotive)
    const dbB = bookings.filter(
      b => b.staff_ticket_number === staffTicket && b.loco_number !== selectedLoco
    );
    const details: string[] = [];

    // Check for double booking (assigned to different locos)
    const otherLocos = new Set<string>();
    dbB.forEach(b => {
      otherLocos.add(String(b.loco_number));
    });

    // Check unsaved selections in locoStaffMap (excluding current selectedLoco)
    Object.entries(locoStaffMap).forEach(([lNum, staffList]) => {
      if (lNum !== selectedLoco && staffList.includes(staffTicket)) {
        otherLocos.add(lNum);
      }
    });

    if (otherLocos.size > 0) {
      details.push(`Loco #${Array.from(otherLocos).join(", #")}`);
    }

    // Check for multiple supervisors (booked under >1 unique supervisor)
    // 1. From database bookings:
    const dbSupervisors = bookings
      .filter(b => b.staff_ticket_number === staffTicket && b.supervisor_ticket_number)
      .map(b => b.supervisor_ticket_number);

    // 2. From unsaved selections:
    const unsavedSupervisors: number[] = [];
    Object.entries(locoStaffMap).forEach(([lNum, staffList]) => {
      if (staffList.includes(staffTicket)) {
        const linkedSups = supervisorList.filter(sup => {
          const assignedLocos = tempSupervisorLocos[sup.ticket_number] || [];
          return assignedLocos.includes(lNum);
        }).map(s => s.ticket_number);
        unsavedSupervisors.push(...linkedSups);
      }
    });

    const allSupTickets = Array.from(new Set([...dbSupervisors, ...unsavedSupervisors]));

    if (allSupTickets.length > 1) {
      const names = allSupTickets.map(t => {
        const emp = employees.find(e => e.ticket_number === t);
        return emp ? emp.name : `Supervisor #${t}`;
      });
      details.push(`multiple supervisors: ${names.join(", ")}`);
    }

    if (details.length > 0) {
      return `Booked: ${details.join(" | ")}`;
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

    } catch (err) {
      console.error("Failed to load jobs/tasks", err);
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

  const checkStep1Unsaved = () => {
    const savedMap: Record<number, string[]> = {};
    bookings.forEach(b => {
      if (b.supervisor_ticket_number && !b.staff_ticket_number) {
        if (!savedMap[b.supervisor_ticket_number]) {
          savedMap[b.supervisor_ticket_number] = [];
        }
        if (!savedMap[b.supervisor_ticket_number].includes(b.loco_number)) {
          savedMap[b.supervisor_ticket_number].push(b.loco_number);
        }
      }
    });

    for (const sup of supervisorList) {
      const tempLocos = [...(tempSupervisorLocos[sup.ticket_number] || [])].sort();
      const savedLocos = [...(savedMap[sup.ticket_number] || [])].sort();
      if (tempLocos.length !== savedLocos.length) return true;
      for (let i = 0; i < tempLocos.length; i++) {
        if (tempLocos[i] !== savedLocos[i]) return true;
      }
    }
    return false;
  };
  const isStep1Unsaved = checkStep1Unsaved();
  const isStep2Disabled = !hasSavedSupervisors || isStep1Unsaved;

  const staffList = getSortedEmployeesList().filter(e => e.designation_id > 2);


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

      {/* Shift Edit Restriction Warning Overlay */}
      {!isCurrentOrNextShift(dateStr, shift) && (
        <div className="lock-banner" style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid #f59e0b", color: "#f59e0b" }}>
          <AlertTriangle size={18} />
          <span>
            Warning: You are viewing/editing bookings for a shift other than the current or next shift. Please verify date and shift selection before saving.
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
            required={true}
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

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem", marginBottom: "3rem" }}>
        {/* ── PANEL: Actual Booking Wizard ── */}
        <section className="panel-card">
          <h2>Book Employees to Locomotives</h2>
          
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
                  onClick={() => !isStep2Disabled && setActiveStep(2)}
                  disabled={isStep2Disabled}
                  style={{
                    padding: "0.75rem 1rem",
                    border: "none",
                    background: "none",
                    fontWeight: "bold",
                    color: activeStep === 2 ? "var(--accent)" : "var(--text-muted)",
                    borderBottom: activeStep === 2 ? "3px solid var(--accent)" : "none",
                    cursor: !isStep2Disabled ? "pointer" : "not-allowed",
                    opacity: !isStep2Disabled ? 1 : 0.5,
                    fontSize: "1rem"
                  }}
                >
                  Step 2: Book Staff under Supervisors
                </button>
              </div>

              {isStep1Unsaved && activeStep === 1 && (
                <div style={{ color: "#f59e0b", fontSize: "0.85rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <AlertTriangle size={14} />
                  <span>You have unsaved changes in Step 1. Save assignments to enable Step 2.</span>
                </div>
              )}

              {/* Main Panel Layout: Split-screen column view */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem", marginTop: "1rem" }}>
                
                {/* Column 1: Forms based on active step */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  
                  {activeStep === 1 && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1.5rem", background: "rgba(255,255,255,0.01)" }}>
                      <h3 style={{ marginTop: 0, fontSize: "1.2rem", color: "var(--text-h)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        Assign Available Supervisors to Locomotives
                      </h3>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
                        Select the supervisors assigned to each locomotive. You can also click a locomotive card to preview its operations. Supervisor bookings must be fully saved to proceed to staff booking.
                      </p>

                      {supervisorList.filter(sup => availableTickets.has(sup.ticket_number)).length === 0 ? (
                        <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                          No available supervisors found. Please mark them available in the availability list.
                        </p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "400px", overflowY: "auto", paddingRight: "0.5rem", marginBottom: "1.5rem" }}>
                          {locos.map(locoNum => {
                            const isSelectedForPreview = selectedLoco === locoNum;
                            // Find all supervisors assigned to this locomotive
                            const assignedSupervisors = supervisorList
                              .filter(sup => availableTickets.has(sup.ticket_number))
                              .filter(sup => (tempSupervisorLocos[sup.ticket_number] || []).includes(locoNum));

                            return (
                              <div
                                key={locoNum}
                                onClick={() => setSelectedLoco(locoNum)}
                                style={{
                                  border: `1px solid ${isSelectedForPreview ? "var(--accent)" : "var(--border)"}`,
                                  borderRadius: "8px",
                                  padding: "1rem",
                                  background: "var(--bg)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.5rem",
                                  cursor: "pointer",
                                  boxShadow: isSelectedForPreview ? "0 0 0 1px var(--accent)" : "none",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <strong style={{ fontSize: "0.95rem" }}>Locomotive #{locoNum}</strong>
                                  {assignedSupervisors.length > 0 && (
                                    <span style={{ fontSize: "0.75rem", background: "var(--accent-bg)", color: "var(--accent)", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                                      {assignedSupervisors.length} Supervisor(s) Assigned
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                                  {supervisorList
                                    .filter(sup => availableTickets.has(sup.ticket_number))
                                    .map(sup => {
                                      const isAssigned = (tempSupervisorLocos[sup.ticket_number] || []).includes(locoNum);
                                      return (
                                        <div
                                          key={sup.ticket_number}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.4rem",
                                            padding: "0.4rem 0.8rem",
                                            borderRadius: "20px",
                                            border: `1px solid ${isAssigned ? "var(--accent)" : "var(--border)"}`,
                                            background: isAssigned ? "var(--accent-bg)" : "var(--bg-secondary)",
                                            cursor: "pointer",
                                            userSelect: "none",
                                            fontSize: "0.85rem",
                                            fontWeight: "bold",
                                            color: isAssigned ? "var(--accent)" : "var(--text-muted)"
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleSupervisorLoco(sup.ticket_number, locoNum);
                                          }}
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
                                          <span>{sup.name} (SSE/JE)</span>
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
                        Assign Staff to Locomotive
                      </h3>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem", marginTop: "1rem", marginBottom: "1.5rem" }}>
                        <div>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "bold" }}>Select Locomotive</label>
                          <select
                            className="config-select"
                            style={{ width: "100%", marginTop: "0.5rem" }}
                            value={selectedLoco || ""}
                            onChange={e => setSelectedLoco(e.target.value || null)}
                            disabled={!!lockOwner}
                          >
                            <option value="">-- Choose Locomotive --</option>
                            {locos.map(locoNum => (
                              <option key={locoNum} value={locoNum}>
                                Loco #{locoNum}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {selectedLoco && (() => {
                        // Find supervisors assigned to selectedLoco in Step 1/tempSupervisorLocos
                        const assignedSupervisors = supervisorList.filter(sup => {
                          const assignedLocos = tempSupervisorLocos[sup.ticket_number] || [];
                          return assignedLocos.includes(selectedLoco);
                        });

                        if (assignedSupervisors.length === 0) {
                          return (
                            <div style={{ padding: "1rem", background: "rgba(245, 158, 11, 0.08)", border: "1px solid #f59e0b", borderRadius: "6px", color: "#f59e0b", fontSize: "0.9rem" }}>
                              <AlertTriangle size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                              No supervisors are assigned to Loco #{selectedLoco}. Staff booking is not required for this locomotive.
                            </div>
                          );
                        }

                        const key = selectedLoco;

                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1.25rem", background: "var(--bg)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                              <h4 style={{ margin: "0", color: "var(--text-h)", fontSize: "1.05rem" }}>
                                Staff Assignments for Loco #{selectedLoco}
                              </h4>
                              
                              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", background: "var(--bg-card)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border)" }}>
                                <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "var(--text-muted)" }}>Linked Supervisors:</span>
                                {assignedSupervisors.map(sup => (
                                  <span key={sup.ticket_number} style={{ fontSize: "0.8rem", background: "rgba(99, 102, 241, 0.12)", color: "var(--accent)", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
                                    {sup.name} ({sup.designation_name})
                                  </span>
                                ))}
                              </div>

                              <div className="staff-hierarchy-list" style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid var(--border)", padding: "0.75rem", borderRadius: "6px", background: "var(--bg-card)", marginBottom: "0.5rem" }}>
                                {Object.entries(groupedStaffList)
                                  .sort((a, b) => {
                                    const aDesigId = a[1][0]?.designation_id || 99;
                                    const bDesigId = b[1][0]?.designation_id || 99;
                                    return aDesigId - bDesigId;
                                  })
                                  .map(([desigName, staffMembers]) => (
                                    <div key={desigName} className="hierarchy-section" style={{ marginBottom: "1rem" }}>
                                      <h5 style={{ margin: "0 0 0.5rem 0", borderBottom: "1px solid var(--border)", paddingBottom: "0.25rem", color: "var(--accent)" }}>{desigName}</h5>
                                      <div className="hierarchy-items" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                        {staffMembers.map(staff => {
                                          const isAvailable = availableTickets.has(staff.ticket_number);
                                          const isChecked = (locoStaffMap[key] || []).includes(staff.ticket_number);
                                          const warning = getStaffWarning(staff.ticket_number);
                                          const isMultipleSups = warning && warning.includes("multiple supervisors");

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
                                              {!isAvailable && <span className="warning-badge" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", fontSize: "0.75rem" }}>Unavailable</span>}
                                              {warning && (
                                                <span 
                                                  className="warning-badge" 
                                                  style={{ 
                                                    background: isMultipleSups ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.1)", 
                                                    color: "#f59e0b", 
                                                    fontSize: "0.75rem",
                                                    border: isMultipleSups ? "1px solid rgba(245,158,11,0.4)" : "none",
                                                    fontWeight: isMultipleSups ? "bold" : "normal"
                                                  }}
                                                >
                                                  <AlertTriangle size={10} style={{ marginRight: 3 }} /> {warning}
                                                </span>
                                              )}
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
                                disabled={!!lockOwner || saving}
                              >
                                {saving ? "Saving Staff Assignments..." : `Save Staff Assignments for Loco #${selectedLoco}`}
                              </button>
                            </div>
                          </div>
                        );
                      })()}
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



    </div>
  );
};

export default EmployeesBookingWizard;
