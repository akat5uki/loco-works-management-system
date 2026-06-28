import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldAlert, KeyRound, ArrowLeft, Lock } from "lucide-react";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import AdminChangePasswordModal from "./AdminChangePasswordModal";
import "./AdminDashboard.css";

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldSkip = (location.state as { skipRedirect?: boolean } | null)?.skipRedirect;

  const [ticketNumber, setTicketNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(() => !shouldSkip);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Auto-redirect if already authenticated as Admin
  useEffect(() => {
    if (shouldSkip) {
      return;
    }
    let cancelled = false;

    api
      .get("/admin/me")
      .then((res) => {
        if (!cancelled) {
          if (res.data?.session_type === "admin") {
            navigate("/admin/dashboard", { replace: true });
          } else {
            setCheckingSession(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, shouldSkip]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketNumber || !password) {
      setError("Please enter ticket number and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/admin/login", {
        ticket_number: parseInt(ticketNumber, 10),
        password: password,
      });

      if (res.data.must_change_password) {
        setShowPasswordModal(true);
      } else {
        navigate("/admin/dashboard");
      }
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      setError(axiosError.response?.data?.detail || "Invalid admin credentials or access denied.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return null; // Avoid UI flash while checking session
  }

  return (
    <div className="admin-auth-workspace">
      <header className="admin-auth-header">
        <div className="admin-header-brand">
          <div className="admin-header-logo">
            <img src="/favicon.svg" alt="LWMS Logo" style={{ width: "28px", height: "28px" }} />
            <span>LWMS Admin</span>
          </div>
          <button className="admin-back-btn" onClick={() => navigate("/login", { state: { skipRedirect: true } })}>
            <ArrowLeft size={16} /> Employees Login Portal
          </button>
        </div>
        <ThemeToggle />
      </header>

      <main className="admin-login-container">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <div className="admin-icon-badge">
              <ShieldAlert size={36} color="var(--primary-color)" />
            </div>
            <h1>Administrative Portal</h1>
            <p>Secure authentication for system administrators and supervisors.</p>
          </div>

          {error && (
            <div className="admin-error-banner">
              <Lock size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="admin-form">
            <div className="form-group">
              <label htmlFor="ticketNumber">Admin Ticket Number</label>
              <input
                id="ticketNumber"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 9999"
                value={ticketNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) setTicketNumber(val);
                }}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Administrator Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="admin-submit-btn" disabled={loading}>
              <KeyRound size={18} /> {loading ? "Authenticating..." : "Admin Sign In"}
            </button>
          </form>
        </div>
      </main>

      {showPasswordModal && (
        <AdminChangePasswordModal
          onSuccess={() => {
            setShowPasswordModal(false);
            navigate("/admin/dashboard");
          }}
          onCancel={() => {
            setShowPasswordModal(false);
          }}
        />
      )}
    </div>
  );
};

export default AdminLoginPage;
