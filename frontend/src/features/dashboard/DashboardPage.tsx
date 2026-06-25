import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import api from "../../shared/services/api";
import ChatPage from "../chat/ChatPage";
import DashboardSidebar from "./components/DashboardSidebar";
import DashboardHeader from "./components/DashboardHeader";
import DashboardTiles from "./components/DashboardTiles";
import UserProfileTab from "./components/UserProfileTab";
import AssignmentsTab from "./components/AssignmentsTab";
import "./Dashboard.css";

interface UserProfile {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string | null;
  category_name: string | null;
  is_supervisor: boolean;
  email: string | null;
}

interface EmployeeNotification {
  notification_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}
interface SupervisorAssignment {
  supervisor_ticket_number: number;
  supervisor_name: string;
  supervisor_designation: string;
  locos: Array<{
    loco_number: string;
    is_forwarded: boolean;
    staff: Array<{ staff_ticket_number: number; staff_name: string; staff_designation: string }>;
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
  }>;
}

type AssignmentItem = SupervisorAssignment | StaffAssignment;

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
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);

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
          (s: SupervisorAssignment) => s.supervisor_ticket_number === profile.ticket_number
        );
        setAssignments(myAssignments);
      } else {
        const myAssignments = data.by_staff.filter(
          (st: StaffAssignment) => st.staff_ticket_number === profile.ticket_number
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
              },
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
    } catch {
      // ignore mark as read failure
    }
  };



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
      <DashboardSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="dashboard-main">
        <DashboardHeader
          userName={userName}
          notifications={notifications}
          handleMarkAsRead={handleMarkAsRead}
        />

        {activeTab === "dashboard" ? (
          <DashboardTiles isSupervisor={isSupervisor} />
        ) : activeTab === "chat" ? (
          <ChatPage
            isSupervisor={isSupervisor}
            currentTicket={userProfile?.ticket_number ?? 0}
          />
        ) : activeTab === "my_booking" ? (
          userProfile && (
            <AssignmentsTab
              userProfile={userProfile}
              assignments={assignments}
            />
          )
        ) : (
          userProfile && <UserProfileTab userProfile={userProfile} />
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
