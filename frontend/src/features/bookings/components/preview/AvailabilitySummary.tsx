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
      <div className="availability-summary-grid">
        
        <div>
          <h3 style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.1rem" }}>
            <CheckCircle size={18} /> Available Employees ({availableEmployees.length})
          </h3>
          {availableEmployees.length === 0 ? (
            <p style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No employees available.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 0.75rem", background: "var(--bg)" }}>
              {availableEmployees.map((e, index) => (
                <div 
                  key={e.ticket_number} 
                  style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "0.2rem", 
                    padding: "0.5rem 0", 
                    borderBottom: index === availableEmployees.length - 1 ? "none" : "1px solid var(--border)" 
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-h)" }}>{e.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Ticket #{e.ticket_number}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 500 }}>{e.designation_name}</div>
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
              {unavailableEmployees.map((e, index) => (
                <div 
                  key={e.ticket_number} 
                  style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "0.2rem", 
                    padding: "0.5rem 0", 
                    borderBottom: index === unavailableEmployees.length - 1 ? "none" : "1px solid var(--border)" 
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-h)" }}>{e.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Ticket #{e.ticket_number}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--accent)", fontWeight: 500 }}>{e.designation_name}</div>
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
