import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Train } from "lucide-react";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import "./EmployeesBooking.css";

import PreviewFilterBar from "./components/preview/PreviewFilterBar";
import AvailabilitySummary from "./components/preview/AvailabilitySummary";
import LocoSummaryCard from "./components/preview/LocoSummaryCard";
import { generateShiftSummaryPDF } from "./utils/pdf/pdfGenerator";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
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



interface ViewsData {
  by_loco: Array<{
    loco_number: string;
    status: string;
    supervisors: Array<{
      supervisor_ticket_number: number;
      supervisor_name: string;
      is_forwarded: boolean;
      staff: Array<{ staff_ticket_number: number; staff_name: string }>;
    }>;
  }>;
}

interface CurrentUser {
  ticket_number: number;
  name: string;
  designation_id: number;
  is_supervisor: boolean;
}

interface RemarkInfo {
  completed: boolean;
  remarks: string;
}

interface LocoRemarks {
  jobs: Record<number, RemarkInfo>;
  tasks: Record<number, RemarkInfo>;
}

interface BookingResponseItem {
  shift: number;
  loco_number: number | string;
  job_id: number;
  job_description: string;
  task_id?: number | null;
  task_description?: string | null;
}

interface RemarkResponseItem {
  loco_number: number | string;
  job_id: number;
  task_id: number | null;
  completed: boolean;
  remarks: string;
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

const EMPTY_JOBS: JobInfo[] = [];

const BookingPreview = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Filters & State
  const [dateStr, setDateStr] = useState(todayISO());
  const [shift, setShift] = useState(guessShift());

  // Data lists
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableTickets, setAvailableTickets] = useState<Set<number>>(new Set());
  const [viewsData, setViewsData] = useState<ViewsData | null>(null);
  const [allLocoJobs, setAllLocoJobs] = useState<Record<string, JobInfo[]>>({});
  const [remarksState, setRemarksState] = useState<Record<string, LocoRemarks>>({}); // loco_number -> job_id/task_id remarks
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const isNodeExpanded = useCallback((nodeId: string, defaultVal = true) => {
    return expandedNodes[nodeId] ?? defaultVal;
  }, [expandedNodes]);

  const toggleNode = useCallback((nodeId: string, defaultVal = true) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !(prev[nodeId] ?? defaultVal)
    }));
  }, []);

  const expandAll = () => {
    if (!viewsData?.by_loco) return;
    const next: Record<string, boolean> = {};
    viewsData.by_loco.forEach(l => {
      const locoNum = l.loco_number;
      next[locoNum] = true;
      next[`${locoNum}-supervisors-group`] = true;
      next[`${locoNum}-staffs-group`] = true;
      next[`${locoNum}-operations`] = true;
      const jobs = allLocoJobs[locoNum] || [];
      jobs.forEach(j => {
        next[`${locoNum}-job-${j.job_id}`] = true;
      });
    });
    setExpandedNodes(next);
  };

  const collapseAll = () => {
    if (!viewsData?.by_loco) return;
    const next: Record<string, boolean> = {};
    viewsData.by_loco.forEach(l => {
      const locoNum = l.loco_number;
      next[locoNum] = false;
      next[`${locoNum}-supervisors-group`] = false;
      next[`${locoNum}-staffs-group`] = false;
      next[`${locoNum}-operations`] = false;
      const jobs = allLocoJobs[locoNum] || [];
      jobs.forEach(j => {
        next[`${locoNum}-job-${j.job_id}`] = false;
      });
    });
    setExpandedNodes(next);
  };

  useEffect(() => {
    api.get("/auth/me")
      .then(res => setCurrentUser(res.data))
      .catch(() => navigate("/login"));
  }, [navigate]);

  const fetchData = useCallback(async () => {
    if (!dateStr) return;
    try {
      // 1. Fetch all employees
      const empRes = await api.get("/employees/");
      setEmployees(empRes.data);

      // 2. Fetch availabilities
      const availRes = await api.request({
        method: "QUERY",
        url: "/bookings/employees/availabilities",
        data: { date_str: dateStr, shift: shift }
      });
      setAvailableTickets(new Set(availRes.data.available_tickets));

      // 3. Fetch views
      const viewsRes = await api.request({
        method: "QUERY",
        url: "/bookings/employees/views",
        data: { date_str: dateStr, shift: shift }
      });
      setViewsData(viewsRes.data);

      // 4. Fetch loco bookings (jobs & tasks)
      const bookingsRes = await api.get(`/bookings/?start_date=${dateStr}&end_date=${dateStr}`);
      const shiftBookings = bookingsRes.data.filter((b: BookingResponseItem) => b.shift === shift);
      
      const jobMap: Record<string, Record<number, JobInfo>> = {};
      shiftBookings.forEach((b: BookingResponseItem) => {
        const locoNum = b.loco_number.toString();
        if (!jobMap[locoNum]) jobMap[locoNum] = {};
        if (!jobMap[locoNum][b.job_id]) {
          jobMap[locoNum][b.job_id] = {
            job_id: b.job_id,
            job_description: b.job_description,
            stage: 5,
            tasks: []
          };
        }
        if (b.task_id) {
          jobMap[locoNum][b.job_id].tasks.push({
            task_id: b.task_id,
            task_description: b.task_description ?? ""
          });
        }
      });
      const resolvedJobs: Record<string, JobInfo[]> = {};
      Object.keys(jobMap).forEach(locoNum => {
        resolvedJobs[locoNum] = Object.values(jobMap[locoNum]);
      });
      setAllLocoJobs(resolvedJobs);

      // 5. Fetch remarks
      const remarksRes = await api.get(`/bookings/employees/remarks?date_str=${dateStr}&shift=${shift}`);
      const remState: Record<string, LocoRemarks> = {};
      remarksRes.data.forEach((r: RemarkResponseItem) => {
        const locoNum = r.loco_number.toString();
        if (!remState[locoNum]) remState[locoNum] = { jobs: {}, tasks: {} };
        if (r.task_id === null) {
          remState[locoNum].jobs[r.job_id] = { completed: r.completed, remarks: r.remarks };
        } else {
          remState[locoNum].tasks[r.task_id] = { completed: r.completed, remarks: r.remarks };
        }
      });
      setRemarksState(remState);

    } catch (err) {
      console.error("Error loading preview summary data", err);
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

  // Export to Excel (CSV format)
  const exportToExcel = useCallback(() => {
    let csv = "Employee Availability Summary\n";
    csv += "Ticket Number,Name,Designation,Category,Availability Status\n";
    employees.forEach(emp => {
      const avail = availableTickets.has(emp.ticket_number) ? "Available" : "Unavailable";
      csv += `"${emp.ticket_number}","${emp.name}","${emp.designation_name}","${emp.category_name}","${avail}"\n`;
    });

    csv += "\nLocomotive Assignment Summary\n";
    csv += "Loco Number,Loco Status,Supervisor,Staff Assigned,Job/Task ID,Description,Type,Completion Status,Remarks\n";
    
    if (viewsData?.by_loco) {
      viewsData.by_loco.forEach(l => {
        const locoNum = l.loco_number;
        const locoStatus = l.status || "incomplete";
        const sups = l.supervisors.map(s => s.supervisor_name).join("; ");
        const staff = l.supervisors.flatMap(s => s.staff.map(st => st.staff_name)).join("; ");
        
        const jobs = allLocoJobs[locoNum] || EMPTY_JOBS;
        if (jobs.length === 0) {
          csv += `"${locoNum}","${locoStatus}","${sups}","${staff}","N/A","No operations booked","Job","N/A",""\n`;
        } else {
          jobs.forEach(j => {
            const jobRem = remarksState[locoNum]?.jobs[j.job_id] || { completed: false, remarks: "" };
            csv += `"${locoNum}","${locoStatus}","${sups}","${staff}","${j.job_id}","${j.job_description}","Job","${jobRem.completed ? 'Completed' : 'In Progress'}","${jobRem.remarks}"\n`;
            
            j.tasks.forEach(t => {
              const taskRem = remarksState[locoNum]?.tasks[t.task_id] || { completed: false, remarks: "" };
              csv += `"${locoNum}","${locoStatus}","${sups}","${staff}","${t.task_id}","${t.task_description}","Task","${taskRem.completed ? 'Completed' : 'In Progress'}","${taskRem.remarks}"\n`;
            });
          });
        }
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `shift_summary_${dateStr}_shift_${shift}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [employees, availableTickets, viewsData, allLocoJobs, remarksState, dateStr, shift]);

  const availableEmployees = useMemo(() => {
    return employees.filter(e => availableTickets.has(e.ticket_number));
  }, [employees, availableTickets]);

  const unavailableEmployees = useMemo(() => {
    return employees.filter(e => !availableTickets.has(e.ticket_number));
  }, [employees, availableTickets]);

  const handlePrint = useCallback(() => {
    generateShiftSummaryPDF({
      dateStr,
      shift,
      availableEmployees,
      unavailableEmployees,
      byLoco: viewsData?.by_loco || [],
      allLocoJobs,
      remarksState,
    });
  }, [dateStr, shift, availableEmployees, unavailableEmployees, viewsData, allLocoJobs, remarksState]);

  return (
    <div className="employees-booking-workspace print-container">
      {/* ── HEADER ── */}
      <header className="workspace-header no-print">
        <div className="header-actions">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <ThemeToggle />
          </div>
        </div>

        <div className="title-area">
          <Train className="header-icon" size={32} />
          <div>
            <h1>Shift Summary Preview & Export</h1>
            <p>View daily availability checklist, loco status, and generate exports.</p>
          </div>
        </div>
      </header>

      {/* ── Filter Bar & Warnings ── */}
      <PreviewFilterBar
        dateStr={dateStr}
        setDateStr={setDateStr}
        shift={shift}
        setShift={setShift}
        fetchData={fetchData}
        exportToExcel={exportToExcel}
        handlePrint={handlePrint}
        isCurrentOrNextShift={isCurrentOrNextShift(dateStr, shift)}
      />

      {/* Printable Preview Page */}
      <div className="print-page-layout">
        
        {/* Print Header */}
        <div className="print-only" style={{ display: "none", marginBottom: "2rem", borderBottom: "2px solid #333", paddingBottom: "1rem" }}>
          <h1 className="print-header-title" style={{ margin: 0 }}>Loco Works Management System</h1>
          <p style={{ margin: "0.25rem 0 0 0", color: "#666" }}>Shift Summary Report</p>
          <div style={{ display: "flex", gap: "2rem", marginTop: "1rem", fontWeight: "bold" }}>
            <span>Date: {dateStr}</span>
            <span>Shift: {shift === 1 ? "Shift 1 (Day)" : "Shift 2 (Night)"}</span>
          </div>
        </div>

        {/* 1. Employee Availability Summary */}
        <AvailabilitySummary
          availableEmployees={availableEmployees}
          unavailableEmployees={unavailableEmployees}
        />

        {/* 2. Final Locomotive Assignment Details */}
        <div className="loco-details-section-header">
          <h2 style={{ margin: 0 }}>
            2. Final Locomotive Assignment Details
          </h2>
          <div className="no-print loco-details-buttons">
            <button className="back-btn" onClick={expandAll} style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", height: "auto" }}>Expand All</button>
            <button className="back-btn" onClick={collapseAll} style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", height: "auto" }}>Collapse All</button>
          </div>
        </div>
        {(!viewsData || viewsData.by_loco.length === 0) ? (
          <p style={{ fontStyle: "italic", color: "var(--text-muted)", padding: "1rem 0" }}>No locomotive bookings available for this shift.</p>
        ) : (
          <div className="loco-summary-list">
            {viewsData.by_loco.map(l => (
              <LocoSummaryCard
                key={l.loco_number}
                loco={l}
                jobs={allLocoJobs[l.loco_number] || EMPTY_JOBS}
                isNodeExpanded={isNodeExpanded}
                toggleNode={toggleNode}
                remarksStateForLoco={remarksState[l.loco_number]}
                expandedNodes={expandedNodes}
              />
            ))}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-visible-block {
            display: block !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .employees-booking-workspace {
            padding: 0 !important;
            max-width: 100% !important;
          }
          .print-page-layout {
            border: none !important;
            background: white !important;
            padding: 0 !important;
          }
        }
      `}} />
    </div>
  );
};

export default BookingPreview;
