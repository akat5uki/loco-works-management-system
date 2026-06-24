import React from "react";
import { useNavigate } from "react-router-dom";
import { Train, Users, MessageSquare, ClipboardList, BarChart3, LogOut } from "lucide-react";

interface DashboardSidebarProps {
  activeTab: "dashboard" | "profile" | "chat" | "my_booking";
  setActiveTab: (tab: "dashboard" | "profile" | "chat" | "my_booking") => void;
  handleLogout: () => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  setActiveTab,
  handleLogout,
}) => {
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/favicon.svg" alt="LWMS Logo" className="logo-box" />
        <span>LWMS</span>
      </div>
      <nav className="sidebar-nav">
        <div
          className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
          style={{ cursor: "pointer" }}
        >
          <Train size={20} /> <span>Dashboard</span>
        </div>
        <div
          className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
          style={{ cursor: "pointer" }}
        >
          <Users size={20} /> <span>Profile</span>
        </div>
        <div
          className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
          style={{ cursor: "pointer" }}
        >
          <MessageSquare size={20} /> <span>Chat</span>
        </div>
        <div
          className={`nav-item ${activeTab === "my_booking" ? "active" : ""}`}
          onClick={() => setActiveTab("my_booking")}
          style={{ cursor: "pointer" }}
        >
          <ClipboardList size={20} /> <span>My Booking</span>
        </div>
        <div
          className="nav-item"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >
          <BarChart3 size={20} /> <span>Statistics</span>
        </div>
      </nav>
      <button className="logout-btn" onClick={handleLogout}>
        <LogOut size={20} /> <span>Logout</span>
      </button>
    </aside>
  );
};

export default DashboardSidebar;
