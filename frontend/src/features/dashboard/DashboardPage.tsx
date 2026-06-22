import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useCallback } from "react";
import {
  Train,
  Users,
  Settings,
  FileText,
  LogOut,
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "profile" | "chat" | "my_booking">("dashboard");
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
            title: "Booking Preview & Export",
            icon: <FileText size={32} />,
            color: "#06b6d4",
            description: "Preview shift details and export to PDF/Excel",
            path: "/bookings/preview",
          },
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
        ) : activeTab === "chat" ? (
          <ChatPage
            isSupervisor={isSupervisor}
            currentTicket={userProfile?.ticket_number ?? 0}
          />
        ) : activeTab === "my_booking" ? (
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
                    assignments.map((asg: any) => (
                      asg.locos.map((l: any) => (
                        <div key={l.loco_number} style={{ border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem", background: "var(--bg-secondary)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                            <div 
                              style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1.1rem", color: "var(--accent)", cursor: "pointer" }}
                              onClick={() => navigate("/bookings/employees", { state: { selectLoco: l.loco_number } })}
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
