import React from "react";
import { AlertTriangle } from "lucide-react";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
}

interface SupervisorAssignStepProps {
  locos: string[];
  supervisorList: Employee[];
  availableTickets: Set<number>;
  tempSupervisorLocos: Record<number, string[]>;
  handleToggleSupervisorLoco: (ticket: number, locoNum: string) => void;
  handleSaveSupervisors: () => void;
  lockOwner: { name: string; ticket_number: number } | null;
  saving: boolean;
}

const SupervisorAssignStep: React.FC<SupervisorAssignStepProps> = ({
  locos,
  supervisorList,
  availableTickets,
  tempSupervisorLocos,
  handleToggleSupervisorLoco,
  handleSaveSupervisors,
  lockOwner,
  saving,
}) => {
  return (
    <div className="wizard-step-container">
      <div className="step-header">
        <h3>Assign Supervisors to Locomotive</h3>
        <p className="step-subheader">Assign SSE/JE supervisors to lead teams for each locomotive.</p>
      </div>

      {locos.length === 0 ? (
        <div className="empty-wizard-state">
          <AlertTriangle size={24} className="warning-icon" />
          <p>No locomotives are active for booking today.</p>
        </div>
      ) : (
        <div className="locos-supervisors-grid">
          {locos.map((locoNum) => {
            const assignedSupervisors = supervisorList.filter((sup) => {
              const assignedLocos = tempSupervisorLocos[sup.ticket_number] || [];
              return assignedLocos.includes(locoNum) && availableTickets.has(sup.ticket_number);
            });

            return (
              <div key={locoNum} className="loco-assignment-card">
                <div className="loco-card-header">
                  <span className="loco-number-label">Locomotive #{locoNum}</span>
                  {assignedSupervisors.length > 0 && (
                    <span className="badge-assigned-count">
                      {assignedSupervisors.length} SSE/JE Assigned
                    </span>
                  )}
                </div>

                <div className="supervisors-toggle-list">
                  {supervisorList
                    .filter((sup) => availableTickets.has(sup.ticket_number))
                    .map((sup) => {
                      const isAssigned = (tempSupervisorLocos[sup.ticket_number] || []).includes(locoNum);
                      return (
                        <label
                          key={sup.ticket_number}
                          className={`supervisor-toggle-chip ${isAssigned ? "assigned" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            disabled={!!lockOwner}
                            onChange={() => handleToggleSupervisorLoco(sup.ticket_number, locoNum)}
                          />
                          <div className="chip-details">
                            <span className="sup-name">{sup.name}</span>
                            <span className="sup-desig">{sup.designation_name}</span>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="btn-primary-action save-step-btn"
        onClick={handleSaveSupervisors}
        disabled={!!lockOwner || saving || locos.length === 0}
      >
        {saving ? "Saving Assignments..." : "Save Supervisor Assignments & Proceed"}
      </button>
    </div>
  );
};

export default SupervisorAssignStep;
