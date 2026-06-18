import { useState, useEffect } from "react";
import { Train, Search, Plus, Trash2, Calendar, ClipboardList, Clock, User, FileText, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import "./LocoBooking.css";

interface Loco {
  loco_number: number;
  loco_type_id: number;
  date_time: string;
  stage: number;
  shift: number;
}

interface LocoType {
  loco_type_id: number;
  loco_type_name: string;
}

interface Job {
  job_id: number;
  job_description: string;
  stage: number;
}

interface RawBooking {
  booking_id: number;
  loco_number: number;
  date_time: string;
  job_id: number;
  job_description: string;
  task_id: number | null;
  task_description: string | null;
  ticket_number: number;
  employee_name: string;
  shift: number;
}

const LocoBookingUI = () => {
  const navigate = useNavigate();

  // Access check
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await api.get("/auth/me");
        if (!response.data.is_supervisor) {
          alert("Access Denied: Supervisor only area.");
          navigate("/dashboard", { replace: true });
        }
      } catch (error) {
        navigate("/login", { replace: true });
      }
    };
    checkAccess();
  }, [navigate]);

  // Core Data
  const [locos, setLocos] = useState<Loco[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [locoTypes, setLocoTypes] = useState<LocoType[]>([]);
  const [bookings, setBookings] = useState<RawBooking[]>([]);

  // Search & Selection
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLoco, setSelectedLoco] = useState<Loco | null>(null);
  const [selectedJobs, setSelectedJobs] = useState<Job[]>([]);
  const [jobTasks, setJobTasks] = useState<Record<number, string[]>>({});
  const [taskInputs, setTaskInputs] = useState<Record<number, string>>({});

  // Adding Loco Modal/Inline Form State
  const [isAddingLoco, setIsAddingLoco] = useState(false);
  const [newLcoNum, setNewLcoNum] = useState("");
  const [newLcoType, setNewLcoType] = useState("");
  const [newLcoStage, setNewLcoStage] = useState("5");
  const [newLcoShift, setNewLcoShift] = useState("1");

  // Loading & Message
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [locosRes, jobsRes, typesRes, bookingsRes] = await Promise.all([
        api.get("/locos/"),
        api.get("/jobs/"),
        api.get("/locos/types"),
        api.get("/bookings/"),
      ]);
      setLocos(locosRes.data);
      setJobs(jobsRes.data);
      setLocoTypes(typesRes.data);
      setBookings(bookingsRes.data);
    } catch (error) {
      console.error("Error fetching data", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter locos by search term
  const filteredLocos = locos.filter((l) =>
    l.loco_number.toString().includes(searchTerm),
  );

  const handleSelectLoco = (loco: Loco) => {
    setSelectedLoco(loco);
    setSearchTerm(loco.loco_number.toString());
    setIsAddingLoco(false);

    // Load existing bookings for this loco on its current shift and day (today)
    const todayStr = new Date().toDateString();
    const existingForLoco = bookings.filter(
      (b) =>
        b.loco_number === loco.loco_number &&
        b.shift === loco.shift &&
        new Date(b.date_time).toDateString() === todayStr
    );

    if (existingForLoco.length > 0) {
      const preselectedJobs: Job[] = [];
      const preselectedTasks: Record<number, string[]> = {};

      existingForLoco.forEach((b) => {
        const jobObj = jobs.find((j) => j.job_id === b.job_id);
        if (jobObj && !preselectedJobs.some((j) => j.job_id === jobObj.job_id)) {
          preselectedJobs.push(jobObj);
        }
        if (b.task_description) {
          if (!preselectedTasks[b.job_id]) {
            preselectedTasks[b.job_id] = [];
          }
          preselectedTasks[b.job_id].push(b.task_description);
        }
      });

      setSelectedJobs(preselectedJobs);
      setJobTasks(preselectedTasks);
      setMessage("Editing existing booking for this locomotive.");
    } else {
      setSelectedJobs([]);
      setJobTasks({});
      setMessage("");
    }
  };

  // Triggered when adding a brand new loco
  const handleAddLocoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLcoNum || !newLcoType || !newLcoStage || !newLcoShift) return;

    setLoading(true);
    try {
      const payload = {
        loco_number: parseInt(newLcoNum),
        loco_type_id: parseInt(newLcoType),
        date_time: new Date().toISOString(),
        stage: parseInt(newLcoStage),
        shift: parseInt(newLcoShift),
      };
      const response = await api.post("/locos/", payload);
      const newLoco: Loco = response.data;
      setLocos((prev) => [...prev, newLoco]);
      setSelectedLoco(newLoco);
      setSearchTerm(newLoco.loco_number.toString());
      setIsAddingLoco(false);
      // Reset form
      setNewLcoNum("");
      setNewLcoType("");
    } catch (error: any) {
      alert("Failed to add locomotive: " + (error.response?.data?.detail || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  // Toggle job selection
  const handleToggleJob = (job: Job) => {
    if (selectedJobs.some((j) => j.job_id === job.job_id)) {
      setSelectedJobs((prev) => prev.filter((j) => j.job_id !== job.job_id));
      const updatedTasks = { ...jobTasks };
      delete updatedTasks[job.job_id];
      setJobTasks(updatedTasks);
    } else {
      setSelectedJobs((prev) => [...prev, job]);
      setJobTasks((prev) => ({ ...prev, [job.job_id]: [] }));
    }
  };

  // Add a task to a job
  const handleAddTask = (jobId: number) => {
    const desc = taskInputs[jobId]?.trim();
    if (!desc) return;

    setJobTasks((prev) => ({
      ...prev,
      [jobId]: [...(prev[jobId] || []), desc],
    }));
    setTaskInputs((prev) => ({ ...prev, [jobId]: "" }));
  };

  // Remove a task from a job
  const handleRemoveTask = (jobId: number, index: number) => {
    setJobTasks((prev) => ({
      ...prev,
      [jobId]: prev[jobId].filter((_, idx) => idx !== index),
    }));
  };

  // Save Booking
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoco || selectedJobs.length === 0) return;

    setLoading(true);
    setMessage("");

    const payload = {
      loco_number: selectedLoco.loco_number,
      date_time: new Date().toISOString(),
      bookings: selectedJobs.map((job) => ({
        job_id: job.job_id,
        tasks: (jobTasks[job.job_id] || []).map((t) => ({ task_description: t })),
      })),
    };

    try {
      await api.post("/bookings/", payload);
      setMessage("Locomotive booking saved successfully!");
      // Reset state
      setSelectedLoco(null);
      setSelectedJobs([]);
      setJobTasks({});
      setSearchTerm("");
      // Refresh list
      const bookingsRes = await api.get("/bookings/");
      setBookings(bookingsRes.data);
    } catch (error: any) {
      setMessage("Booking failed: " + (error.response?.data?.detail || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  // Group Bookings: Date -> Shift -> Loco Number -> Jobs
  const groupBookings = (list: RawBooking[]) => {
    const groups: Record<
      string,
      Record<
        number,
        Record<
          number,
          {
            employee_name: string;
            jobs: Record<number, { job_description: string; tasks: string[] }>;
          }
        >
      >
    > = {};

    list.forEach((b) => {
      const date = new Date(b.date_time);
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const shift = b.shift;
      const loco = b.loco_number;

      if (!groups[dateStr]) groups[dateStr] = {};
      if (!groups[dateStr][shift]) groups[dateStr][shift] = {};
      if (!groups[dateStr][shift][loco]) {
        groups[dateStr][shift][loco] = {
          employee_name: b.employee_name,
          jobs: {},
        };
      }

      if (!groups[dateStr][shift][loco].jobs[b.job_id]) {
        groups[dateStr][shift][loco].jobs[b.job_id] = {
          job_description: b.job_description,
          tasks: [],
        };
      }

      if (b.task_description) {
        groups[dateStr][shift][loco].jobs[b.job_id].tasks.push(b.task_description);
      }
    });

    return groups;
  };

  const groupedBookings = groupBookings(bookings);

  return (
    <div className="loco-booking-workspace">
      <header className="workspace-header">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button className="back-btn" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={18} /> Dashboard
          </button>
          <ThemeToggle />
        </div>
        <div className="title-area">
          <Train className="header-icon" />
          <div>
            <h1>Locomotive Work Bookings</h1>
            <p>Assign tasks, schedule jobs, and track workshop activity.</p>
          </div>
        </div>
      </header>

      <div className="workspace-grid">
        <section className="booking-entry-panel">
          <div className="panel-card">
            <h2>Book Locomotive & Jobs</h2>
            <form onSubmit={handleBookingSubmit} className="booking-wizard-form">
              {message && (
                <div className={`wizard-message ${message.includes("failed") ? "error" : "success"}`}>
                  {message}
                </div>
              )}

              <div className="wizard-step">
                <label className="step-label">1. Search & Select Locomotive</label>
                <div className="search-box-wrapper">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Type Loco Number (e.g. 31012)..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSelectedLoco(null);
                    }}
                  />
                </div>

                {searchTerm && !selectedLoco && !isAddingLoco && (
                  <div className="search-results-dropdown">
                    {filteredLocos.map((l) => (
                      <div
                        key={l.loco_number}
                        className="search-item"
                        onClick={() => handleSelectLoco(l)}
                      >
                        <Train size={16} />
                        <span>
                          Locomotive #{l.loco_number} ({locoTypes.find((t) => t.loco_type_id === l.loco_type_id)?.loco_type_name || l.loco_type_id})
                        </span>
                      </div>
                    ))}
                    {filteredLocos.length === 0 && (
                      <div className="no-loco-banner">
                        <p>Locomotive #{searchTerm} is not in the system.</p>
                        <button
                          type="button"
                          className="btn-add-loco-trigger"
                          onClick={() => {
                            setNewLcoNum(searchTerm);
                            setIsAddingLoco(true);
                          }}
                        >
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
                      <strong>
                        Locomotive #{selectedLoco.loco_number} ({locoTypes.find((t) => t.loco_type_id === selectedLoco.loco_type_id)?.loco_type_name || selectedLoco.loco_type_id})
                      </strong>
                      <span>Stage: {selectedLoco.stage} | Shift: {selectedLoco.shift}</span>
                    </div>
                    <button
                      type="button"
                      className="clear-loco-btn"
                      onClick={() => {
                        setSelectedLoco(null);
                        setSearchTerm("");
                        setSelectedJobs([]);
                        setJobTasks({});
                        setMessage("");
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}

                {isAddingLoco && (
                  <div className="add-loco-inline-form">
                    <h3>Create New Locomotive Entry</h3>
                    <div className="inline-grid">
                      <div className="form-group">
                        <label>Loco Number</label>
                        <input
                          type="number"
                          value={newLcoNum}
                          onChange={(e) => setNewLcoNum(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Loco Type</label>
                        <select
                          value={newLcoType}
                          onChange={(e) => setNewLcoType(e.target.value)}
                          required
                        >
                          <option value="">-- Select Type --</option>
                          {locoTypes.map((t) => (
                            <option key={t.loco_type_id} value={t.loco_type_id}>
                              {t.loco_type_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Current Stage</label>
                        <input
                          type="number"
                          value={newLcoStage}
                          onChange={(e) => setNewLcoStage(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Current Shift</label>
                        <select
                          value={newLcoShift}
                          onChange={(e) => setNewLcoShift(e.target.value)}
                          required
                        >
                          <option value="1">Shift 1</option>
                          <option value="2">Shift 2</option>
                          <option value="3">Shift 3</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => setIsAddingLoco(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-submit"
                        onClick={handleAddLocoSubmit}
                      >
                        Create & Select
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {selectedLoco && (
                <div className="wizard-step">
                  <label className="step-label">2. Select Jobs</label>
                  <div className="jobs-checkbox-list">
                    {jobs.map((job) => (
                      <label key={job.job_id} className="job-checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedJobs.some((j) => j.job_id === job.job_id)}
                          onChange={() => handleToggleJob(job)}
                        />
                        <span className="job-desc">
                          {job.job_description} (Stage {job.stage})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedLoco && selectedJobs.length > 0 && (
                <div className="wizard-step">
                  <label className="step-label">3. Write Tasks for Selected Jobs</label>
                  <div className="selected-jobs-tasks-panel">
                    {selectedJobs.map((job) => (
                      <div key={job.job_id} className="selected-job-card">
                        <div className="card-header">
                          <h4>{job.job_description}</h4>
                        </div>

                        <div className="added-tasks-list">
                          {(jobTasks[job.job_id] || []).map((taskDesc, idx) => (
                            <div key={idx} className="added-task-item">
                              <span>{taskDesc}</span>
                              <button
                                type="button"
                                className="remove-task-btn"
                                onClick={() => handleRemoveTask(job.job_id, idx)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          {(jobTasks[job.job_id] || []).length === 0 && (
                            <p className="no-tasks-hint">No tasks written yet. (Will book job without tasks)</p>
                          )}
                        </div>

                        <div className="task-entry-row">
                          <input
                            type="text"
                            placeholder="Add task details..."
                            value={taskInputs[job.job_id] || ""}
                            onChange={(e) =>
                              setTaskInputs((prev) => ({
                                ...prev,
                                [job.job_id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTask(job.job_id);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn-add-task"
                            onClick={() => handleAddTask(job.job_id)}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLoco && selectedJobs.length > 0 && (
                <button type="submit" className="btn-confirm-booking" disabled={loading}>
                  {loading ? "Processing..." : "Confirm & Save Booking"}
                </button>
              )}
            </form>
          </div>
        </section>

        <section className="bookings-list-panel">
          <div className="panel-card scrollable">
            <h2>Booked Workshop Operations</h2>
            <div className="timeline-grouped-bookings">
              {Object.keys(groupedBookings).map((dateStr) => (
                <div key={dateStr} className="date-group-card">
                  <div className="date-header">
                    <Calendar size={16} />
                    <h3>{dateStr}</h3>
                  </div>

                  {Object.keys(groupedBookings[dateStr]).map((shift) => (
                    <div key={shift} className="shift-block">
                      <div className="shift-header">
                        <Clock size={14} />
                        <h4>Shift {shift}</h4>
                      </div>

                      <div className="locos-list">
                        {Object.keys(groupedBookings[dateStr][parseInt(shift)]).map((locoNumStr) => {
                          const locoNum = parseInt(locoNumStr);
                          const record = groupedBookings[dateStr][parseInt(shift)][locoNum];
                          const matchedLoco = locos.find((l) => l.loco_number === locoNum);
                          const matchedTypeName = matchedLoco ? (locoTypes.find((t) => t.loco_type_id === matchedLoco.loco_type_id)?.loco_type_name) : null;
                          return (
                            <div key={locoNum} className="loco-booking-card">
                              <div className="loco-card-title">
                                <Train size={16} className="text-blue-600" />
                                <h5>Locomotive #{locoNum} {matchedTypeName ? `(${matchedTypeName})` : ""}</h5>
                                <span className="booked-by-badge">
                                  <User size={12} /> {record.employee_name}
                                </span>
                              </div>
                              <div className="loco-jobs-list">
                                {Object.keys(record.jobs).map((jobIdStr) => {
                                  const jobId = parseInt(jobIdStr);
                                  const job = record.jobs[jobId];
                                  return (
                                    <div key={jobId} className="loco-job-item">
                                      <div className="job-meta">
                                        <ClipboardList size={14} />
                                        <h6>{job.job_description}</h6>
                                      </div>
                                      {job.tasks.length > 0 && (
                                        <ul className="job-tasks-sublist">
                                          {job.tasks.map((task, index) => (
                                            <li key={index}>
                                              <FileText size={12} />
                                              <span>{task}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {bookings.length === 0 && (
                <p className="no-records-hint">No workshop operations booked yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LocoBookingUI;
