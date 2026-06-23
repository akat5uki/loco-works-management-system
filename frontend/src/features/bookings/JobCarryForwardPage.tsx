import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Calendar,
  Lock,
  RefreshCw,
  AlertTriangle,
  ClipboardList,
  Train
} from "lucide-react";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import "./EmployeesBooking.css";

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

const JobCarryForwardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // User info
  const [currentUser, setCurrentUser] = useState<{ ticket_number: number; name: string; designation_id: number; is_supervisor: boolean } | null>(null);

  // Filters & State
  const [dateStr, setDateStr] = useState(todayISO());
  const [shift, setShift] = useState(guessShift());

  // Data lists
  const [locos, setLocos] = useState<string[]>([]);
  const [selectedLoco, setSelectedLoco] = useState<string | null>(null);
  
  // Lock management
  const [lockOwner, setLockOwner] = useState<{ name: string; ticket_number: number } | null>(null);
  const lockTimer = useRef<number | null>(null);

  // Carry Forward State
  const [locoJobs, setLocoJobs] = useState<ActiveLocoJobs | null>(null);
  const [remarksState, setRemarksState] = useState<Record<number, { completed: boolean; remarks: string }>>({});
  const [taskRemarksState, setTaskRemarksState] = useState<Record<number, { completed: boolean; remarks: string }>>({});
  const [newJobs, setNewJobs] = useState<number[]>([]);
  const [newTasks, setNewTasks] = useState<Array<{ job_id: number; task_description: string }>>([]);
  const [typedTask, setTypedTask] = useState<Record<number, string>>({});
  const [allMasterJobs, setAllMasterJobs] = useState<Array<{ job_id: number; job_description: string }>>([]);

  // Access validation
  useEffect(() => {
    api.get("/auth/me").then(r => {
      setCurrentUser(r.data);
      if (!r.data.is_supervisor) {
        alert("Access Denied: Supervisors only area.");
        navigate("/dashboard", { replace: true });
      }
    }).catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

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

  // Fetch all master jobs for carry forward additions
  useEffect(() => {
    api.get("/jobs/").then(res => setAllMasterJobs(res.data)).catch(() => {});
  }, []);

  // Fetch active locomotives for selected date/shift
  const fetchLocos = useCallback(async () => {
    if (!dateStr) return;
    try {
      const locosRes = await api.get(`/bookings/employees/locos?date_str=${dateStr}&shift=${shift}`);
      const locosList = locosRes.data.locos;
      setLocos(locosList);

      // Handle redirect state from dashboard
      let initialLoco = selectedLoco;
      if (location.state && (location.state as any).selectLoco) {
        const targetLoco = (location.state as any).selectLoco.toString();
        if (locosList.includes(targetLoco)) {
          initialLoco = targetLoco;
        }
        // Clean location state to prevent repeating on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }

      if (initialLoco && !locosList.includes(initialLoco)) {
        initialLoco = null;
      }
      if (!initialLoco && locosList.length > 0) {
        initialLoco = locosList[0];
      }
      setSelectedLoco(initialLoco);
    } catch (err) {
      console.error("Failed to fetch active locos", err);
    }
  }, [dateStr, shift, selectedLoco, location, navigate]);

  useEffect(() => {
    if (currentUser) {
      fetchLocos();
    }
  }, [currentUser, dateStr, shift, fetchLocos]);

  // Reset selected loco when shift or date changes
  useEffect(() => {
    setSelectedLoco(null);
  }, [dateStr, shift]);

  // Load jobs and remarks for selected locomotive
  const loadLocoJobs = async (locoNum: string) => {
    try {
      const bookingsRes = await api.get(`/bookings/?start_date=${dateStr}&end_date=${dateStr}`);
      const locoBookings = bookingsRes.data.filter((b: any) => b.loco_number.toString() === locoNum.toString() && b.shift === shift);
      
      // Group bookings by job
      const jobMap: Record<number, JobInfo> = {};
      locoBookings.forEach((b: any) => {
        if (!jobMap[b.job_id]) {
          jobMap[b.job_id] = {
            job_id: b.job_id,
            job_description: b.job_description,
            stage: 5,
            tasks: []
          };
        }
        if (b.task_id) {
          // Prevent duplicates
          const alreadyExists = jobMap[b.job_id].tasks.some(t => t.task_id === b.task_id);
          if (!alreadyExists) {
            jobMap[b.job_id].tasks.push({
              task_id: b.task_id,
              task_description: b.task_description
            });
          }
        }
      });
      
      setLocoJobs({ loco_number: locoNum, jobs: Object.values(jobMap) });
      
      // Pre-populate remarks/completion defaults
      const defRemarks: Record<number, { completed: boolean; remarks: string }> = {};
      const defTaskRemarks: Record<number, { completed: boolean; remarks: string }> = {};
      
      // Fetch existing remarks
      const remarksRes = await api.get(`/bookings/employees/remarks?date_str=${dateStr}&shift=${shift}`);
      remarksRes.data.forEach((r: any) => {
        if (r.loco_number === parseInt(locoNum)) {
          if (r.task_id === null) {
            defRemarks[r.job_id] = { completed: r.completed, remarks: r.remarks };
          } else {
            defTaskRemarks[r.task_id] = { completed: r.completed, remarks: r.remarks };
          }
        }
      });

      // Fill in default values
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
      setTypedTask({});

    } catch (err) {
      console.error("Failed to load loco jobs/tasks", err);
    }
  };

  useEffect(() => {
    if (selectedLoco) {
      loadLocoJobs(selectedLoco);
    } else {
      setLocoJobs(null);
    }
  }, [selectedLoco, dateStr, shift]);

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
    if (!dateStr) {
      alert("Please select a valid date.");
      return;
    }
    if (!locoJobs || lockOwner) return;

    try {
      const payload = {
        loco_number: locoJobs.loco_number,
        date_str: dateStr,
        shift,
        job_remarks: Object.keys(remarksState).map(jobIdStr => {
          const jobId = parseInt(jobIdStr);
          const jobData = remarksState[jobId];
          
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
      fetchLocos();
    } catch (err) {
      alert("Failed to submit remarks.");
    }
  };

  return (
    <div className="employees-booking-workspace">
      {/* ── HEADER ── */}
      <header className="workspace-header">
        <div className="header-actions">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          <ThemeToggle />
        </div>

        <div className="title-area">
          <ClipboardList className="header-icon" size={32} />
          <div>
            <h1>Job Completion &amp; Carry Forward</h1>
            <p>Update completion status, submit testing remarks, and carry forward tasks to the next shift.</p>
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
            Warning: You are viewing/editing comments for a shift other than the current or next shift.
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
        <button className="back-btn" onClick={fetchLocos} style={{ height: "38px" }}>
          <RefreshCw size={14} /> Refresh Locomotives
        </button>
      </div>

      {/* ── Main Section ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem", marginBottom: "3rem" }}>
        
        {/* Locomotive Selector */}
        <section className="panel-card">
          <h2>Active Locomotives</h2>
          {locos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <Train size={36} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
              <p style={{ color: "var(--text-muted)", margin: 0 }}>No locomotives are booked in this shift.</p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {locos.map(locoNum => (
                <button
                  key={locoNum}
                  className={`back-btn ${selectedLoco === locoNum ? 'active' : ''}`}
                  style={selectedLoco === locoNum ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
                  onClick={() => setSelectedLoco(locoNum)}
                >
                  <Train size={16} /> Loco #{locoNum}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Remarks & Carry Forward Panel */}
        {selectedLoco && locoJobs && (
          <section className="view-content-card">
            <h2>Job Completion Status &amp; Carry Forward Panel</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "-0.5rem" }}>
              Submit remarks for non-completed operations or carry forward tasks to the next shift.
            </p>

            <div className="remarks-loco-card" style={{ marginTop: "1.5rem" }}>
              <h3>In-Progress Operations for Loco #{locoJobs.loco_number}</h3>
              <div className="remarks-grid" style={{ marginTop: "1rem" }}>
                
                {locoJobs.jobs.length === 0 && (
                  <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                    No operations booked for this locomotive.
                  </p>
                )}
                
                {locoJobs.jobs.map(job => (
                  <div key={job.job_id} className="remarks-row-item">
                    <div className="remarks-row-item-header">
                      <strong>{job.job_description}</strong>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
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
                              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", cursor: "pointer" }}>
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

                  {/* Add carry forward tasks under selected/existing jobs */}
                  {(locoJobs.jobs.filter(j => !remarksState[j.job_id]?.completed).map(j => j.job_id).concat(newJobs)).length > 0 && (
                    <div style={{ marginTop: "1.5rem" }}>
                      <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>Add New Tasks for Next Shift</label>
                      <div className="new-tasks-list">
                        {locoJobs.jobs
                          .filter(j => !remarksState[j.job_id]?.completed)
                          .concat(newJobs.map(id => ({ job_id: id, job_description: allMasterJobs.find(mj => mj.job_id === id)?.job_description ?? "", stage: 5, tasks: [] })))
                          .map(job => (
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
          </section>
        )}

      </div>
    </div>
  );
};

export default JobCarryForwardPage;
