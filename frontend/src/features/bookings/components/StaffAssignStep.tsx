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

interface StaffAssignStepProps {
  locos: string[];
  selectedLoco: string | null;
  setSelectedLoco: (loco: string | null) => void;
  supervisorList: Employee[];
  tempSupervisorLocos: Record<number, string[]>;
  groupedStaffList: Record<string, Employee[]>;
  availableTickets: Set<number>;
  locoStaffMap: Record<string, number[]>;
  handleToggleStaffSelection: (ticket: number) => void;
  getStaffWarning: (ticket: number) => string | null;
  handleSaveStaff: () => void;
  lockOwner: { name: string; ticket_number: number } | null;
  saving: boolean;
}

const StaffAssignStep: React.FC<StaffAssignStepProps> = ({
  locos,
  selectedLoco,
  setSelectedLoco,
  supervisorList,
  tempSupervisorLocos,
  groupedStaffList,
  availableTickets,
  locoStaffMap,
  handleToggleStaffSelection,
  getStaffWarning,
  handleSaveStaff,
  lockOwner,
  saving,
}) => {
  // Find supervisors assigned to selectedLoco in Step 1/tempSupervisorLocos
  const assignedSupervisors = selectedLoco
    ? supervisorList.filter((sup) => {
        const assignedLocos = tempSupervisorLocos[sup.ticket_number] || [];
        return assignedLocos.includes(selectedLoco);
      })
    : [];

  return (
    <div className="wizard-step-container">
      <div className="step-header">
        <h3>Assign Staff to Locomotive</h3>
        <p className="step-subheader">Choose a locomotive, verify assigned supervisors, and allocate technicians and staff.</p>
      </div>

      <div className="form-group select-loco-group">
        <label htmlFor="loco-select-dropdown">Select Locomotive</label>
        <select
          id="loco-select-dropdown"
          className="config-select"
          style={{ width: "100%" }}
          value={selectedLoco || ""}
          onChange={(e) => setSelectedLoco(e.target.value || null)}
          disabled={!!lockOwner}
        >
          <option value="">-- Choose Locomotive --</option>
          {locos.map((locoNum) => (
            <option key={locoNum} value={locoNum}>
              Loco #{locoNum}
            </option>
          ))}
        </select>
      </div>

      {selectedLoco && (
        <div className="staff-assignment-panel">
          {assignedSupervisors.length === 0 ? (
            <div className="wizard-warning-banner" style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid #f59e0b", color: "#f59e0b" }}>
              <AlertTriangle size={18} />
              <span>
                No supervisors are assigned to Loco #{selectedLoco}. Staff booking is not required for this locomotive.
              </span>
            </div>
          ) : (
            <div className="staff-selection-container">
              <div className="linked-supervisors-box">
                <span className="linked-title">Linked Supervisors:</span>
                <div className="supervisor-tags">
                  {assignedSupervisors.map((sup) => (
                    <span key={sup.ticket_number} className="supervisor-tag">
                      {sup.name} ({sup.designation_name})
                    </span>
                  ))}
                </div>
              </div>

              <div className="staff-hierarchy-list-wrapper">
                <div className="staff-hierarchy-list">
                  {Object.entries(groupedStaffList)
                    .sort((a, b) => {
                      const aDesigId = a[1][0]?.designation_id || 99;
                      const bDesigId = b[1][0]?.designation_id || 99;
                      return aDesigId - bDesigId;
                    })
                    .map(([desigName, staffMembers]) => (
                      <div key={desigName} className="hierarchy-section">
                        <h5 className="hierarchy-section-title">{desigName}</h5>
                        <div className="hierarchy-items">
                          {staffMembers.map((staff) => {
                            const isAvailable = availableTickets.has(staff.ticket_number);
                            const isChecked = (locoStaffMap[selectedLoco] || []).includes(staff.ticket_number);
                            const warning = getStaffWarning(staff.ticket_number);
                            const isMultipleSups = warning && warning.includes("multiple supervisors");

                            return (
                              <label
                                key={staff.ticket_number}
                                className={`staff-selection-row ${isChecked ? "selected" : ""} ${
                                  !isAvailable ? "unavailable" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={!isAvailable || !!lockOwner}
                                  onChange={() => {
                                    if (isAvailable) handleToggleStaffSelection(staff.ticket_number);
                                  }}
                                />
                                <div className="staff-meta-row">
                                  <span className="staff-name-ticket">
                                    {staff.name} (Ticket #{staff.ticket_number})
                                  </span>
                                  {!isAvailable && (
                                    <span className="warning-badge error-badge">Unavailable</span>
                                  )}
                                  {warning && (
                                    <span
                                      className={`warning-badge ${
                                        isMultipleSups ? "multiple-sups-badge" : "default-warn-badge"
                                      }`}
                                    >
                                      <AlertTriangle size={10} /> {warning}
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <button
                type="button"
                className="btn-primary-action save-staff-btn"
                onClick={handleSaveStaff}
                disabled={!!lockOwner || saving}
              >
                {saving ? "Saving Staff Assignments..." : `Save Staff Assignments for Loco #${selectedLoco}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StaffAssignStep;
