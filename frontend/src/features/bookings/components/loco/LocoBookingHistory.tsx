import React from "react";
import { Train, Search, Plus, Trash2, Calendar, ClipboardList, Clock, User, FileText, ChevronDown, ChevronUp, Edit2 } from "lucide-react";

interface Loco {
  loco_number: string;
  loco_type_id: number;
  date_time: string;
  stage: number;
  shift: number;
  despatched: boolean;
}

function groupBookings(list: RawBooking[]) {
  const groups: Record<
    string,
    Record<
      number,
      Record<
        string,
        {
          employee_name: string;
          date_time: string;
          jobs: Record<
            number,
            { job_description: string; tasks: { id: number; desc: string }[] }
          >;
        }
      >
    >
  > = {};

  list.forEach((b) => {
    const dateStr = new Date(b.date_time).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const shift = b.shift;
    const loco = b.loco_number;
    if (!groups[dateStr]) groups[dateStr] = {};
    if (!groups[dateStr][shift]) groups[dateStr][shift] = {};
    if (!groups[dateStr][shift][loco])
      groups[dateStr][shift][loco] = {
        employee_name: b.employee_name,
        date_time: b.date_time,
        jobs: {}
      };
    if (!groups[dateStr][shift][loco].jobs[b.job_id])
      groups[dateStr][shift][loco].jobs[b.job_id] = {
        job_description: b.job_description,
        tasks: []
      };
    if (b.task_description && b.task_id)
      groups[dateStr][shift][loco].jobs[b.job_id].tasks.push({
        id: b.task_id,
        desc: b.task_description
      });
  });
  return groups;
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
  loco_number: string;
  date_time: string;
  job_id: number;
  job_description: string;
  task_id: number | null;
  task_description: string | null;
  ticket_number: number;
  employee_name: string;
  shift: number;
}

interface LocoBookingHistoryProps {
  historyBookings: RawBooking[];
  locos: Loco[];
  jobs: Job[];
  locoTypes: LocoType[];
  historySearch: string;
  setHistorySearch: (val: string) => void;
  historyShift: string;
  setHistoryShift: (val: string) => void;
  historyStartDate: string;
  setHistoryStartDate: (val: string) => void;
  historyEndDate: string;
  setHistoryEndDate: (val: string) => void;
  showStage6: boolean;
  setShowStage6: (val: boolean) => void;
  expandedLocos: Set<string>;
  toggleLoco: (key: string) => void;
  collapsedDates: Set<string>;
  toggleDate: (key: string) => void;
  collapsedShifts: Set<string>;
  toggleShift: (key: string) => void;
  expandAllHistory: () => void;
  collapseAllHistory: () => void;
  isEditMode: boolean;
  handleDeleteLocoBooking: (locoNum: string, dateTime: string) => void;
  handleEditJob: (locoNum: string, dateTime: string, jobId: number) => void;
  handleDeleteJob: (locoNum: string, dateTime: string, jobId: number) => void;
  handleEditTask: (taskId: number, desc: string) => void;
  handleDeleteTask: (taskId: number) => void;
  newTaskInputs: Record<string, string>;
  setNewTaskInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleAddSingleTask: (locoNum: string, dateTime: string, jobId: number) => void;
  setAddingJobLoco: (val: { locoNum: string; dateTime: string; shift: number } | null) => void;
  typeName: (typeId: number) => string;
}

const LocoBookingHistory: React.FC<LocoBookingHistoryProps> = ({
  historyBookings,
  locos,
  historySearch,
  setHistorySearch,
  historyShift,
  setHistoryShift,
  historyStartDate,
  setHistoryStartDate,
  historyEndDate,
  setHistoryEndDate,
  showStage6,
  setShowStage6,
  expandedLocos,
  toggleLoco,
  collapsedDates,
  toggleDate,
  collapsedShifts,
  toggleShift,
  expandAllHistory,
  collapseAllHistory,
  isEditMode,
  handleDeleteLocoBooking,
  handleEditJob,
  handleDeleteJob,
  handleEditTask,
  handleDeleteTask,
  newTaskInputs,
  setNewTaskInputs,
  handleAddSingleTask,
  setAddingJobLoco,
  typeName,
}) => {
  const filteredHistoryBookings = historyBookings.filter((b) => {
    const ml = locos.find((l) => l.loco_number === b.loco_number);
    const matchesSearch = b.loco_number.toLowerCase().includes(historySearch.trim().toLowerCase());
    const matchesShift = historyShift === "all" || b.shift.toString() === historyShift;
    const matchesStage = showStage6 || (ml ? ml.stage !== 6 : true);
    return matchesSearch && matchesShift && matchesStage;
  });

  const groupedHistory = groupBookings(filteredHistoryBookings);

  return (
    <section className="bookings-list-panel" style={{ width: "100%" }}>
      <div className="panel-card scrollable">
        <h2>Booked Workshop Operations Logs</h2>

        <div className="history-filters-bar">
          <div className="filter-group flex-grow">
            <label className="form-label">Search Locomotive</label>
            <div className="search-box-wrapper">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Search by Loco Number..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ paddingLeft: "2.25rem" }}
              />
            </div>
          </div>

          <div className="filter-group">
            <label className="form-label">Shift</label>
            <select
              className="modal-select"
              value={historyShift}
              onChange={(e) => setHistoryShift(e.target.value)}
            >
              <option value="all">All Shifts</option>
              <option value="1">Shift 1</option>
              <option value="2">Shift 2</option>
            </select>
          </div>

          <div className="filter-group date-filter-history">
            <label className="form-label">
              <Calendar size={14} /> Start Date
            </label>
            <input
              type="date"
              required={true}
              value={historyStartDate}
              onChange={(e) => setHistoryStartDate(e.target.value)}
            />
          </div>

          <div className="filter-group date-filter-history">
            <label className="form-label">
              <Calendar size={14} /> End Date
            </label>
            <input
              type="date"
              required={true}
              value={historyEndDate}
              onChange={(e) => setHistoryEndDate(e.target.value)}
            />
          </div>

          <div className="filter-group checkbox-filter">
            <label className="checkbox-toggle-wrapper">
              <input
                type="checkbox"
                checked={showStage6}
                onChange={(e) => setShowStage6(e.target.checked)}
              />
              <span>Show Stage 6</span>
            </label>
          </div>

          <div className="filter-group">
            <label className="form-label">View Controls</label>
            <div className="collapse-controls-group">
              <button
                type="button"
                onClick={expandAllHistory}
                className="btn-collapse-control"
                title="Expand all dates, shifts, and locomotives"
              >
                <ChevronDown size={14} /> Expand All
              </button>
              <button
                type="button"
                onClick={collapseAllHistory}
                className="btn-collapse-control"
                title="Collapse all dates, shifts, and locomotives"
              >
                <ChevronUp size={14} /> Collapse All
              </button>
            </div>
          </div>
        </div>

        <div className="timeline-grouped-bookings">
          {Object.keys(groupedHistory).map((dateStr) => {
            const isDateCollapsed = collapsedDates.has(dateStr);
            return (
              <div key={dateStr} className="date-group-card">
                <div
                  className="date-header"
                  onClick={() => toggleDate(dateStr)}
                  style={{ cursor: "pointer" }}
                >
                  <Calendar size={16} />
                  <h3>{dateStr}</h3>
                  <div style={{ flexGrow: 1 }} />
                  {!isDateCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {!isDateCollapsed && (
                  <div className="date-group-content">
                    {Object.keys(groupedHistory[dateStr]).map((shift) => {
                      const shiftKey = `${dateStr}-${shift}`;
                      const isShiftCollapsed = collapsedShifts.has(shiftKey);
                      return (
                        <div key={shift} className="shift-block">
                          <div
                            className="shift-header"
                            onClick={() => toggleShift(shiftKey)}
                            style={{ cursor: "pointer" }}
                          >
                            <Clock size={14} />
                            <h4>Shift {shift}</h4>
                            <div style={{ flexGrow: 1 }} />
                            {!isShiftCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>

                          {!isShiftCollapsed && (
                            <div className="locos-list">
                              {Object.keys(groupedHistory[dateStr][parseInt(shift)]).map((locoStr) => {
                                const locoNum = locoStr;
                                const record = groupedHistory[dateStr][parseInt(shift)][locoNum];
                                const ml = locos.find((l) => l.loco_number === locoNum);
                                const tn = ml ? typeName(ml.loco_type_id) : null;
                                const isExpanded = expandedLocos.has(
                                  `${dateStr}-${shift}-${locoNum}`
                                );
                                return (
                                  <div key={locoNum} className="loco-booking-card collapsible">
                                    <div
                                      className="loco-card-title"
                                      onClick={() => toggleLoco(`${dateStr}-${shift}-${locoNum}`)}
                                      style={{ cursor: "pointer" }}
                                    >
                                      <Train size={16} />
                                      <h5>
                                        Locomotive #{locoNum}
                                        {tn ? ` (${tn})` : ""}
                                      </h5>
                                      <span className="booked-by-badge">
                                        <User size={12} /> {record.employee_name}
                                      </span>
                                      <div style={{ flexGrow: 1 }} />
                                      {isEditMode && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteLocoBooking(locoNum, record.date_time);
                                          }}
                                          className="delete-loco-btn"
                                          title="Delete entire locomotive booking"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                    {isExpanded && (
                                      <div className="loco-jobs-list">
                                        {Object.keys(record.jobs).map((jobIdStr) => {
                                          const jobId = parseInt(jobIdStr);
                                          const job = record.jobs[jobId];
                                          return (
                                            <div key={jobIdStr} className="loco-job-item">
                                              <div className="job-meta">
                                                <ClipboardList size={14} />
                                                <h6>{job.job_description}</h6>
                                                {isEditMode && (
                                                  <div className="action-buttons">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleEditJob(
                                                          locoNum,
                                                          record.date_time,
                                                          jobId
                                                        )
                                                      }
                                                    >
                                                      <Edit2 size={12} />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handleDeleteJob(
                                                          locoNum,
                                                          record.date_time,
                                                          jobId
                                                        )
                                                      }
                                                    >
                                                      <Trash2 size={12} />
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                              {job.tasks.length > 0 && (
                                                <ul className="job-tasks-sublist">
                                                  {job.tasks.map((t, i) => (
                                                    <li key={i}>
                                                      <span>
                                                        <FileText size={12} style={{ marginRight: 4 }} />
                                                        {t.desc}
                                                      </span>
                                                      {isEditMode && (
                                                        <div className="action-buttons">
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              handleEditTask(t.id, t.desc)
                                                            }
                                                          >
                                                            <Edit2 size={12} />
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() => handleDeleteTask(t.id)}
                                                          >
                                                            <Trash2 size={12} />
                                                          </button>
                                                        </div>
                                                      )}
                                                    </li>
                                                  ))}
                                                </ul>
                                              )}
                                              {isEditMode && (
                                                <div className="job-add-task-row">
                                                  <input
                                                    type="text"
                                                    placeholder="Add new task..."
                                                    className="list-add-task-input"
                                                    value={
                                                      newTaskInputs[
                                                        `${locoNum}-${record.date_time}-${jobId}`
                                                      ] || ""
                                                    }
                                                    onChange={(e) =>
                                                      setNewTaskInputs((p) => ({
                                                        ...p,
                                                        [`${locoNum}-${record.date_time}-${jobId}`]:
                                                          e.target.value,
                                                      }))
                                                    }
                                                    onKeyDown={async (e) => {
                                                      if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        await handleAddSingleTask(
                                                          locoNum,
                                                          record.date_time,
                                                          jobId
                                                        );
                                                      }
                                                    }}
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleAddSingleTask(
                                                        locoNum,
                                                        record.date_time,
                                                        jobId
                                                      )
                                                    }
                                                    className="btn-add-task-small"
                                                  >
                                                    Add
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {isEditMode && (
                                          <div className="add-job-action-row">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setAddingJobLoco({
                                                  locoNum,
                                                  dateTime: record.date_time,
                                                  shift: parseInt(shift),
                                                })
                                              }
                                              className="add-job-list-btn"
                                            >
                                              <Plus size={14} /> Add Job
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {filteredHistoryBookings.length === 0 && (
            <p className="no-records-hint">No logs match search criteria or selected date range.</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default LocoBookingHistory;
