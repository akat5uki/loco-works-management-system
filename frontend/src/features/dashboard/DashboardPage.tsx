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
import ThemeToggle from "../../shared/components/ThemeToggle";
import "./Dashboard.css";

interface UserProfile {
  ticket_number: number;
  name: string;
  designation_name: string | null;
  category_name: string | null;
  is_supervisor: boolean;
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Employee");
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "profile">("dashboard");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get("/auth/me");
        setUserName(response.data.name);
        setIsSupervisor(response.data.is_supervisor);
        setUserProfile(response.data);
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    };
    fetchUser();
  }, []);

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
        ]
      : []),
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

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Failed to log out on server", error);
    } finally {
      navigate("/login", { replace: true });
    }
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
          <div
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
            style={{ cursor: "pointer" }}
          >
            <BarChart3 size={20} /> <span>Dashboard</span>
          </div>
          <div
            className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
            style={{ cursor: "pointer" }}
          >
            <Users size={20} /> <span>Profile</span>
          </div>
          <div className="nav-item" onClick={() => navigate("/stages")} style={{ cursor: "pointer" }}>
            <Train size={20} /> <span>Locomotives</span>
          </div>
          <div className="nav-item" onClick={() => navigate("/tasks")} style={{ cursor: "pointer" }}>
            <Users size={20} /> <span>Staff</span>
          </div>
          <div className="nav-item" onClick={() => navigate("/reports")} style={{ cursor: "pointer" }}>
            <FileText size={20} /> <span>Reports</span>
          </div>
        </nav>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={20} /> <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-user">
            <h2>Welcome back, {userName}</h2>
            <p>Workplace Overview & Quick Actions</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <ThemeToggle />
            <div className="header-date">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </header>

        {activeTab === "dashboard" ? (
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
        ) : (
          <section className="profile-container">
            {userProfile && (
              <div className="profile-card">
                <div className="profile-card-header">
                  <div className="profile-avatar">
                    {userProfile.name
                      ? userProfile.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                      : "E"}
                  </div>
                  <div className="profile-header-meta">
                    <h3>{userProfile.name}</h3>
                    <div className="profile-role-badge">
                      {userProfile.category_name || (userProfile.is_supervisor ? "Supervisor" : "Staff")}
                    </div>
                  </div>
                </div>
                <div className="profile-body">
                  <div className="profile-info-grid">
                    <div className="profile-info-item">
                      <span className="profile-info-label">Ticket / Employee ID</span>
                      <span className="profile-info-value">#{userProfile.ticket_number}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="profile-info-label">Designation</span>
                      <span className="profile-info-value">{userProfile.designation_name || "Not Specified"}</span>
                    </div>
                    <div className="profile-info-item">
                      <span className="profile-info-label">Role Category</span>
                      <span className="profile-info-value">{userProfile.category_name || "Employee"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
