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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  User,
  Users,
  ClipboardList,
  CheckSquare
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
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const isNodeExpanded = (nodeId: string, defaultVal = true) => {
    return expandedNodes[nodeId] ?? defaultVal;
  };

  const toggleNode = (nodeId: string, defaultVal = true) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !(prev[nodeId] ?? defaultVal)
    }));
  };

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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>
            2. Final Locomotive Assignment Details
          </h2>
          <div className="no-print" style={{ display: "flex", gap: "0.5rem" }}>
            <button className="back-btn" onClick={expandAll} style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", height: "auto" }}>Expand All</button>
            <button className="back-btn" onClick={collapseAll} style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem", height: "auto" }}>Collapse All</button>
          </div>
        </div>
        {(!viewsData || viewsData.by_loco.length === 0) ? (
          <p style={{ fontStyle: "italic", color: "var(--text-muted)", padding: "1rem 0" }}>No locomotive bookings available for this shift.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {viewsData.by_loco.map(l => {
              const locoNum = l.loco_number;
              const locoStatus = l.status || "incomplete";
              const jobs = allLocoJobs[locoNum] || [];
              const isLocoExpanded = isNodeExpanded(locoNum, false);

              return (
                <div key={locoNum} style={{ border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg)", marginBottom: "1rem", overflow: "hidden" }}>
                  
                  {/* Collapsible Header */}
                  <div 
                    style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      padding: "1rem 1.5rem", 
                      background: "var(--bg-secondary)", 
                      cursor: "pointer", 
                      userSelect: "none" 
                    }}
                    onClick={() => toggleNode(locoNum, false)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontWeight: "bold", fontSize: "1.2rem", color: "var(--accent)" }}>
                      <span className="no-print" style={{ display: "flex", alignItems: "center" }}>
                        {isLocoExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </span>
                      <Train size={20} /> Loco #{locoNum}
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      {!isLocoExpanded && l.supervisors.length > 0 && (
                        <span className="no-print" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                          ({l.supervisors.map(s => s.supervisor_name).join(", ")})
                        </span>
                      )}
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
                  </div>

                  {/* Collapsible Content */}
                  <div 
                    style={{ 
                      padding: "1.5rem", 
                      borderTop: "1px solid var(--border)", 
                      display: isLocoExpanded ? "block" : "none" 
                    }} 
                    className="print-visible-block"
                  >
                    <div className="tree-container">
                      
                      {/* Node: Supervisors */}
                      {(() => {
                        const supsKey = `${locoNum}-supervisors-group`;
                        const isSupsExpanded = isNodeExpanded(supsKey, true);
                        return (
                          <div className="tree-node">
                            <div className="tree-node-row" onClick={() => toggleNode(supsKey, true)}>
                              <span className="tree-node-toggle">
                                {isSupsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </span>
                              <span className="tree-node-icon">
                                <Users size={16} />
                              </span>
                              <div className="tree-node-label">
                                <span>Supervisors</span>
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                  ({l.supervisors.length} booked)
                                </span>
                              </div>
                            </div>

                            <div 
                              className="tree-node-content tree-node-children print-visible-block"
                              style={{ display: isSupsExpanded ? "flex" : "none" }}
                            >
                              {l.supervisors.length === 0 ? (
                                <div className="tree-node leaf">
                                  <div className="tree-node-row leaf">
                                    <span className="tree-node-toggle leaf-spacer"></span>
                                    <span className="tree-node-icon leaf-icon">•</span>
                                    <span className="tree-node-label" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
                                      No supervisors booked
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                l.supervisors.map(s => (
                                  <div key={s.supervisor_ticket_number} className="tree-node leaf">
                                    <div className="tree-node-row leaf">
                                      <span className="tree-node-toggle leaf-spacer"></span>
                                      <span className="tree-node-icon leaf-icon">
                                        <User size={12} style={{ color: "var(--text-muted)" }} />
                                      </span>
                                      <div className="tree-node-label" style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                                        {s.supervisor_name}
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                          (Ticket #{s.supervisor_ticket_number})
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Node: Staffs */}
                      {(() => {
                        const staffsKey = `${locoNum}-staffs-group`;
                        const isStaffsExpanded = isNodeExpanded(staffsKey, true);
                        
                        // Extract unique staff members
                        const uniqueStaffMap = new Map<number, { staff_ticket_number: number; staff_name: string }>();
                        l.supervisors.forEach(s => {
                          s.staff.forEach(st => {
                            uniqueStaffMap.set(st.staff_ticket_number, st);
                          });
                        });
                        const staffList = Array.from(uniqueStaffMap.values());

                        return (
                          <div className="tree-node" style={{ marginTop: "0.5rem" }}>
                            <div className="tree-node-row" onClick={() => toggleNode(staffsKey, true)}>
                              <span className="tree-node-toggle">
                                {isStaffsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </span>
                              <span className="tree-node-icon">
                                <Users size={16} />
                              </span>
                              <div className="tree-node-label">
                                <span>Staffs</span>
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                  ({staffList.length} booked)
                                </span>
                              </div>
                            </div>

                            <div 
                              className="tree-node-content tree-node-children print-visible-block"
                              style={{ display: isStaffsExpanded ? "flex" : "none" }}
                            >
                              {staffList.length === 0 ? (
                                <div className="tree-node leaf">
                                  <div className="tree-node-row leaf">
                                    <span className="tree-node-toggle leaf-spacer"></span>
                                    <span className="tree-node-icon leaf-icon">•</span>
                                    <span className="tree-node-label" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
                                      No staffs booked
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                staffList.map(st => (
                                  <div key={st.staff_ticket_number} className="tree-node leaf">
                                    <div className="tree-node-row leaf">
                                      <span className="tree-node-toggle leaf-spacer"></span>
                                      <span className="tree-node-icon leaf-icon">
                                        <User size={12} style={{ color: "var(--text-muted)" }} />
                                      </span>
                                      <div className="tree-node-label" style={{ fontSize: "0.85rem", color: "var(--text)" }}>
                                        {st.staff_name}
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                          (Ticket #{st.staff_ticket_number})
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Node: Operations & Carry Forward Details */}
                      {(() => {
                        const opsKey = `${locoNum}-operations`;
                        const isOpsExpanded = isNodeExpanded(opsKey, true);
                        return (
                          <div className="tree-node" style={{ marginTop: "0.5rem" }}>
                            <div className="tree-node-row" onClick={() => toggleNode(opsKey, true)}>
                              <span className="tree-node-toggle">
                                {isOpsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </span>
                              <span className="tree-node-icon">
                                <ClipboardList size={16} />
                              </span>
                              <div className="tree-node-label">
                                <span>Operations &amp; Carry Forward Details</span>
                                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                  ({jobs.length} jobs booked)
                                </span>
                              </div>
                            </div>

                            <div 
                              className="tree-node-content tree-node-children print-visible-block"
                              style={{ display: isOpsExpanded ? "flex" : "none" }}
                            >
                              {jobs.length === 0 ? (
                                <div className="tree-node leaf">
                                  <div className="tree-node-row leaf">
                                    <span className="tree-node-toggle leaf-spacer"></span>
                                    <span className="tree-node-icon leaf-icon">•</span>
                                    <span className="tree-node-label" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
                                      No operations booked for this loco
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                jobs.map(j => {
                                  const jobKey = `${locoNum}-job-${j.job_id}`;
                                  const isJobExpanded = isNodeExpanded(jobKey, true);
                                  const jobRem = remarksState[locoNum]?.jobs[j.job_id] || { completed: false, remarks: "" };
                                  return (
                                    <div key={j.job_id} className="tree-node">
                                      <div className="tree-node-row" onClick={() => toggleNode(jobKey, true)}>
                                        <span className="tree-node-toggle">
                                          {j.tasks.length > 0 ? (
                                            isJobExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                                          ) : (
                                            <span className="leaf-spacer"></span>
                                          )}
                                        </span>
                                        <span className="tree-node-icon">
                                          <ClipboardList size={14} style={{ color: "var(--accent)" }} />
                                        </span>
                                        <div className="tree-node-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "0.5rem" }}>
                                          <div>
                                            <strong>Job {j.job_id}:</strong> {j.job_description}
                                            {jobRem.remarks && (
                                              <span style={{ marginLeft: "0.5rem", fontStyle: "italic", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                                (Remarks: "{jobRem.remarks}")
                                              </span>
                                            )}
                                          </div>
                                          <span style={{
                                            fontSize: "0.75rem",
                                            padding: "0.1rem 0.4rem",
                                            borderRadius: "4px",
                                            background: jobRem.completed ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                                            color: jobRem.completed ? "#10b981" : "#f59e0b",
                                            border: `1px solid ${jobRem.completed ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`
                                          }}>
                                            {jobRem.completed ? "Completed" : "In Progress"}
                                          </span>
                                        </div>
                                      </div>

                                      {j.tasks.length > 0 && (
                                        <div 
                                          className="tree-node-content tree-node-children print-visible-block"
                                          style={{ display: isJobExpanded ? "flex" : "none" }}
                                        >
                                          {j.tasks.map(t => {
                                            const taskRem = remarksState[locoNum]?.tasks[t.task_id] || { completed: false, remarks: "" };
                                            return (
                                              <div key={t.task_id} className="tree-node leaf">
                                                <div className="tree-node-row leaf">
                                                  <span className="tree-node-toggle leaf-spacer"></span>
                                                  <span className="tree-node-icon leaf-icon">
                                                    <CheckSquare size={12} style={{ color: taskRem.completed ? "#10b981" : "var(--text-muted)" }} />
                                                  </span>
                                                  <div className="tree-node-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text)" }}>
                                                    <div>
                                                      {t.task_description}
                                                      {taskRem.remarks && (
                                                        <span style={{ marginLeft: "0.5rem", fontStyle: "italic", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                                          (Remarks: "{taskRem.remarks}")
                                                        </span>
                                                      )}
                                                    </div>
                                                    <span style={{
                                                      fontSize: "0.7rem",
                                                      padding: "0.05rem 0.3rem",
                                                      borderRadius: "3px",
                                                      background: taskRem.completed ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                                                      color: taskRem.completed ? "#10b981" : "#f59e0b",
                                                      border: `1px solid ${taskRem.completed ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)"}`
                                                    }}>
                                                      {taskRem.completed ? "Completed" : "In Progress"}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })()}

                    </div>
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
