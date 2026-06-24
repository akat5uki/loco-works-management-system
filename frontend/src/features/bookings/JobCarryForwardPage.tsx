import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import "./EmployeesBooking.css";

import LockBanner from "./components/carry_forward/LockBanner";
import CarryForwardFilterBar from "./components/carry_forward/CarryForwardFilterBar";
import LocoSelectorTabs from "./components/carry_forward/LocoSelectorTabs";
import CarryForwardForm from "./components/carry_forward/CarryForwardForm";

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

const JobCarryForwardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // User info
  const [currentUser, setCurrentUser] = useState<{ ticket_number: number; name: string; designation_id: number; is_supervisor: boolean } | null>(null);

  // Filters & State
  const [dateStr, setDateStr] = useState(todayISO());
  const [shift, setShift] = useState(guessShift());

  const [locos, setLocos] = useState<string[]>([]);
  const [selectedLoco, setSelectedLoco] = useState<string | null>(null);

  const [prevDateStr, setPrevDateStr] = useState(dateStr);
  const [prevShift, setPrevShift] = useState(shift);
  if (dateStr !== prevDateStr || shift !== prevShift) {
    setPrevDateStr(dateStr);
    setPrevShift(shift);
    setSelectedLoco(null);
  }
  
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

  useEffect(() => {
    if (lockTimer.current) {
      clearInterval(lockTimer.current);
    }
    
    let timerId: number | null = null;
    if (currentUser && currentUser.is_supervisor) {
      timerId = window.setTimeout(() => {
        refreshLock();
      }, 0);
      lockTimer.current = window.setInterval(refreshLock, 15000);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
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
      const timer = setTimeout(() => {
        fetchLocos();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentUser, dateStr, shift, fetchLocos]);

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
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      if (selectedLoco) {
        loadLocoJobs(selectedLoco);
      } else {
        setLocoJobs(null);
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
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
    } catch {
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

      {/* Lock Banner Overlays */}
      <LockBanner
        lockOwner={lockOwner}
        isCurrentOrNextShift={isCurrentOrNextShift(dateStr, shift)}
      />

      {/* ── Global Selection Bar ── */}
      <CarryForwardFilterBar
        dateStr={dateStr}
        setDateStr={setDateStr}
        shift={shift}
        setShift={setShift}
        fetchLocos={fetchLocos}
      />

      {/* ── Main Section ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem", marginBottom: "3rem" }}>
        
        {/* Locomotive Selector */}
        <LocoSelectorTabs
          locos={locos}
          selectedLoco={selectedLoco}
          setSelectedLoco={setSelectedLoco}
        />

        {/* Remarks & Carry Forward Panel */}
        {selectedLoco && locoJobs && (
          <CarryForwardForm
            locoJobs={locoJobs}
            lockOwner={lockOwner}
            remarksState={remarksState}
            setRemarksState={setRemarksState}
            taskRemarksState={taskRemarksState}
            setTaskRemarksState={setTaskRemarksState}
            newJobs={newJobs}
            handleAddCarryForwardJob={handleAddCarryForwardJob}
            handleRemoveCarryForwardJob={handleRemoveCarryForwardJob}
            newTasks={newTasks}
            handleAddCarryForwardTask={handleAddCarryForwardTask}
            handleRemoveCarryForwardTask={handleRemoveCarryForwardTask}
            typedTask={typedTask}
            setTypedTask={setTypedTask}
            allMasterJobs={allMasterJobs}
            handleSubmitRemarks={handleSubmitRemarks}
          />
        )}

      </div>
    </div>
  );
};

export default JobCarryForwardPage;
