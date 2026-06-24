import React from "react";
import { Train, ChevronDown, ChevronRight, Users, User } from "lucide-react";
import LocoSummaryJobs from "./LocoSummaryJobs";

interface StaffInfo {
  staff_ticket_number: number;
  staff_name: string;
}

interface SupervisorInfo {
  supervisor_ticket_number: number;
  supervisor_name: string;
  is_forwarded: boolean;
  staff: StaffInfo[];
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

interface LocoInfo {
  loco_number: string;
  status: string;
  supervisors: SupervisorInfo[];
}

interface LocoSummaryCardProps {
  loco: LocoInfo;
  jobs: JobInfo[];
  isNodeExpanded: (nodeId: string, defaultVal?: boolean) => boolean;
  toggleNode: (nodeId: string, defaultVal?: boolean) => void;
  remarksStateForLoco?: {
    jobs: Record<number, { completed: boolean; remarks: string }>;
    tasks: Record<number, { completed: boolean; remarks: string }>;
  };
}

const LocoSummaryCard: React.FC<LocoSummaryCardProps> = ({
  loco,
  jobs,
  isNodeExpanded,
  toggleNode,
  remarksStateForLoco,
}) => {
  const locoNum = loco.loco_number;
  const locoStatus = loco.status || "incomplete";
  const isLocoExpanded = isNodeExpanded(locoNum, false);

  const supsKey = `${locoNum}-supervisors-group`;
  const isSupsExpanded = isNodeExpanded(supsKey, true);

  const staffsKey = `${locoNum}-staffs-group`;
  const isStaffsExpanded = isNodeExpanded(staffsKey, true);

  // Extract unique staff members
  const uniqueStaffMap = new Map<number, StaffInfo>();
  loco.supervisors.forEach(s => {
    s.staff.forEach(st => {
      uniqueStaffMap.set(st.staff_ticket_number, st);
    });
  });
  const staffList = Array.from(uniqueStaffMap.values());

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg)", marginBottom: "1rem", overflow: "hidden" }}>
      
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
          {!isLocoExpanded && loco.supervisors.length > 0 && (
            <span className="no-print" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              ({loco.supervisors.map(s => s.supervisor_name).join(", ")})
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
                  ({loco.supervisors.length} booked)
                </span>
              </div>
            </div>

            <div 
              className="tree-node-content tree-node-children print-visible-block"
              style={{ display: isSupsExpanded ? "flex" : "none" }}
            >
              {loco.supervisors.length === 0 ? (
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
                loco.supervisors.map(s => (
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

          {/* Node: Staffs */}
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

          {/* Node: Operations & Carry Forward Details */}
          <LocoSummaryJobs
            locoNum={locoNum}
            jobs={jobs}
            isNodeExpanded={isNodeExpanded}
            toggleNode={toggleNode}
            remarksStateForLoco={remarksStateForLoco}
          />

        </div>
      </div>

    </div>
  );
};

export default LocoSummaryCard;
