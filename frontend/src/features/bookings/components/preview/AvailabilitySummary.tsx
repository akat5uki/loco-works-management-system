import React from "react";
import { CheckCircle, XCircle } from "lucide-react";

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
  return (
    <>
      <h2 style={{ borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
        1. Employee Availability Summary (Current Shift)
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
        
        <div>
          <h3 style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.1rem" }}>
            <CheckCircle size={18} /> Available Employees ({availableEmployees.length})
          </h3>
          {availableEmployees.length === 0 ? (
            <p style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No employees available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.75rem", background: "var(--bg)" }}>
              {availableEmployees.map(e => (
                <div key={e.ticket_number} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span>{e.name} (Ticket #{e.ticket_number})</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{e.designation_name}</span>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.75rem", background: "var(--bg)" }}>
              {unavailableEmployees.map(e => (
                <div key={e.ticket_number} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span>{e.name} (Ticket #{e.ticket_number})</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{e.designation_name}</span>
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
