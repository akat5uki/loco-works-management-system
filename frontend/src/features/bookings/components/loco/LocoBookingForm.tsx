import React from "react";
import { Train, Search, Plus, Trash2, Calendar, Clock, AlertTriangle, History } from "lucide-react";

interface Loco {
  loco_number: string;
  loco_type_id: number;
  date_time: string;
  stage: number;
  shift: number;
  despatched: boolean;
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

interface LocoBookingFormProps {
  locos: Loco[];
  jobs: Job[];
  locoTypes: LocoType[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedLoco: Loco | null;
  setSelectedLoco: (loco: Loco | null) => void;
  selectedJobs: Job[];
  setSelectedJobs: (jobs: Job[]) => void;
  jobTasks: Record<number, string[]>;
  setJobTasks: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
  taskInputs: Record<number, string>;
  setTaskInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  bookingDate: string;
  setBookingDate: (date: string) => void;
  bookingShift: number;
  setBookingShift: (shift: number) => void;
  isAddingLoco: boolean;
  setIsAddingLoco: (adding: boolean) => void;
  newLcoNum: string;
  setNewLcoNum: (num: string) => void;
  newLcoType: string;
  setNewLcoType: (type: string) => void;
  newLcoStage: string;
  setNewLcoStage: (stage: string) => void;
  newLcoShift: string;
  setNewLcoShift: (shift: string) => void;
  showStage6: boolean;
  setShowStage6: (show: boolean) => void;
  handleAddLocoSubmit: () => Promise<void>;
  handleToggleJob: (job: Job) => void;
  handleRemoveTask: (jobId: number, index: number) => void;
  handleAddTask: (jobId: number) => void;
  handleSubmit: (e: React.FormEvent) => void;
  message: string;
  setMessage: (msg: string) => void;
  typeName: (typeId: number) => string;
  setActiveTab: (tab: "booking" | "list" | "history") => void;
}

const todayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const tomorrowISO = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const guessShift = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 1;
  if (h >= 14 && h < 22) return 2;
  return 1;
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

const LocoBookingForm: React.FC<LocoBookingFormProps> = ({
  locos,
  jobs,
  locoTypes,
  loading,
  searchTerm,
  setSearchTerm,
  selectedLoco,
  setSelectedLoco,
  selectedJobs,
  setSelectedJobs,
  jobTasks,
  setJobTasks,
  taskInputs,
  setTaskInputs,
  bookingDate,
  setBookingDate,
  bookingShift,
  setBookingShift,
  isAddingLoco,
  setIsAddingLoco,
  newLcoNum,
  setNewLcoNum,
  newLcoType,
  setNewLcoType,
  newLcoStage,
  setNewLcoStage,
  newLcoShift,
  setNewLcoShift,
  showStage6,
  setShowStage6,
  handleAddLocoSubmit,
  handleToggleJob,
  handleRemoveTask,
  handleAddTask,
  handleSubmit,
  message,
  setMessage,
  typeName,
  setActiveTab,
}) => {
  const filteredLocos = locos
    .filter((l) => {
      const isSearchMatched = l.loco_number.toLowerCase().includes(searchTerm.trim().toLowerCase());
      if (showStage6) {
        return isSearchMatched;
      }
      return isSearchMatched && l.stage !== 6;
    })
    .slice(0, 10);

  return (
    <section className="loco-booking-wizard-card">
      <div className="panel-card flex-col-form">
        <h2>Setup Locomotive Operations Booking</h2>
        <p className="section-subheader">Assign maintenance tasks and operations schedule checklist to a locomotive.</p>

        <form onSubmit={handleSubmit} className="loco-booking-flow-form">
          {message && !message.includes("Editing") && (
            <div className={`form-message-banner ${message.toLowerCase().includes("fail") || message.toLowerCase().includes("error") ? "error-message" : "success-message"}`}>
              {message}
            </div>
          )}

          {/* STEP 1 – Search and Select Loco */}
          <div className="wizard-step">
            <label className="step-label">1. Choose Locomotive</label>
            <div className="search-box-wrapper" style={{ marginTop: "0.5rem" }}>
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Search by Loco Number..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectedLoco) {
                    setSelectedLoco(null);
                    setSelectedJobs([]);
                    setJobTasks({});
                  }
                }}
                disabled={isAddingLoco}
                style={{ paddingLeft: "2.25rem" }}
              />
            </div>

            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                id="showStage6LocoBooking"
                checked={showStage6}
                onChange={(e) => setShowStage6(e.target.checked)}
                style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--accent)" }}
              />
              <label htmlFor="showStage6LocoBooking" style={{ fontSize: "0.85rem", color: "var(--text-muted)", cursor: "pointer", userSelect: "none" }}>
                Show Stage 6 Locomotives
              </label>
            </div>

            {searchTerm && !selectedLoco && !isAddingLoco && (
              <div className="search-results-dropdown">
                {filteredLocos.map((l) => (
                  <div
                    key={l.loco_number}
                    className="search-item"
                    onClick={() => {
                      setSelectedLoco(l);
                      setSearchTerm(l.loco_number);
                    }}
                    style={l.despatched ? { opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" } : {}}
                  >
                    <Train size={16} />
                    <span>
                      Locomotive #{l.loco_number} ({typeName(l.loco_type_id)})
                    </span>
                    {l.despatched && <span className="despatched-badge">Despatched</span>}
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
                    Locomotive #{selectedLoco.loco_number} ({typeName(selectedLoco.loco_type_id)})
                  </strong>
                  <span>Stage: {selectedLoco.stage}</span>
                </div>
                <div className="loco-tag-actions">
                  <button
                    type="button"
                    className="btn-history"
                    onClick={() => setActiveTab("history")}
                  >
                    <History size={14} /> View Logs
                  </button>
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
              </div>
            )}

            {isAddingLoco && (
              <div className="add-loco-inline-form">
                <h3>Create New Locomotive Entry</h3>
                <div className="inline-grid">
                  <div className="form-group">
                    <label>Loco Number</label>
                    <input
                      type="text"
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
                    <select
                      value={newLcoStage}
                      onChange={(e) => setNewLcoStage(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        height: "38px",
                        borderRadius: "0.375rem",
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        color: "var(--text)",
                      }}
                    >
                      <option value="0">0</option>
                      <option value="5">5</option>
                      <option value="6">6</option>
                      <option value="7">7</option>
                      <option value="9">9</option>
                    </select>
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
                    disabled={loading}
                  >
                    Create &amp; Select
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2 – Date & Shift */}
          {selectedLoco && (
            <div className="wizard-step">
              <label className="step-label">2. Select Booking Date &amp; Shift</label>
              <div className="date-shift-row">
                <div className="form-group date-field">
                  <label>
                    <Calendar size={14} /> Date
                  </label>
                  <input
                    type="date"
                    required={true}
                    value={bookingDate}
                    min={todayISO()}
                    max={tomorrowISO()}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </div>
                <div className="form-group shift-field">
                  <label>
                    <Clock size={14} /> Shift
                  </label>
                  <div className="shift-btn-group">
                    {[1, 2].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`shift-btn${bookingShift === s ? " active" : ""}`}
                        onClick={() => setBookingShift(s)}
                      >
                        Shift {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {!isCurrentOrNextShift(bookingDate, bookingShift) && (
                <div className="shift-warning-alert">
                  <AlertTriangle size={16} />
                  <span>Warning: You are booking for a shift other than the current or next shift.</span>
                </div>
              )}
              {message.includes("Editing") && (
                <p className="editing-hint">⚠️ An existing booking for this date &amp; shift will be replaced.</p>
              )}
            </div>
          )}

          {/* STEP 3 – Job selection */}
          {selectedLoco && (
            <div className="wizard-step">
              <label className="step-label">3. Select Jobs</label>
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

          {/* STEP 4 – Tasks */}
          {selectedLoco && selectedJobs.length > 0 && (
            <div className="wizard-step">
              <label className="step-label">4. Write Tasks for Selected Jobs</label>
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
                        placeholder="Add task details…"
                        value={taskInputs[job.job_id] || ""}
                        onChange={(e) =>
                          setTaskInputs((p) => ({ ...p, [job.job_id]: e.target.value }))
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
              {loading ? "Processing…" : "Confirm & Save Booking"}
            </button>
          )}
        </form>
      </div>
    </section>
  );
};

export default LocoBookingForm;
