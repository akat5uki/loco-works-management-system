import React from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { groupEmployees } from "../../utils/employeeGrouper";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
}

interface AvailabilitySummaryProps {
  availableEmployees: Employee[];
  unavailableEmployees: Employee[];
}

const AvailabilitySummary: React.FC<AvailabilitySummaryProps> = ({
  availableEmployees,
  unavailableEmployees,
}) => {
  const groupedAvailable = groupEmployees(availableEmployees);
  const groupedUnavailable = groupEmployees(unavailableEmployees);

  return (
    <>
      <h2 style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
        1. Employee Availability Summary (Current Shift)
      </h2>
      <div className="availability-summary-grid">
        
        <div>
          <h3 style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.1rem" }}>
            <CheckCircle size={18} /> Available Employees ({availableEmployees.length})
          </h3>
          {availableEmployees.length === 0 ? (
            <p style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No employees available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 0.75rem", background: "var(--bg)" }}>
              {groupedAvailable.map((group, groupIdx) => (
                <div key={group.designationId} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "0.625rem 0 0.35rem 0", borderBottom: "1.5px solid var(--border)", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", color: "var(--accent)", letterSpacing: "0.03em" }}>
                      {group.categoryName} — {group.designationName} ({group.employees.length})
                    </span>
                  </div>
                  {group.employees.map((e, index) => {
                    const isLastInGroup = index === group.employees.length - 1;
                    const isLastGroup = groupIdx === groupedAvailable.length - 1;
                    return (
                      <div 
                        key={e.ticket_number} 
                        style={{ 
                          display: "flex", 
                          flexDirection: "column", 
                          gap: "0.15rem", 
                          padding: "0.5rem 0", 
                          borderBottom: (isLastInGroup && isLastGroup) ? "none" : "1px solid var(--border)" 
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-h)" }}>{e.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Ticket #{e.ticket_number}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.1rem" }}>
            <XCircle size={18} /> Unavailable Employees ({unavailableEmployees.length})
          </h3>
          {unavailableEmployees.length === 0 ? (
            <p style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No employees unavailable.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 0.75rem", background: "var(--bg)" }}>
              {groupedUnavailable.map((group, groupIdx) => (
                <div key={group.designationId} style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "0.625rem 0 0.35rem 0", borderBottom: "1.5px solid var(--border)", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", color: "var(--accent)", letterSpacing: "0.03em" }}>
                      {group.categoryName} — {group.designationName} ({group.employees.length})
                    </span>
                  </div>
                  {group.employees.map((e, index) => {
                    const isLastInGroup = index === group.employees.length - 1;
                    const isLastGroup = groupIdx === groupedUnavailable.length - 1;
                    return (
                      <div 
                        key={e.ticket_number} 
                        style={{ 
                          display: "flex", 
                          flexDirection: "column", 
                          gap: "0.15rem", 
                          padding: "0.5rem 0", 
                          borderBottom: (isLastInGroup && isLastGroup) ? "none" : "1px solid var(--border)" 
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-h)" }}>{e.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Ticket #{e.ticket_number}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AvailabilitySummary;
