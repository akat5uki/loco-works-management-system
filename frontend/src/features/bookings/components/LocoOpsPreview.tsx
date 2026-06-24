import React, { useState } from "react";
import { ClipboardList, X } from "lucide-react";

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

interface LocoOpsPreviewProps {
  selectedLoco: string | null;
  locoJobs: ActiveLocoJobs | null;
  remarksState: Record<number, { completed: boolean; remarks: string }>;
  taskRemarksState: Record<number, { completed: boolean; remarks: string }>;
}

const LocoOpsPreview: React.FC<LocoOpsPreviewProps> = ({
  selectedLoco,
  locoJobs,
  remarksState,
  taskRemarksState,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  if (!selectedLoco) {
    return (
      <div className="loco-ops-empty-state desktop-only">
        <ClipboardList size={24} />
        <p>Select a locomotive number to see its active operations preview.</p>
      </div>
    );
  }

  const renderContent = () => {
    if (!locoJobs) {
      return (
        <div className="loco-ops-loading">
          <p>Loading locomotive operations details...</p>
        </div>
      );
    }

    return (
      <div className="loco-ops-content">
        <div className="ops-header-section">
          <h3>
            <ClipboardList size={20} /> Active Operations: Loco #{selectedLoco}
          </h3>
          <button
            className="close-ops-drawer mobile-only"
            onClick={() => setIsOpenMobile(false)}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {locoJobs.jobs.length === 0 ? (
          <p className="empty-ops-text">No operations booked for this locomotive in this shift.</p>
        ) : (
          <div className="ops-jobs-list">
            {locoJobs.jobs.map((job) => {
              const remarkObj = remarksState[job.job_id];
              return (
                <div key={job.job_id} className="ops-job-card">
                  <div className="job-title-row">
                    <strong>
                      Job {job.job_id}: {job.job_description}
                    </strong>
                  </div>
                  {remarkObj && (
                    <div className="job-status-summary">
                      <span className="status-label">Status:</span>
                      <span
                        className={`status-value ${
                          remarkObj.completed ? "completed" : "in-progress"
                        }`}
                      >
                        {remarkObj.completed ? "Completed" : "In Progress"}
                      </span>
                      {remarkObj.remarks && (
                        <p className="job-remarks">Remarks: "{remarkObj.remarks}"</p>
                      )}
                    </div>
                  )}

                  {job.tasks.length > 0 && (
                    <div className="job-tasks-section">
                      <span className="tasks-title">Tasks Checklist</span>
                      <ul className="tasks-list">
                        {job.tasks.map((t) => {
                          const taskRemark = taskRemarksState[t.task_id];
                          return (
                            <li key={t.task_id} className="task-item">
                              <span className="task-desc">{t.task_description}</span>
                              {taskRemark && (
                                <span
                                  className={`task-status-tag ${
                                    taskRemark.completed ? "completed" : "in-progress"
                                  }`}
                                >
                                  {taskRemark.completed ? "Completed" : "In Progress"}
                                  {taskRemark.remarks && ` | "${taskRemark.remarks}"`}
                                </span>
                              )}
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
    );
  };

  return (
    <div className="loco-ops-preview-wrapper">
      {/* Floating preview button for mobile screen viewports */}
      <button
        className="mobile-ops-trigger-btn mobile-only"
        onClick={() => setIsOpenMobile(true)}
        type="button"
      >
        <ClipboardList size={18} /> View Operations (Loco #{selectedLoco})
      </button>

      {/* Desktop view container */}
      <div className="loco-ops-panel desktop-only">{renderContent()}</div>

      {/* Mobile Drawer view overlay */}
      {isOpenMobile && (
        <div className="mobile-ops-drawer-overlay" onClick={() => setIsOpenMobile(false)}>
          <div className="mobile-ops-drawer" onClick={(e) => e.stopPropagation()}>
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocoOpsPreview;
