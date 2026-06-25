import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Clock,
  Calendar,
  Lock,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import AvailabilityGroup from "./components/AvailabilityGroup";
import "./EmployeesBooking.css";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
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
  let nextShift: number;
  
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

const EmployeeAvailability = () => {
  const navigate = useNavigate();
  
  // User info
  const [currentUser, setCurrentUser] = useState<{ ticket_number: number; name: string; designation_id: number; is_supervisor: boolean } | null>(null);

  // Filters & State
  const [dateStr, setDateStr] = useState(todayISO());
  const [shift, setShift] = useState(guessShift());

  // Data lists
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableTickets, setAvailableTickets] = useState<Set<number>>(new Set());

  // Lock management
  const [lockOwner, setLockOwner] = useState<{ name: string; ticket_number: number } | null>(null);
  const lockTimer = useRef<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch current logged in user info
  useEffect(() => {
    api.get("/auth/me")
      .then(res => {
        setCurrentUser(res.data);
      })
      .catch(() => {
        navigate("/login");
      });
  }, [navigate]);

  // Acquire lock heartbeat
  const refreshLock = useCallback(async () => {
    try {
      await api.post("/bookings/employees/bookings/lock", { date_str: dateStr, shift });
      setLockOwner(null); // Success
    } catch (err) {
      const error = err as { response?: { status?: number; data?: { detail?: string } } };
      if (error.response?.status === 409) {
        const detail = error.response.data?.detail || "";
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
    if (!currentUser) return;
    if (lockTimer.current) {
      clearInterval(lockTimer.current);
    }
    // Attempt to acquire lock immediately
    const timer = setTimeout(() => {
      refreshLock();
    }, 0);
    lockTimer.current = window.setInterval(refreshLock, 15000);

    return () => {
      clearTimeout(timer);
      if (lockTimer.current) {
        clearInterval(lockTimer.current);
      }
      // Unlock on component clean-up
      api.post("/bookings/employees/bookings/unlock", { date_str: dateStr, shift }).catch(() => {});
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
    } catch (err) {
      console.error("Error fetching availability data", err);
    }
  }, [dateStr, shift]);

  useEffect(() => {
    if (currentUser) {
      const timer = setTimeout(() => {
        fetchData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentUser, dateStr, shift, fetchData]);

  // ── Availability Toggler ──
  const handleToggleAvailability = async (ticket: number) => {
    if (!dateStr) {
      alert("Please select a valid date.");
      return;
    }
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
    } catch {
      alert("Failed to update availability.");
    }
  };

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

  // Grouping structure to segregate by category and designation while preserving sorting
  const groupedEmployees = (() => {
    const categories: Array<{
      category_id: number;
      category_name: string;
      designations: Array<{
        designation_id: number;
        designation_name: string;
        employees: Employee[];
      }>;
    }> = [];

    filteredEmployees.forEach(emp => {
      let cat = categories.find(c => c.category_id === emp.category_id);
      if (!cat) {
        cat = {
          category_id: emp.category_id,
          category_name: emp.category_name,
          designations: []
        };
        categories.push(cat);
      }

      let desig = cat.designations.find(d => d.designation_id === emp.designation_id);
      if (!desig) {
        desig = {
          designation_id: emp.designation_id,
          designation_name: emp.designation_name,
          employees: []
        };
        cat.designations.push(desig);
      }

      desig.employees.push(emp);
    });

    return categories;
  })();

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
          </div>
        </div>

        <div className="title-area">
          <Users className="header-icon" size={32} />
          <div>
            <h1>Employee Availability Setup</h1>
            <p>Set active shift availability for supervisors and staff.</p>
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
            Warning: You are viewing/editing availability for a shift other than the current or next shift. Please verify date and shift selection.
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

      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <section className="panel-card">
          <h2>Select Employees Available (Current Shift)</h2>

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

          <div className="availability-list" style={{ maxHeight: "600px", paddingRight: "0.25rem" }}>
            <AvailabilityGroup
              groupedEmployees={groupedEmployees}
              availableTickets={availableTickets}
              handleToggleAvailability={handleToggleAvailability}
              lockOwner={lockOwner}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default EmployeeAvailability;
