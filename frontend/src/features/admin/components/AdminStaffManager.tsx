import React, { useEffect, useState, useCallback } from "react";
import { UserPlus, Shield, CheckCircle, AlertCircle } from "lucide-react";
import api from "../../../shared/services/api";

interface AdminRecord {
  ticket_number: number;
  name: string;
  email?: string;
  is_default: boolean;
  must_change_password: boolean;
  created_at: string;
}

const AdminStaffManager: React.FC = () => {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAdminTicket, setNewAdminTicket] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/admins");
      setAdmins(res.data);
    } catch (err) {
      console.error("Failed to fetch admin accounts", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAdmins();
  }, [fetchAdmins]);

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminTicket) return;

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await api.post("/admin/add-admin", {
        ticket_number: parseInt(newAdminTicket, 10),
      });
      setMessage(res.data.message);
      setNewAdminTicket("");
      fetchAdmins();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      setError(axiosError.response?.data?.detail || "Failed to grant administrator privileges.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="view-content-card">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2>Administrator Personnel Management</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Only existing Administrators have privilege to promote staff to Administrator access roles.
        </p>
      </div>

      {message && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderRadius: "6px", fontSize: "0.85rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle size={16} /> {message}
        </div>
      )}

      {error && (
        <div className="admin-error-banner" style={{ marginBottom: "1rem" }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Promote Form */}
      <div style={{ background: "var(--bg-secondary)", padding: "1.25rem", borderRadius: "8px", marginBottom: "2rem", border: "1px solid var(--border-color)" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <UserPlus size={18} color="var(--primary-color)" /> Grant Admin Privileges
        </h3>
        <form onSubmit={handleGrantAdmin} style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "220px" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>Employee Ticket Number</label>
            <input
              type="number"
              placeholder="e.g. 1001"
              value={newAdminTicket}
              onChange={(e) => setNewAdminTicket(e.target.value)}
              style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{ padding: "0.65rem 1.25rem", background: "var(--primary-color)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Shield size={16} /> {submitting ? "Promoting..." : "Add Admin Privilege"}
          </button>
        </form>
      </div>

      {/* Admin List */}
      <h3>Active System Administrators ({admins.length})</h3>
      <div className="table-responsive" style={{ marginTop: "1rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticket #</th>
              <th>Admin Name</th>
              <th>Email Address</th>
              <th>Account Type</th>
              <th>Password Status</th>
              <th>Granted On</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>Loading administrators...</td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.ticket_number}>
                  <td><strong>#{admin.ticket_number}</strong></td>
                  <td>{admin.name}</td>
                  <td>{admin.email || "N/A"}</td>
                  <td>
                    {admin.is_default ? (
                      <span className="admin-badge badge-pending">Default System Admin</span>
                    ) : (
                      <span className="admin-badge badge-approved">Promoted Admin</span>
                    )}
                  </td>
                  <td>
                    {admin.must_change_password ? (
                      <span style={{ color: "#f59e0b", fontSize: "0.8rem", fontWeight: 600 }}>Must Change Password</span>
                    ) : (
                      <span style={{ color: "#10b981", fontSize: "0.8rem", fontWeight: 600 }}>Active & Verified</span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {new Date(admin.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminStaffManager;
