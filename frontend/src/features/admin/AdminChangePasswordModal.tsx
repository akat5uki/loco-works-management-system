/**
 * ==============================================================================
 * ADMIN INITIAL SETUP & ACCOUNT MIGRATION MODAL
 * Prompts the administrator during first-time default login to migrate off
 * the default admin account, create their personal admin account, and delete default admin.
 * Handles scenarios where the employee profile already exists or needs creation.
 * ==============================================================================
 */

import React, { useState } from "react";
import { ShieldCheck, AlertCircle, CheckCircle2, UserCheck, X } from "lucide-react";
import api from "../../shared/services/api";

interface AdminChangePasswordModalProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

const AdminChangePasswordModal: React.FC<AdminChangePasswordModalProps> = ({ onSuccess, onCancel }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newTicketNumber, setNewTicketNumber] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore logout errors on cancel
    }
    if (onCancel) onCancel();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d+$/.test(newTicketNumber)) {
      setError("Ticket number must contain only numeric digits.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!newTicketNumber) {
      setError("Please enter your personal employee ticket number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post("/admin/change-password", {
        current_password: currentPassword,
        new_ticket_number: parseInt(newTicketNumber, 10),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        new_password: newPassword,
      });
      onSuccess();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      setError(axiosError.response?.data?.detail || "Failed to complete administrator setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: "500px" }}>
        <div className="modal-header" style={{ borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary-color)", fontSize: "1.25rem" }}>
            <ShieldCheck size={22} /> Administrator Account Setup
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.25rem" }}
            title="Cancel and Logout"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "1.25rem 0" }}>
          <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
            Assign administrative privileges to your employee ticket number. If your employee record is not yet in the system, it will be automatically created. The default admin account will be permanently removed.
          </p>

          {error && (
            <div className="admin-error-banner" style={{ marginBottom: "1rem" }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-group">
              <label>Default Admin Password</label>
              <input
                type="password"
                placeholder="Current default password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Your Personal Employee Ticket #</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 1001"
                value={newTicketNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) setNewTicketNumber(val);
                }}
                required
              />
            </div>

            <div style={{ background: "var(--bg-secondary)", padding: "0.85rem", borderRadius: "8px", marginBottom: "1.25rem", border: "1px dashed var(--border-color)" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-h)", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem" }}>
                <UserCheck size={15} color="var(--primary-color)" /> Optional Profile Information (For New Employees)
              </span>
              <div className="form-group" style={{ marginBottom: "0.6rem" }}>
                <input
                  type="text"
                  placeholder="Full Name (e.g. John Doe)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ fontSize: "0.85rem", padding: "0.55rem" }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input
                  type="email"
                  placeholder="Email Address (e.g. john.doe@locoworks.com)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ fontSize: "0.85rem", padding: "0.55rem" }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>New Admin Dedicated Password</label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm New Admin Password</label>
              <input
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                type="button"
                className="pagination-btn"
                onClick={handleCancel}
                disabled={loading}
                style={{ flex: 1, padding: "0.85rem" }}
              >
                Cancel & Logout
              </button>
              <button
                type="submit"
                className="admin-submit-btn"
                disabled={loading}
                style={{ flex: 2 }}
              >
                <CheckCircle2 size={18} /> {loading ? "Creating & Migrating..." : "Complete Setup & Delete Default Admin"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminChangePasswordModal;
