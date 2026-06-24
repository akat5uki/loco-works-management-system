import React from "react";
import ThemeToggle from "../../../shared/components/ThemeToggle";
import NotificationBell from "../../bookings/components/NotificationBell";

interface EmployeeNotification {
  notification_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface DashboardHeaderProps {
  userName: string;
  notifications: EmployeeNotification[];
  handleMarkAsRead: (id: number) => Promise<void>;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  userName,
  notifications,
  handleMarkAsRead,
}) => {
  return (
    <header className="dashboard-header">
      <div className="header-user">
        <h2>Welcome back, {userName}</h2>
        <p>Workplace Overview & Quick Actions</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <ThemeToggle />
        
        {/* Notification Bell */}
        <NotificationBell
          notifications={notifications}
          handleMarkAsRead={handleMarkAsRead}
        />

        <div className="header-date">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
