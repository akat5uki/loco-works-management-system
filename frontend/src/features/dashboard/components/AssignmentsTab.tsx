import React from "react";
import { useNavigate } from "react-router-dom";
import { Train } from "lucide-react";

interface UserProfile {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string | null;
  category_name: string | null;
  is_supervisor: boolean;
  email: string | null;
}

interface SupervisorAssignment {
  supervisor_ticket_number: number;
  supervisor_name: string;
  supervisor_designation: string;
  locos: Array<{
    loco_number: string;
    is_forwarded: boolean;
    staff: Array<{ staff_ticket_number: number; staff_name: string; staff_designation: string }>;
    status?: string;
  }>;
}

interface StaffAssignment {
  staff_ticket_number: number;
  staff_name: string;
  staff_designation: string;
  assignments: Array<{
    loco_number: string;
    supervisor_ticket_number: number;
    supervisor_name: string;
    supervisor_designation: string;
    status?: string;
  }>;
}

type AssignmentItem = SupervisorAssignment | StaffAssignment;

interface AssignmentsTabProps {
  userProfile: UserProfile;
  assignments: AssignmentItem[];
}

const tagStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.6rem",
  fontWeight: 700,
  color: "var(--accent)",
  background: "var(--accent-bg)",
  border: "1px solid var(--accent)",
  borderRadius: "3px",
  padding: "0.02rem 0.25rem",
  marginRight: "0.35rem",
  textTransform: "uppercase",
  verticalAlign: "middle",
  lineHeight: 1.4,
};

const AssignmentsTab: React.FC<AssignmentsTabProps> = ({
  userProfile,
  assignments,
}) => {
  const navigate = useNavigate();

  return (
    <section className="profile-container" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div className="profile-card" style={{ padding: "2rem", width: "100%", maxWidth: "800px" }}>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1.5rem", color: "var(--text-h)" }}>
          Your Current Assignments (This Shift)
        </h3>
        {assignments.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.9rem", margin: 0 }}>
            No locomotive assignments for the current shift.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
            {(userProfile?.designation_id === 1 || userProfile?.designation_id === 2) ? (
              // Supervisor assignments view
              (assignments as SupervisorAssignment[]).map((asg) => (
                asg.locos.map((l) => (
                  <div key={l.loco_number} style={{ border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem", background: "var(--bg-secondary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                      <div 
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1.1rem", color: "var(--accent)", cursor: "pointer" }}
                        onClick={() => navigate("/bookings/carry-forward", { state: { selectLoco: l.loco_number } })}
                      >
                        <Train size={18} /> Loco #{l.loco_number}
                      </div>
                      {l.status && (
                        <span style={{
                          fontSize: "0.7rem",
                          fontWeight: "bold",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "4px",
                          background: l.status === "completed" ? "rgba(16, 185, 129, 0.15)" : l.status === "partially completed" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: l.status === "completed" ? "#10b981" : l.status === "partially completed" ? "#f59e0b" : "#ef4444",
                          border: `1px solid ${l.status === "completed" ? "rgba(16, 185, 129, 0.3)" : l.status === "partially completed" ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                        }}>
                          {l.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.25rem" }}>Assigned Staff:</div>
                    {l.staff.length === 0 ? (
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>No staff assigned yet.</p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
                        {l.staff.map((st) => (
                          <li key={st.staff_ticket_number}>
                            {st.staff_designation && (
                              <span style={tagStyle}>
                                {st.staff_designation}
                              </span>
                            )}
                            {st.staff_name} (Ticket #{st.staff_ticket_number})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ))
            ) : (
              // Staff assignments view
              (assignments as StaffAssignment[]).map((asg) => (
                asg.assignments.map((asgn, idx: number) => (
                  <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem", background: "var(--bg-secondary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1.1rem", color: "var(--accent)" }}>
                        <Train size={18} /> Loco #{asgn.loco_number}
                      </div>
                      {asgn.status && (
                        <span style={{
                          fontSize: "0.7rem",
                          fontWeight: "bold",
                          padding: "0.15rem 0.4rem",
                          borderRadius: "4px",
                          background: asgn.status === "completed" ? "rgba(16, 185, 129, 0.15)" : asgn.status === "partially completed" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: asgn.status === "completed" ? "#10b981" : asgn.status === "partially completed" ? "#f59e0b" : "#ef4444",
                          border: `1px solid ${asgn.status === "completed" ? "rgba(16, 185, 129, 0.3)" : asgn.status === "partially completed" ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                        }}>
                          {asgn.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.85rem" }}>
                      <strong>Supervisor:</strong>{" "}
                      {asgn.supervisor_designation && (
                        <span style={tagStyle}>
                          {asgn.supervisor_designation}
                        </span>
                      )}
                      {asgn.supervisor_name} (Ticket #{asgn.supervisor_ticket_number})
                    </div>
                  </div>
                ))
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default AssignmentsTab;
