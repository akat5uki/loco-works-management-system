import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import {
  Train,
  Users,
  Settings,
  FileText,
  LogOut,
  PlusCircle,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import api from "../../shared/services/api";
import "./Dashboard.css";

const DashboardPage = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Employee");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get("/auth/me");
        setUserName(response.data.name);
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    };
    fetchUser();
  }, []);

  const tiles = [
    {
      title: "Loco Booking",
      icon: <Train size={32} />,
      color: "#3b82f6",
      description: "Book a locomotive for a job",
      path: "/bookings/loco",
    },
    {
      title: "Staff Booking",
      icon: <Users size={32} />,
      color: "#10b981",
      description: "Assign staff to ongoing tasks",
      path: "/bookings/staff",
    },
    {
      title: "CRUD Operations",
      icon: <Settings size={32} />,
      color: "#6366f1",
      description: "Manage locos, jobs, and staff",
      path: "/crud",
    },
    {
      title: "Job Reports",
      icon: <FileText size={32} />,
      color: "#f59e0b",
      description: "View and download job details",
      path: "/reports",
    },
    {
      title: "Ongoing Stages",
      icon: <PlusCircle size={32} />,
      color: "#ec4899",
      description: "Update locomotive production stages",
      path: "/stages",
    },
    {
      title: "Task Lists",
      icon: <ClipboardList size={32} />,
      color: "#8b5cf6",
      description: "Manage specific tasks for each job",
      path: "/tasks",
    },
    {
      title: "Analytics",
      icon: <BarChart3 size={32} />,
      color: "#06b6d4",
      description: "View performance and production trends",
      path: "/analytics",
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-box">L</div>
          <span>LocoWorks</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item active">
            <BarChart3 size={20} /> Dashboard
          </div>
          <div className="nav-item">
            <Train size={20} /> Locomotives
          </div>
          <div className="nav-item">
            <Users size={20} /> Staff
          </div>
          <div className="nav-item">
            <FileText size={20} /> Reports
          </div>
        </nav>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={20} /> Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-user">
            <h2>Welcome back, {userName}</h2>
            <p>Workplace Overview & Quick Actions</p>
          </div>
          <div className="header-date">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
        </header>

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
      </main>
    </div>
  );
};

export default DashboardPage;
