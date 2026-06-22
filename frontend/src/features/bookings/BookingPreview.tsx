import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Train,
  Clock,
  Calendar,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle
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

const BookingPreview = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filters & State
  const [dateStr, setDateStr] = useState(todayISO());
  const [shift, setShift] = useState(guessShift());

  // Data lists
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableTickets, setAvailableTickets] = useState<Set<number>>(new Set());
  const [viewsData, setViewsData] = useState<ViewsData | null>(null);
  const [allLocoJobs, setAllLocoJobs] = useState<Record<string, JobInfo[]>>({});
  const [remarksState, setRemarksState] = useState<Record<string, any>>({}); // loco_number -> job_id/task_id remarks

  useEffect(() => {
    api.get("/auth/me")
      .then(res => setCurrentUser(res.data))
      .catch(() => navigate("/login"));
  }, [navigate]);

  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch all employees
      const empRes = await api.get("/employees/");
      setEmployees(empRes.data);

      // 2. Fetch availabilities
      const availRes = await api.get(`/bookings/employees/availabilities?date_str=${dateStr}&shift=${shift}`);
      setAvailableTickets(new Set(availRes.data.available_tickets));

      // 3. Fetch views
      const viewsRes = await api.get(`/bookings/employees/views?date_str=${dateStr}&shift=${shift}`);
      setViewsData(viewsRes.data);

      // 4. Fetch loco bookings (jobs & tasks)
      const bookingsRes = await api.get(`/bookings/?start_date=${dateStr}&end_date=${dateStr}`);
      const shiftBookings = bookingsRes.data.filter((b: any) => b.shift === shift);
      
      const jobMap: Record<string, Record<number, JobInfo>> = {};
      shiftBookings.forEach((b: any) => {
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
            task_description: b.task_description
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
      const remState: Record<string, any> = {};
      remarksRes.data.forEach((r: any) => {
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
      fetchData();
    }
  }, [currentUser, dateStr, shift, fetchData]);

  // Export to Excel (CSV format)
  const exportToExcel = () => {
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
        
        const jobs = allLocoJobs[locoNum] || [];
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
  };

  const handlePrint = () => {
    window.print();
  };

  // Group availabilities
  const availableEmployees = employees.filter(e => availableTickets.has(e.ticket_number));
  const unavailableEmployees = employees.filter(e => !availableTickets.has(e.ticket_number));

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

      {/* Warning Banner */}
      {!isCurrentOrNextShift(dateStr, shift) && (
        <div className="lock-banner no-print" style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid #f59e0b", color: "#f59e0b", marginBottom: "1.5rem" }}>
          <AlertTriangle size={18} />
          <span>
            Warning: You are viewing summary data for a shift other than the current or next shift.
          </span>
        </div>
      )}

      {/* ── Global Selection Bar ── */}
      <div className="global-config-bar no-print">
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
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="back-btn" onClick={fetchData} style={{ height: "38px" }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="back-btn" onClick={exportToExcel} style={{ height: "38px", background: "var(--accent)", color: "white", borderColor: "var(--accent)" }}>
            <FileSpreadsheet size={14} /> Export Excel
          </button>
          <button className="back-btn" onClick={handlePrint} style={{ height: "38px" }}>
            <Printer size={14} /> Print PDF
          </button>
        </div>
      </div>

      {/* Printable Preview Page */}
      <div className="print-page-layout" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", padding: "2rem" }}>
        
        {/* Print Header */}
        <div className="print-only" style={{ display: "none", marginBottom: "2rem", borderBottom: "2px solid #333", paddingBottom: "1rem" }}>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>LocoWorks Management System</h1>
          <p style={{ margin: "0.25rem 0 0 0", color: "#666" }}>Shift Summary Report</p>
          <div style={{ display: "flex", gap: "2rem", marginTop: "1rem", fontWeight: "bold" }}>
            <span>Date: {dateStr}</span>
            <span>Shift: {shift === 1 ? "Shift 1 (Day)" : "Shift 2 (Night)"}</span>
          </div>
        </div>

        <h2 style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
          1. Employee Availability Summary (Current Shift)
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
          
          <div>
            <h3 style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.1rem" }}>
              <CheckCircle size={18} /> Available Employees ({availableEmployees.length})
            </h3>
            {availableEmployees.length === 0 ? (
              <p style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No employees available.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.75rem", background: "var(--bg)" }}>
                {availableEmployees.map(e => (
                  <div key={e.ticket_number} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>{e.name} (Ticket #{e.ticket_number})</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{e.designation_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.1rem" }}>
              <XCircle size={18} /> Unavailable Employees ({unavailableEmployees.length})
            </h3>
            {unavailableEmployees.length === 0 ? (
              <p style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No employees unavailable.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.75rem", background: "var(--bg)" }}>
                {unavailableEmployees.map(e => (
                  <div key={e.ticket_number} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span>{e.name} (Ticket #{e.ticket_number})</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{e.designation_name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        <h2 style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
          2. Final Locomotive Assignment Details
        </h2>
        {(!viewsData || viewsData.by_loco.length === 0) ? (
          <p style={{ fontStyle: "italic", color: "var(--text-muted)", padding: "1rem 0" }}>No locomotive bookings available for this shift.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {viewsData.by_loco.map(l => {
              const locoNum = l.loco_number;
              const locoStatus = l.status || "incomplete";
              const jobs = allLocoJobs[locoNum] || [];

              return (
                <div key={locoNum} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "1.5rem", background: "var(--bg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold", fontSize: "1.2rem", color: "var(--accent)" }}>
                      <Train size={20} /> Loco #{locoNum}
                    </div>
                    <span style={{
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      background: locoStatus === "completed" ? "rgba(16, 185, 129, 0.15)" : locoStatus === "partially completed" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: locoStatus === "completed" ? "#10b981" : locoStatus === "partially completed" ? "#f59e0b" : "#ef4444",
                      border: `1px solid ${locoStatus === "completed" ? "rgba(16, 185, 129, 0.3)" : locoStatus === "partially completed" ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                    }}>
                      {locoStatus.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1rem" }}>
                    <div>
                      <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--text-h)" }}>Assigned Supervisors</h4>
                      {l.supervisors.length === 0 ? <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>No supervisors booked.</p> : (
                        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
                          {l.supervisors.map(s => (
                            <li key={s.supervisor_ticket_number}>{s.supervisor_name} (Ticket #{s.supervisor_ticket_number})</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 0.5rem 0", color: "var(--text-h)" }}>Assigned Staff</h4>
                      {l.supervisors.flatMap(s => s.staff).length === 0 ? <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>No staff booked.</p> : (
                        <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
                          {l.supervisors.flatMap(s => s.staff).map(st => (
                            <li key={st.staff_ticket_number}>{st.staff_name} (Ticket #{st.staff_ticket_number})</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.75rem 0", color: "var(--text-h)" }}>Booked Operations Status</h4>
                    {jobs.length === 0 ? (
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>No jobs/tasks assigned to this loco.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {jobs.map(j => {
                          const jobRem = remarksState[locoNum]?.jobs[j.job_id] || { completed: false, remarks: "" };
                          return (
                            <div key={j.job_id} style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "0.75rem", background: "var(--bg-secondary)", fontSize: "0.85rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", marginBottom: "0.25rem" }}>
                                <span>Job {j.job_id}: {j.job_description}</span>
                                <span style={{ color: jobRem.completed ? "#10b981" : "#f59e0b" }}>{jobRem.completed ? "Completed" : "In Progress"}</span>
                              </div>
                              {jobRem.remarks && <p style={{ margin: "0.25rem 0 0 0", fontStyle: "italic", color: "var(--text-muted)" }}>Remarks: "{jobRem.remarks}"</p>}
                              
                              {j.tasks.length > 0 && (
                                <div style={{ marginTop: "0.5rem", borderTop: "1px dashed var(--border)", paddingTop: "0.5rem" }}>
                                  <span style={{ fontWeight: "bold", fontSize: "0.8rem", color: "var(--text-muted)" }}>Tasks:</span>
                                  <ul style={{ margin: "0.25rem 0 0 1.2rem", padding: 0, listStyle: "disc" }}>
                                    {j.tasks.map(t => {
                                      const taskRem = remarksState[locoNum]?.tasks[t.task_id] || { completed: false, remarks: "" };
                                      return (
                                        <li key={t.task_id} style={{ marginBottom: "0.25rem" }}>
                                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span>{t.task_description}</span>
                                            <span style={{ color: taskRem.completed ? "#10b981" : "#f59e0b", fontSize: "0.8rem" }}>{taskRem.completed ? "Completed" : "In Progress"}</span>
                                          </div>
                                          {taskRem.remarks && <span style={{ display: "block", fontStyle: "italic", fontSize: "0.78rem", color: "var(--text-muted)" }}>Remarks: "{taskRem.remarks}"</span>}
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
                </div>
              );
            })}
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
