import React from "react";
import { useNavigate } from "react-router-dom";
import { Train, Users, ClipboardList, FileText, Settings } from "lucide-react";

interface DashboardTilesProps {
  isSupervisor: boolean;
}

const DashboardTiles: React.FC<DashboardTilesProps> = ({ isSupervisor }) => {
  const navigate = useNavigate();

  const tiles = [
    ...(isSupervisor
      ? [
          {
            title: "Loco Booking",
            icon: <Train size={32} />,
            color: "#3b82f6",
            description: "Book a locomotive for a job",
            path: "/bookings/loco",
          },
          {
            title: "Employee Availability",
            icon: <ClipboardList size={32} />,
            color: "#ec4899",
            description: "Mark daily availability for staff",
            path: "/bookings/availability",
          },
          {
            title: "Employees Booking",
            icon: <Users size={32} />,
            color: "#10b981",
            description: "Assign supervisors & staff to active locos",
            path: "/bookings/employees",
          },
          {
            title: "Job Completion & Carry Forward",
            icon: <ClipboardList size={32} />,
            color: "#f59e0b",
            description: "Submit remarks and carry forward jobs/tasks to the next shift",
            path: "/bookings/carry-forward",
          },
        ]
      : []),
    {
      title: "Booking Preview & Export",
      icon: <FileText size={32} />,
      color: "#06b6d4",
      description: "Preview shift details and export to PDF/Excel",
      path: "/bookings/preview",
    },
    ...(isSupervisor
      ? [
          {
            title: "Master Data Management",
            icon: <Settings size={32} />,
            color: "#6366f1",
            description: "Manage locos, jobs, and staff",
            path: "/crud",
          },
        ]
      : []),
  ];

  return (
    <section className="tiles-grid">
      {tiles.map((tile, index) => (
        <div
          key={index}
          className="tile-card"
          style={{ "--tile-color": tile.color } as React.CSSProperties}
          onClick={() => navigate(tile.path)}
        >
          <div
            className="tile-icon"
            style={{
              backgroundColor: tile.color + "15",
              color: tile.color,
            }}
          >
            {tile.icon}
          </div>
          <div className="tile-content">
            <h3>{tile.title}</h3>
            <p>{tile.description}</p>
          </div>
        </div>
      ))}
    </section>
  );
};

export default DashboardTiles;
