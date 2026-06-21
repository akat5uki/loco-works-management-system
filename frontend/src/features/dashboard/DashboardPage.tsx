import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useCallback } from "react";
import {
  Train,
  Users,
  Settings,
  FileText,
  LogOut,
  PlusCircle,
  ClipboardList,
  BarChart3,
  MessageSquare,
  Bell
} from "lucide-react";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import ChatPage from "../chat/ChatPage";
import "./Dashboard.css";

interface UserProfile {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string | null;
  category_name: string | null;
  is_supervisor: boolean;
}

interface EmployeeNotification {
  notification_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

const todayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const guessShift = () => {
  const hour = new Date().getHours();
  return hour >= 8 && hour < 20 ? 1 : 2;
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Employee");
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "profile" | "chat">("dashboard");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Real-time assignment and notifications
  const [assignments, setAssignments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchAssignmentsAndNotifs = useCallback(async (profile: UserProfile) => {
    try {
      const notifRes = await api.get("/bookings/employees/notifications");
      setNotifications(notifRes.data);

      const dateStr = todayISO();
      const shift = guessShift();
      const viewsRes = await api.get(`/bookings/employees/views?date_str=${dateStr}&shift=${shift}`);
      const data = viewsRes.data;

      if (profile.designation_id === 1 || profile.designation_id === 2) {
        const myAssignments = data.by_supervisor.filter(
          (s: any) => s.supervisor_ticket_number === profile.ticket_number
        );
        setAssignments(myAssignments);
      } else {
        const myAssignments = data.by_staff.filter(
          (st: any) => st.staff_ticket_number === profile.ticket_number
        );
        setAssignments(myAssignments);
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get("/auth/me");
        setUserName(response.data.name);
        setIsSupervisor(response.data.is_supervisor);
        setUserProfile(response.data);
        fetchAssignmentsAndNotifs(response.data);
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    };
    fetchUser();
  }, [fetchAssignmentsAndNotifs]);

  // Real-time WS connection on Dashboard
  useEffect(() => {
    if (!userProfile) return;
    const wsUrl = `wss://${window.location.host}/api/v1/realtime/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "employee_notification") {
          const payload = data.payload ? JSON.parse(data.payload) : data;
          if (payload.ticket_number === userProfile.ticket_number) {
            setNotifications(prev => [
              {
                notification_id: Date.now(),
                message: payload.message,
                is_read: false,
                created_at: new Date().toISOString()
              } as any,
              ...prev
            ]);
            
            // Re-fetch assignments dynamically
            fetchAssignmentsAndNotifs(userProfile);
          }
        }
      } catch (err) {
        console.error("WS error in dashboard", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [userProfile, fetchAssignmentsAndNotifs]);

  const handleMarkAsRead = async (notifId: number) => {
    try {
      await api.post(`/bookings/employees/notifications/${notifId}/read`);
      setNotifications(prev => prev.map(n => n.notification_id === notifId ? { ...n, is_read: true } : n));
    } catch (err) {}
  };

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
            title: "Employees Booking",
            icon: <Users size={32} />,
            color: "#10b981",
            description: "Manage employee availability & bookings",
            path: "/bookings/employees",
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
          <div
            className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
            style={{ cursor: "pointer" }}
          >
            <MessageSquare size={20} /> <span>Chat</span>
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
            
            {/* Notification Bell */}
            <div className="notification-bell-container" onClick={() => setShowNotifications(!showNotifications)} style={{ position: "relative", cursor: "pointer" }}>
              <Bell size={20} />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <div className="notification-badge" style={{
                  position: "absolute", top: "-2px", right: "-2px",
                  background: "#ef4444", color: "white", fontSize: "0.65rem",
                  fontWeight: 700, borderRadius: "50%", width: "15px", height: "15px",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {notifications.filter(n => !n.is_read).length}
                </div>
              )}
              {showNotifications && (
                <div className="notifications-popup" onClick={e => e.stopPropagation()} style={{
                  position: "absolute", top: "45px", right: 0, width: "300px",
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                  padding: "1rem", zIndex: 100
                }}>
                  <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.35rem" }}>Notifications</h3>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0.5rem 0" }}>No new notifications.</p>
                  ) : (
                    <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                      {notifications.map(n => (
                        <div
                          key={n.notification_id}
                          className="notif-item"
                          style={{
                            padding: "0.45rem 0", borderBottom: "1px solid var(--border)",
                            fontSize: "0.8rem", cursor: "pointer",
                            fontWeight: !n.is_read ? 600 : 400
                          }}
                          onClick={() => handleMarkAsRead(n.notification_id)}
                        >
                          <div>{n.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

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
          <>
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

            {/* Current Assignments Section */}
            <section style={{ marginTop: "2rem" }}>
              <div className="tile-card" style={{ display: "block", cursor: "default", "--tile-color": "var(--accent)" } as React.CSSProperties}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
                  Your Current Assignments (This Shift)
                </h3>
                {assignments.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.9rem", margin: 0 }}>
                    No locomotive assignments for the current shift.
                  </p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                    {(userProfile?.designation_id === 1 || userProfile?.designation_id === 2) ? (
                      // Supervisor assignments view
                      assignments.map((asg: any) => (
                        asg.locos.map((l: any) => (
                          <div key={l.loco_number} style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem", background: "var(--bg)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1.1rem", color: "var(--accent)", marginBottom: "0.5rem" }}>
                              <Train size={18} /> Loco #{l.loco_number}
                            </div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.25rem" }}>Assigned Staff:</div>
                            {l.staff.length === 0 ? (
                              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>No staff assigned yet.</p>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
                                {l.staff.map((st: any) => (
                                  <li key={st.staff_ticket_number}>{st.staff_name} (Ticket #{st.staff_ticket_number})</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))
                      ))
                    ) : (
                      // Staff assignments view
                      assignments.map((asg: any) => (
                        asg.assignments.map((asgn: any, idx: number) => (
                          <div key={idx} style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem", background: "var(--bg)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1.1rem", color: "var(--accent)", marginBottom: "0.5rem" }}>
                              <Train size={18} /> Loco #{asgn.loco_number}
                            </div>
                            <div style={{ fontSize: "0.85rem" }}>
                              <strong>Supervisor:</strong> {asgn.supervisor_name} (Ticket #{asgn.supervisor_ticket_number})
                            </div>
                          </div>
                        ))
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : activeTab === "chat" ? (
          <ChatPage
            isSupervisor={isSupervisor}
            currentTicket={userProfile?.ticket_number ?? 0}
          />
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
