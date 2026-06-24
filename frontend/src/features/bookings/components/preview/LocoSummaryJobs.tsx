import React from "react";
import { ChevronDown, ChevronRight, ClipboardList, CheckSquare } from "lucide-react";

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

interface LocoSummaryJobsProps {
  locoNum: string;
  jobs: JobInfo[];
  isNodeExpanded: (nodeId: string, defaultVal?: boolean) => boolean;
  toggleNode: (nodeId: string, defaultVal?: boolean) => void;
  remarksStateForLoco?: {
    jobs: Record<number, { completed: boolean; remarks: string }>;
    tasks: Record<number, { completed: boolean; remarks: string }>;
  };
}

const LocoSummaryJobs: React.FC<LocoSummaryJobsProps> = ({
  locoNum,
  jobs,
  isNodeExpanded,
  toggleNode,
  remarksStateForLoco,
}) => {
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
            const jobRem = remarksStateForLoco?.jobs[j.job_id] || { completed: false, remarks: "" };
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
                      const taskRem = remarksStateForLoco?.tasks[t.task_id] || { completed: false, remarks: "" };
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
};

export default LocoSummaryJobs;
