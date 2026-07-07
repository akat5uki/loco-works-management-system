import React, { useState, useEffect } from "react";
import {
  User,
  ShieldCheck,
  KeyRound,
  Mail,
  BadgeCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Hash,
} from "lucide-react";
import api from "../../../shared/services/api";

interface AdminProfileData {
  ticket_number: number;
  name: string;
  email: string;
  designation_name: string;
  category_name: string;
  is_admin: boolean;
  is_default: boolean;
  must_change_password: boolean;
  employee_portal_enabled: boolean;
  session_type: string;
}

interface AdminProfileViewProps {
  onEnablePortalClick?: () => void;
}

const AdminProfileView: React.FC<AdminProfileViewProps> = ({ onEnablePortalClick }) => {
  const [profile, setProfile] = useState<AdminProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Password update form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/admin/me")
      .then((res) => {
        if (!cancelled) setProfile(res.data);
      })
      .catch((err) => {
        console.error("Failed to load admin profile", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      await api.post("/admin/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwdSuccess("Administrator password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      setPwdError(axiosError.response?.data?.detail || "Failed to update administrator password.");
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
        Loading administrator profile data...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Profile Header Banner */}
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
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
            }}
          >
            <User size={38} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, color: "var(--text-h)" }}>
                {profile?.name || "System Administrator"}
              </h2>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.2rem 0.6rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(99, 102, 241, 0.12)",
                  color: "#6366f1",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <ShieldCheck size={13} /> Admin #{profile?.ticket_number}
              </span>
            </div>
            <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.9rem", color: "var(--text-muted)" }}>
              {profile?.designation_name || "Administrator"} • {profile?.category_name || "Executive Management"}
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
            <BadgeCheck size={15} /> Active Session Verified
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem" }}>
        {/* Personal & Credential Details */}
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
            <User size={18} color="#6366f1" /> Profile Credentials & Information
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(99, 102, 241, 0.1)",
                    color: "#6366f1",
                    flexShrink: 0,
                  }}
                >
                  <Hash size={18} />
                </div>
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Admin Ticket Number
                  </span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-h)" }}>
                    #{profile?.ticket_number}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.1)",
                    color: "#10b981",
                    flexShrink: 0,
                  }}
                >
                  <User size={18} />
                </div>
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Full Name
                  </span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-h)" }}>
                    {profile?.name}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(245, 158, 11, 0.1)",
                    color: "#f59e0b",
                    flexShrink: 0,
                  }}
                >
                  <Mail size={18} />
                </div>
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Registered Email Address
                  </span>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-h)" }}>
                    {profile?.email}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(139, 92, 246, 0.1)",
                    color: "#8b5cf6",
                    flexShrink: 0,
                  }}
                >
                  <KeyRound size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Employee Portal Status
                  </span>
                  <div style={{ marginTop: "0.2rem", display: "flex", alignItems: "center" }}>
                    {profile?.employee_portal_enabled ? (
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          color: "#16a34a",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        <CheckCircle2 size={15} /> Enabled (Separate Employee Password Set)
                      </span>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            padding: "0.25rem 0.6rem",
                            borderRadius: "4px",
                            background: "rgba(234, 88, 12, 0.12)",
                            color: "#ea580c",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                          }}
                        >
                          <AlertCircle size={14} /> Not Enabled
                        </span>
                        {onEnablePortalClick && (
                          <button
                            onClick={onEnablePortalClick}
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              padding: "0.25rem 0.65rem",
                              borderRadius: "4px",
                              border: "1px solid #6366f1",
                              background: "transparent",
                              color: "#6366f1",
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            Enable Now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
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
            <KeyRound size={18} color="#6366f1" /> Administrator Security & Password
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
              <label htmlFor="currentPassword" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                Current Administrator Password
              </label>
              <input
                id="currentPassword"
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem 0.75rem" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ width: "100%", marginTop: "0.25rem", padding: "0.5rem 0.75rem" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
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
                background: "#6366f1",
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
              <KeyRound size={16} /> {pwdLoading ? "Updating..." : "Update Admin Password"}
            </button>
          </form>
        </div>
      </div>

      {/* Security Architecture Summary */}
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
          <ShieldAlert size={18} color="#6366f1" /> Active System Security Controls
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
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#6366f1", marginTop: "0.25rem" }}>
              Per-Table Nonce Shield
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Separate cryptographic cookies for Admin & Employee portals.
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
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Session Expiration</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#16a34a", marginTop: "0.25rem" }}>
              Sliding Expiration Active
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Automated 30-minute sliding window stored in Redis.
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
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Audit Logging</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#ea580c", marginTop: "0.25rem" }}>
              PostgreSQL Triggers Enabled
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Immutable audit tracking on all administrative writes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfileView;
