/**
 * ==============================================================================
 * ADMIN SET EMPLOYEE PORTAL PASSWORD MODAL
 * One-time setup for admins whose employee record was auto-created during
 * admin setup. Sets a separate employee password to enable Employee portal access.
 * ==============================================================================
 */

import React, { useState } from "react";
import { ShieldCheck, AlertCircle, CheckCircle2, X, Info } from "lucide-react";
import api from "../../shared/services/api";

interface AdminSetEmployeePasswordModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const AdminSetEmployeePasswordModal: React.FC<AdminSetEmployeePasswordModalProps> = ({
  onSuccess,
  onClose,
}) => {
  const [adminPassword, setAdminPassword] = useState("");
  const [newEmployeePassword, setNewEmployeePassword] = useState("");
  const [confirmEmployeePassword, setConfirmEmployeePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newEmployeePassword.length < 8) {
      setError("Employee password must be at least 8 characters long.");
      return;
    }
    if (newEmployeePassword !== confirmEmployeePassword) {
      setError("Employee passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/admin/set-employee-password", {
        admin_password: adminPassword,
        new_employee_password: newEmployeePassword,
        confirm_employee_password: confirmEmployeePassword,
      });
      onSuccess();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      setError(axiosError.response?.data?.detail || "Failed to set employee portal password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: "480px" }}>
        <div
          className="modal-header"
          style={{
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--primary-color)",
              fontSize: "1.15rem",
            }}
          >
            <ShieldCheck size={20} /> Enable Employee Portal Access
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "0.25rem",
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "1.25rem 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "0.75rem",
              marginBottom: "1.25rem",
              fontSize: "0.83rem",
              color: "var(--text-muted)",
            }}
          >
            <Info size={15} style={{ marginTop: "1px", flexShrink: 0 }} color="var(--primary-color)" />
            <span>
              This is a <strong>one-time setup</strong>. Once set, you can log into the{" "}
              <strong>Employees Login Portal</strong> using your ticket number and this password.
              Your Admin portal password remains unchanged and independent.
            </span>
          </div>

          {error && (
            <div className="admin-error-banner" style={{ marginBottom: "1rem" }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-group">
              <label>Current Admin Password (Identity Confirmation)</label>
              <input
                type="password"
                placeholder="Enter your admin portal password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>New Employee Portal Password</label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={newEmployeePassword}
                onChange={(e) => setNewEmployeePassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Employee Portal Password</label>
              <input
                type="password"
                placeholder="Re-enter employee portal password"
                value={confirmEmployeePassword}
                onChange={(e) => setConfirmEmployeePassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                type="button"
                className="pagination-btn"
                onClick={onClose}
                disabled={loading}
                style={{ flex: 1, padding: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-submit-btn"
                disabled={loading}
                style={{ flex: 2 }}
              >
                <CheckCircle2 size={18} />
                {loading ? "Setting Password..." : "Enable Employee Portal Access"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminSetEmployeePasswordModal;
