import React from "react";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
}

interface EmployeeToggleItemProps {
  emp: Employee;
  isAvailable: boolean;
  handleToggleAvailability: (ticket: number) => void;
  lockOwner: { name: string; ticket_number: number } | null;
}

const EmployeeToggleItem: React.FC<EmployeeToggleItemProps> = ({
  emp,
  isAvailable,
  handleToggleAvailability,
  lockOwner,
}) => {
  return (
    <div className={`employee-toggle-item ${isAvailable ? "available" : ""}`}>
      <div className="emp-meta">
        <span className="emp-name">{emp.name}</span>
        <span className="emp-ticket">Ticket #{emp.ticket_number}</span>
        <span className="emp-badge">{emp.designation_name}</span>
      </div>
      <button
        className={`avail-toggle-btn ${isAvailable ? "active" : ""}`}
        onClick={() => handleToggleAvailability(emp.ticket_number)}
        disabled={!!lockOwner}
        type="button"
      >
        {isAvailable ? "Available" : "Unavailable"}
      </button>
    </div>
  );
};

export default EmployeeToggleItem;
