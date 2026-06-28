/**
 * ==============================================================================
 * REGISTRATION REQUESTS MANAGER
 * Admin verification dashboard for employee 12-character registration verification codes.
 * Supports searching, filtering, status processing, validity extension, and pagination.
 * ==============================================================================
 */

import React, { useEffect, useState, useCallback } from "react";
import { Search, Filter, Check, X, Clock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../../shared/services/api";

interface RegistrationRequest {
  request_id: number;
  reg_code: string;
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name?: string;
  category_name?: string;
  email: string;
  status: string;
  remarks?: string;
  valid_until: string;
  created_at: string;
  is_expired: boolean;
}

const RegistrationRequestsManager: React.FC = () => {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedReq, setSelectedReq] = useState<RegistrationRequest | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [additionalDays, setAdditionalDays] = useState(7);
  const [message, setMessage] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  /**
   * Fetch registration verification requests from API
   */
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/registration-requests", {
        params: { search: search || undefined, status_filter: statusFilter },
      });
      setRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch registration requests", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
  }, [fetchRequests]);

  /**
   * Handle Admin Action (Approve, Reject, or Mark Pending)
   */
  const handleAction = async (action: "APPROVE" | "REJECT" | "PENDING") => {
    if (!selectedReq) return;
    if (action === "REJECT" && !actionRemarks.trim()) {
      alert("Please enter a reason/remarks for rejection.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post(`/admin/registration-requests/${selectedReq.reg_code}/action`, {
        action,
        remarks: actionRemarks,
      });
      setMessage(res.data.message);
      setSelectedReq(null);
      setActionRemarks("");
      fetchRequests();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      alert(axiosError.response?.data?.detail || "Failed to process action.");
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Extend validity window by requested additional days
   */
  const handleExtendValidity = async () => {
    if (!selectedReq) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/admin/registration-requests/${selectedReq.reg_code}/extend-validity`, {
        additional_days: additionalDays,
      });
      setMessage(res.data.message);
      setSelectedReq(null);
      fetchRequests();
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const axiosError = err as any;
      alert(axiosError.response?.data?.detail || "Failed to extend validity.");
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate pagination window
  const totalPages = Math.ceil(requests.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = requests.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="view-content-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Employee Registration Verification Requests</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Verify employee 12-character registration codes and take approval actions.
          </p>
        </div>

        {message && (
          <div style={{ padding: "0.5rem 1rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", borderRadius: "6px", fontSize: "0.85rem", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
            {message}
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search by 12-char code, ticket, name, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            style={{ width: "100%", paddingLeft: "2.2rem", padding: "0.6rem 0.6rem 0.6rem 2.2rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Verification</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>12-Char Reg Code</th>
              <th>Ticket #</th>
              <th>Employee Name</th>
              <th>Designation</th>
              <th>Status</th>
              <th>Validity Window</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>Loading registration requests...</td>
              </tr>
            ) : paginatedRequests.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>No registration requests found.</td>
              </tr>
            ) : (
              paginatedRequests.map((req) => (
                <tr key={req.request_id}>
                  <td>
                    <strong style={{ fontFamily: "monospace", letterSpacing: "1px", color: "var(--primary-color)", fontSize: "1rem" }}>
                      {req.reg_code}
                    </strong>
                  </td>
                  <td>#{req.ticket_number}</td>
                  <td>{req.name}</td>
                  <td>{req.designation_name || `ID ${req.designation_id}`}</td>
                  <td>
                    <span className={`admin-badge badge-${req.status.toLowerCase()}`}>
                      {req.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    <Calendar size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                    {new Date(req.valid_until).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      className="config-btn"
                      onClick={() => {
                        setSelectedReq(req);
                        setActionRemarks(req.remarks || "");
                      }}
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                    >
                      Review & Process
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="pagination-bar">
        <div className="pagination-info">
          Showing {requests.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, requests.length)} of {requests.length} requests
        </div>

        <div className="pagination-controls">
          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginRight: "0.5rem" }}>Per Page:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(parseInt(e.target.value, 10)); setCurrentPage(1); }}
            style={{ padding: "0.3rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>

          <button className="pagination-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}>
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="pagination-page-indicator">Page {currentPage} of {totalPages}</span>
          <button className="pagination-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Action Review Modal */}
      {selectedReq && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: "550px" }}>
            <div className="modal-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
              <h2>Review Registration Verification</h2>
              <button className="icon-btn" onClick={() => setSelectedReq(null)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ padding: "1.25rem 0" }}>
              <div style={{ background: "var(--bg-secondary)", padding: "1rem", borderRadius: "8px", marginBottom: "1.25rem", border: "1px solid var(--border-color)" }}>
                <p><strong>Verification Code:</strong> <span style={{ fontFamily: "monospace", fontSize: "1.1rem", color: "var(--primary-color)", fontWeight: 700 }}>{selectedReq.reg_code}</span></p>
                <p><strong>Employee:</strong> {selectedReq.name} (Ticket #{selectedReq.ticket_number})</p>
                <p><strong>Email:</strong> {selectedReq.email}</p>
                <p><strong>Designation:</strong> {selectedReq.designation_name || `ID ${selectedReq.designation_id}`} ({selectedReq.category_name})</p>
                <p><strong>Current Status:</strong> <span className={`admin-badge badge-${selectedReq.status.toLowerCase()}`}>{selectedReq.status}</span></p>
                <p><strong>Valid Until:</strong> {new Date(selectedReq.valid_until).toLocaleString()}</p>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                  Admin Remarks / Rejection Reason
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter remarks for pending status or reason for rejection..."
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => handleAction("APPROVE")}
                  disabled={actionLoading}
                  style={{ flex: 1, padding: "0.65rem", background: "#10b981", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                >
                  <Check size={16} /> Approve
                </button>

                <button
                  onClick={() => handleAction("PENDING")}
                  disabled={actionLoading}
                  style={{ flex: 1, padding: "0.65rem", background: "#f59e0b", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                >
                  <Clock size={16} /> Mark Pending
                </button>

                <button
                  onClick={() => handleAction("REJECT")}
                  disabled={actionLoading}
                  style={{ flex: 1, padding: "0.65rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}
                >
                  <X size={16} /> Reject
                </button>
              </div>

              <hr style={{ margin: "1.5rem 0", borderColor: "var(--border-color)" }} />

              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                  Extend Request Validity Window
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={additionalDays}
                    onChange={(e) => setAdditionalDays(parseInt(e.target.value, 10))}
                    style={{ width: "90px", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                  />
                  <button
                    onClick={handleExtendValidity}
                    disabled={actionLoading}
                    style={{ padding: "0.5rem 1rem", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
                  >
                    + Extend Days
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrationRequestsManager;
