import React from "react";
import EmployeeToggleItem from "./EmployeeToggleItem";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
}

interface DesignationGroup {
  designation_id: number;
  designation_name: string;
  employees: Employee[];
}

interface CategoryGroup {
  category_id: number;
  category_name: string;
  designations: DesignationGroup[];
}

interface AvailabilityGroupProps {
  groupedEmployees: CategoryGroup[];
  availableTickets: Set<number>;
  handleToggleAvailability: (ticket: number) => void;
  lockOwner: { name: string; ticket_number: number } | null;
}

const AvailabilityGroup: React.FC<AvailabilityGroupProps> = ({
  groupedEmployees,
  availableTickets,
  handleToggleAvailability,
  lockOwner,
}) => {
  if (groupedEmployees.length === 0) {
    return (
      <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "2rem" }}>
        No employees match search criteria.
      </p>
    );
  }

  return (
    <div className="availability-list-content">
      {groupedEmployees.map((cat) => (
        <div key={cat.category_id} className="category-group" style={{ marginBottom: "1.5rem" }}>
          <h3
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--accent)",
              borderBottom: "1.5px solid var(--border)",
              paddingBottom: "0.25rem",
              marginBottom: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {cat.category_name}s
          </h3>

          {cat.designations.map((desig) => (
            <div
              key={desig.designation_id}
              className="designation-group"
              style={{ marginBottom: "1rem", paddingLeft: "0.5rem" }}
            >
              <h4
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--text-h)",
                  marginBottom: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }}
                ></span>
                {desig.designation_name} ({desig.employees.length})
              </h4>

              <div
                className="designation-employees-list"
                style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingLeft: "0.5rem" }}
              >
                {desig.employees.map((emp) => (
                  <EmployeeToggleItem
                    key={emp.ticket_number}
                    emp={emp}
                    isAvailable={availableTickets.has(emp.ticket_number)}
                    handleToggleAvailability={handleToggleAvailability}
                    lockOwner={lockOwner}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default AvailabilityGroup;
