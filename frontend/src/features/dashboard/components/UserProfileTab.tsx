import React, { useState } from "react";
import {
  User,
  ShieldCheck,
  KeyRound,
  Mail,
  BadgeCheck,
  Lock,
  CheckCircle2,
  Briefcase,
  Layers,
  ShieldAlert,
} from "lucide-react";
import api from "../../../shared/services/api";

interface UserProfile {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string | null;
  category_name: string | null;
  is_supervisor: boolean;
  is_admin?: boolean;
  employee_portal_enabled?: boolean | null;
  email: string | null;
}

interface UserProfileTabProps {
  userProfile: UserProfile;
}

const UserProfileTab: React.FC<UserProfileTabProps> = ({ userProfile }) => {
  // Password update form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (newPassword.length < 8) {
      setPwdError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError("New password and confirmation password do not match.");
      return;
    }

    setPwdLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwdSuccess("Employee password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      setPwdError(axiosError.response?.data?.detail || "Failed to update employee password.");
    } finally {
      setPwdLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "E";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.75rem",
        padding: "0.5rem 0.75rem 1.5rem 0.75rem",
        flex: 1,
        overflowY: "auto",
      }}
    >
      {/* Profile Hero Header Banner */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "1.75rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1.5rem",
          boxShadow: "var(--shadow)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "1.5rem",
              boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
            }}
          >
            {getInitials(userProfile.name)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, color: "var(--text-h)" }}>
                {userProfile.name || "Employee"}
              </h2>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.2rem 0.6rem",
                  borderRadius: "9999px",
                  backgroundColor: userProfile.is_supervisor ? "rgba(14, 165, 233, 0.12)" : "rgba(99, 102, 241, 0.12)",
                  color: userProfile.is_supervisor ? "#0284c7" : "#6366f1",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <ShieldCheck size={13} /> Ticket #{userProfile.ticket_number}
              </span>
            </div>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
              {userProfile.designation_name || "Employee"} • {userProfile.category_name || (userProfile.is_supervisor ? "Supervisor" : "Staff")}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              padding: "0.4rem 0.85rem",
              borderRadius: "6px",
              backgroundColor: "rgba(34, 197, 94, 0.12)",
              color: "#16a34a",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <BadgeCheck size={15} /> Verified Employee Active
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem" }}>
        {/* Employee Information Card */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "1.5rem",
            boxShadow: "var(--shadow)",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              margin: 0,
              color: "var(--text-h)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <User size={18} color="#0284c7" /> Employee Profile Credentials
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block" }}>
                Ticket / Employee ID
              </label>
              <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text)", marginTop: "0.2rem" }}>
                #{userProfile.ticket_number}
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block" }}>
                Full Name
              </label>
              <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text)", marginTop: "0.2rem" }}>
                {userProfile.name}
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block" }}>
                Registered Email Address
              </label>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: "500",
                  color: "var(--text)",
                  marginTop: "0.2rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Mail size={15} color="var(--text-muted)" /> {userProfile.email || "Not Specified"}
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block" }}>
                Official Designation
              </label>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  color: "var(--text)",
                  marginTop: "0.2rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Briefcase size={15} color="var(--text-muted)" /> {userProfile.designation_name || "Staff Personnel"}
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block" }}>
                Role Category & Authorization Scope
              </label>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  color: "var(--text)",
                  marginTop: "0.2rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Layers size={15} color="var(--text-muted)" /> {userProfile.category_name || (userProfile.is_supervisor ? "Supervisor" : "Staff")}
              </div>
            </div>
          </div>
        </div>

        {/* Password Security Update Card */}
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "1.5rem",
            boxShadow: "var(--shadow)",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              margin: 0,
              color: "var(--text-h)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <KeyRound size={18} color="#0284c7" /> Employee Security & Password
          </h3>

          {pwdError && (
            <div
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: "6px",
                background: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Lock size={15} /> {pwdError}
            </div>
          )}

          {pwdSuccess && (
            <div
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: "6px",
                background: "rgba(34, 197, 94, 0.12)",
                color: "#16a34a",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <CheckCircle2 size={15} /> {pwdSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="form-group">
              <label htmlFor="currentEmployeePassword" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                Current Password
              </label>
              <input
                id="currentEmployeePassword"
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem 0.75rem" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="newEmployeePassword" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                New Password
              </label>
              <input
                id="newEmployeePassword"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem 0.75rem" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmEmployeePassword" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                Confirm New Password
              </label>
              <input
                id="confirmEmployeePassword"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem 0.75rem" }}
              />
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              style={{
                marginTop: "0.5rem",
                padding: "0.6rem 1.25rem",
                borderRadius: "6px",
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: pwdLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
              }}
            >
              <KeyRound size={16} /> {pwdLoading ? "Updating..." : "Update Employee Password"}
            </button>
          </form>
        </div>
      </div>

      {/* Security & System Architecture Controls */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "1.5rem",
          boxShadow: "var(--shadow)",
        }}
      >
        <h3
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            margin: "0 0 1rem 0",
            color: "var(--text-h)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <ShieldAlert size={18} color="#0284c7" /> Portal Security Controls & Session Protection
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
          }}
        >
          <div
            style={{
              padding: "1rem",
              borderRadius: "8px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Session Isolation</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0284c7", marginTop: "0.25rem" }}>
              Dual Session Protection Active
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Dedicated cookie namespace (`session_id_*`) for employee operations.
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              borderRadius: "8px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Realtime Sync</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#16a34a", marginTop: "0.25rem" }}>
              WebSocket Listener Active
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Live notification channel connected to Redis broadcast stream.
            </div>
          </div>

          <div
            style={{
              padding: "1rem",
              borderRadius: "8px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Shift & Booking Scope</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ea580c", marginTop: "0.25rem" }}>
              Loco Work Management
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Role-specific booking matrix & assignment views enabled.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileTab;
