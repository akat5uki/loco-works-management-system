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
  AlertTriangle
} from "lucide-react";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import WizardProgress from "./components/WizardProgress";
import SupervisorAssignStep from "./components/SupervisorAssignStep";
import StaffAssignStep from "./components/StaffAssignStep";
import LocoOpsPreview from "./components/LocoOpsPreview";
import AssignmentsView from "./components/AssignmentsView";
import NotificationBell from "./components/NotificationBell";
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

  // Keep a ref so fetchData can read the current selectedLoco without being
  // listed as a dependency (avoids re-triggering full data fetch on loco switch)
  const selectedLocoRef = useRef<string | null>(null);
  useEffect(() => { selectedLocoRef.current = selectedLoco; }, [selectedLoco]);

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
      if (selectedLocoRef.current && !locosRes.data.locos.includes(selectedLocoRef.current)) {
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
      if (!selectedLocoRef.current && locosRes.data.locos.length > 0) {
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
  }, [dateStr, shift]);  // ← selectedLoco intentionally excluded; read via ref below

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const loadLocoJobs = useCallback(async (locoNum: string) => {
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
  }, [dateStr, shift]);




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
          <button className="back-btn" onClick={() => navigate("/dashboard")} type="button">
            <ArrowLeft size={18} /> Dashboard
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <ThemeToggle />
            
            {/* Notification Center */}
            <NotificationBell
              notifications={notifications}
              handleMarkAsRead={handleMarkAsRead}
            />
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
        <button className="back-btn" onClick={fetchData} style={{ height: "38px" }} type="button">
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      <div className="wizard-split-layout">
        {/* ── PANEL: Actual Booking Wizard ── */}
        <section className="panel-card wizard-panel-card">
          <h2>Book Employees to Locomotives</h2>
          
          {locos.length === 0 ? (
            <div className="empty-wizard-state-card" style={{ textAlign: "center", padding: "2rem" }}>
              <Train size={36} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
              <p style={{ color: "var(--text-muted)" }}>No locomotives are booked in this shift. Assign locos under "Loco Booking" first.</p>
            </div>
          ) : (
            <div className="booking-form-wizard">
              {/* Step Navigation Indicator */}
              <WizardProgress
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                isStep2Disabled={isStep2Disabled}
                isStep1Unsaved={isStep1Unsaved}
              />

              {/* Main Panel Layout: Split-screen column view */}
              <div className="wizard-form-ops-split">
                
                {/* Column 1: Forms based on active step */}
                <div className="wizard-active-step-column">
                  {activeStep === 1 && (
                    <SupervisorAssignStep
                      locos={locos}
                      supervisorList={supervisorList}
                      availableTickets={availableTickets}
                      tempSupervisorLocos={tempSupervisorLocos}
                      handleToggleSupervisorLoco={handleToggleSupervisorLoco}
                      handleSaveSupervisors={handleSaveSupervisors}
                      lockOwner={lockOwner}
                      saving={saving}
                    />
                  )}

                  {activeStep === 2 && (
                    <StaffAssignStep
                      locos={locos}
                      selectedLoco={selectedLoco}
                      setSelectedLoco={setSelectedLoco}
                      supervisorList={supervisorList}
                      tempSupervisorLocos={tempSupervisorLocos}
                      groupedStaffList={groupedStaffList}
                      availableTickets={availableTickets}
                      locoStaffMap={locoStaffMap}
                      handleToggleStaffSelection={handleToggleStaffSelection}
                      getStaffWarning={getStaffWarning}
                      handleSaveStaff={handleSaveStaff}
                      lockOwner={lockOwner}
                      saving={saving}
                    />
                  )}
                </div>

                {/* Column 2: Locomotive Operations Detail (visible in both steps!) */}
                <div className="wizard-ops-preview-column">
                  <LocoOpsPreview
                    selectedLoco={selectedLoco}
                    locos={locos}
                    setSelectedLoco={setSelectedLoco}
                    locoJobs={locoJobs}
                    remarksState={remarksState}
                    taskRemarksState={taskRemarksState}
                  />
                </div>

              </div>

            </div>
          )}
        </section>
      </div>

      {/* ── SECTION 3: Views ── */}
      <AssignmentsView
        viewsData={viewsData}
        activeViewTab={activeViewTab}
        setActiveViewTab={setActiveViewTab}
      />
    </div>
  );
};

export default EmployeesBookingWizard;
