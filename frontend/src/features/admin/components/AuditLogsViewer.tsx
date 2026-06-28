import React, { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Filter, Eye, Lock } from "lucide-react";
import api from "../../../shared/services/api";

interface AuditLog {
  id: number;
  table_name: string;
  operation: string;
  record_pk: string;
  old_data: unknown;
  new_data: unknown;
  changed_by: number;
  changed_at: string;
}

const AuditLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableFilter, setTableFilter] = useState("ALL");
  const [operationFilter, setOperationFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/audit-logs", {
        params: { table_name: tableFilter, operation: operationFilter, limit: 150 },
      });
      setLogs(res.data);
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    } finally {
      setLoading(false);
    }
  }, [tableFilter, operationFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  return (
    <div className="view-content-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldCheck size={22} color="#10b981" /> System Audit Logs (Read-Only)
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Immutable PostgreSQL audit trails. Audit records cannot be modified or deleted.
          </p>
        </div>

        <div style={{ padding: "0.4rem 0.8rem", background: "rgba(100, 116, 139, 0.1)", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Lock size={14} /> Strict Read-Only Access
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Filter size={16} color="var(--text-muted)" />
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Table:</label>
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            style={{ padding: "0.5rem 0.8rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          >
            <option value="ALL">All Tables</option>
            <option value="employees">Employees</option>
            <option value="loco">Locomotives</option>
            <option value="jobs">Jobs</option>
            <option value="loco_bookings">Loco Bookings</option>
            <option value="loco_admin">Loco Admin</option>
            <option value="registration_requests">Registration Requests</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Operation:</label>
          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
            style={{ padding: "0.5rem 0.8rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          >
            <option value="ALL">All Operations</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Timestamp</th>
              <th>Table</th>
              <th>Operation</th>
              <th>Record Primary Key</th>
              <th>Changed By</th>
              <th>Data Payload</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>Loading audit logs...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>No audit log entries recorded.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>#{log.id}</td>
                  <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                    {log.changed_at ? new Date(log.changed_at).toLocaleString() : "N/A"}
                  </td>
                  <td><code style={{ background: "var(--bg-secondary)", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>{log.table_name}</code></td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      background: log.operation === "INSERT" ? "rgba(16, 185, 129, 0.15)" : log.operation === "UPDATE" ? "rgba(245, 158, 11, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: log.operation === "INSERT" ? "#10b981" : log.operation === "UPDATE" ? "#f59e0b" : "#ef4444"
                    }}>
                      {log.operation}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.82rem", fontFamily: "monospace" }}>{log.record_pk}</td>
                  <td>Ticket #{log.changed_by}</td>
                  <td>
                    <button
                      className="config-btn"
                      onClick={() => setSelectedLog(log)}
                      style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      <Eye size={14} /> Inspect JSON
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Audit Log Inspection Modal */}
      {selectedLog && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: "650px" }}>
            <div className="modal-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
              <h2>Audit Log Payload Inspection #{selectedLog.id}</h2>
              <button className="icon-btn" onClick={() => setSelectedLog(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: "1.25rem 0" }}>
              <div style={{ marginBottom: "1rem" }}>
                <p><strong>Table:</strong> {selectedLog.table_name} | <strong>Operation:</strong> {selectedLog.operation} | <strong>Record:</strong> {selectedLog.record_pk}</p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Changed by Staff Ticket #{selectedLog.changed_by} on {new Date(selectedLog.changed_at).toLocaleString()}</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <h4 style={{ marginBottom: "0.5rem", color: "#ef4444" }}>Previous State (Old Data)</h4>
                  <pre style={{ background: "var(--bg-secondary)", padding: "0.75rem", borderRadius: "6px", fontSize: "0.75rem", overflowX: "auto", maxHeight: "250px" }}>
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 style={{ marginBottom: "0.5rem", color: "#10b981" }}>New State (New Data)</h4>
                  <pre style={{ background: "var(--bg-secondary)", padding: "0.75rem", borderRadius: "6px", fontSize: "0.75rem", overflowX: "auto", maxHeight: "250px" }}>
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsViewer;
