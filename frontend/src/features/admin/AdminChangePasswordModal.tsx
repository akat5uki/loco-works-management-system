import React, { useState } from "react";
import { KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import api from "../../shared/services/api";

interface AdminChangePasswordModalProps {
  onSuccess: () => void;
}

const AdminChangePasswordModal: React.FC<AdminChangePasswordModalProps> = ({ onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post("/admin/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      onSuccess();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      setError(axiosError.response?.data?.detail || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: "450px" }}>
        <div className="modal-header" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary-color)" }}>
            <KeyRound size={22} /> Mandatory Password Change
          </h2>
        </div>

        <div className="modal-body" style={{ padding: "1.25rem 0" }}>
          <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
            As a security requirement for default administrator accounts, you must update your password before accessing the dashboard.
          </p>

          {error && (
            <div className="admin-error-banner" style={{ marginBottom: "1rem" }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="admin-submit-btn" disabled={loading} style={{ marginTop: "1rem" }}>
              <CheckCircle2 size={18} /> {loading ? "Updating..." : "Update Password & Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminChangePasswordModal;
