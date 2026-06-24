import React from "react";

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

interface CarryForwardFormProps {
  locoJobs: ActiveLocoJobs;
  lockOwner: { name: string; ticket_number: number } | null;
  remarksState: Record<number, { completed: boolean; remarks: string }>;
  setRemarksState: React.Dispatch<React.SetStateAction<Record<number, { completed: boolean; remarks: string }>>>;
  taskRemarksState: Record<number, { completed: boolean; remarks: string }>;
  setTaskRemarksState: React.Dispatch<React.SetStateAction<Record<number, { completed: boolean; remarks: string }>>>;
  newJobs: number[];
  handleAddCarryForwardJob: (jobId: number) => void;
  handleRemoveCarryForwardJob: (jobId: number) => void;
  newTasks: Array<{ job_id: number; task_description: string }>;
  handleAddCarryForwardTask: (jobId: number) => void;
  handleRemoveCarryForwardTask: (idx: number) => void;
  typedTask: Record<number, string>;
  setTypedTask: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  allMasterJobs: Array<{ job_id: number; job_description: string }>;
  handleSubmitRemarks: () => void;
}

const CarryForwardForm: React.FC<CarryForwardFormProps> = ({
  locoJobs,
  lockOwner,
  remarksState,
  setRemarksState,
  taskRemarksState,
  setTaskRemarksState,
  newJobs,
  handleAddCarryForwardJob,
  handleRemoveCarryForwardJob,
  newTasks,
  handleAddCarryForwardTask,
  handleRemoveCarryForwardTask,
  typedTask,
  setTypedTask,
  allMasterJobs,
  handleSubmitRemarks,
}) => {
  return (
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
  );
};

export default CarryForwardForm;
