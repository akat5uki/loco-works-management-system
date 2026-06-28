/**
 * ==============================================================================
 * MASTER DATA ADMINISTRATION WIZARD
 * Provides system administrators full CRUD access across all operational tables:
 * Categories, Designations, Employees, Loco Types, Locomotives, Jobs, Tasks, and Admins.
 * Enforces clean pagination, mobile-responsive controls, and readable code comments.
 * ==============================================================================
 */

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, X, Layers, Train, Briefcase, Users, ShieldAlert, ChevronLeft, ChevronRight, Check, Trash2, Edit3 } from "lucide-react";
import api from "../../../shared/services/api";
import { AxiosError } from "axios";
import MasterDataForm from "../../crud/components/MasterDataForm";
import MasterDataList from "../../crud/components/MasterDataList";
import "../../crud/MasterData.css";

// Interface definitions for master data tables
export interface Category {
  category_id: number;
  category_name: string;
}

export interface Designation {
  designation_id: number;
  designation_name: string;
  category_id: number;
}

export interface EmployeeRecord {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name?: string;
  category_name?: string;
  email?: string;
}

export interface LocoType {
  loco_type_id: number;
  loco_type_name: string;
}

export interface Loco {
  loco_number: string;
  loco_type_id: number;
  stage: number;
  despatched: boolean;
}

export interface Job {
  job_id: number;
  job_description: string;
  stage: number;
}

type TabType = "categories" | "designations" | "employees" | "types" | "locos" | "jobs" | "admins";

const MasterDataCrudWizard: React.FC = () => {
  // Current active master table tab
  const [activeTab, setActiveTab] = useState<TabType>("categories");
  
  // Generic state containers for items and metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Auxiliary master reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [locoTypes, setLocoTypes] = useState<LocoType[]>([]);

  // Form input state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Fetch reference lookups on mount
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [catRes, desigRes, typeRes] = await Promise.all([
          api.get("/admin/master-data/categories"),
          api.get("/admin/master-data/designations"),
          api.get("/locos/types"),
        ]);
        setCategories(catRes.data);
        setDesignations(desigRes.data);
        setLocoTypes(typeRes.data);
      } catch (err) {
        console.error("Error loading master lookup references", err);
      }
    };
    fetchLookups();
  }, []);

  /**
   * Fetch master data items for the active table tab
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "categories") endpoint = "/admin/master-data/categories";
      else if (activeTab === "designations") endpoint = "/admin/master-data/designations";
      else if (activeTab === "employees") endpoint = "/admin/master-data/employees";
      else if (activeTab === "types") endpoint = "/locos/types";
      else if (activeTab === "locos") endpoint = "/locos/";
      else if (activeTab === "jobs") endpoint = "/jobs/";
      else if (activeTab === "admins") endpoint = "/admin/admins";

      const res = await api.get(endpoint);
      setItems(res.data);
    } catch (err) {
      console.error("Error fetching table data", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Synchronize state when switching tabs
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowForm(false);
    setIsEditing(false);
    setFormData({});
    setError("");
    setCurrentPage(1);
    setSearchQuery("");
    fetchData();
  }, [fetchData]);

  /**
   * Submit create or update form payloads
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let endpoint = "";
      let method: "post" | "put" = isEditing ? "put" : "post";

      if (activeTab === "categories") {
        endpoint = isEditing ? `/admin/master-data/categories/${formData.category_id}` : "/admin/master-data/categories";
      } else if (activeTab === "designations") {
        endpoint = isEditing ? `/admin/master-data/designations/${formData.designation_id}` : "/admin/master-data/designations";
      } else if (activeTab === "employees") {
        endpoint = isEditing ? `/admin/master-data/employees/${formData.ticket_number}` : "/admin/master-data/employees";
      } else if (activeTab === "types") {
        endpoint = isEditing ? `/locos/types/${formData.loco_type_id}` : "/locos/types";
      } else if (activeTab === "locos") {
        endpoint = isEditing ? `/locos/${formData.loco_number}` : "/locos/";
      } else if (activeTab === "jobs") {
        endpoint = isEditing ? `/jobs/${formData.job_id}` : "/jobs/";
      } else if (activeTab === "admins") {
        endpoint = "/admin/add-admin";
        method = "post";
      }

      if (method === "put") {
        await api.put(endpoint, formData);
      } else {
        await api.post(endpoint, formData);
      }

      setShowForm(false);
      setIsEditing(false);
      setFormData({});
      fetchData();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: unknown }>;
      const detail = axiosError.response?.data?.detail || "Failed to save record.";
      setError(typeof detail === "object" ? JSON.stringify(detail) : String(detail));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete record trigger
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDelete = async (item: any) => {
    let confirmMsg = "Are you sure you want to delete this record?";
    let deleteUrl = "";

    if (activeTab === "categories") {
      confirmMsg = `Delete category "${item.category_name}" (#${item.category_id})?`;
      deleteUrl = `/admin/master-data/categories/${item.category_id}`;
    } else if (activeTab === "designations") {
      confirmMsg = `Delete designation "${item.designation_name}" (#${item.designation_id})?`;
      deleteUrl = `/admin/master-data/designations/${item.designation_id}`;
    } else if (activeTab === "employees") {
      confirmMsg = `Delete employee ${item.name} (#${item.ticket_number})?`;
      deleteUrl = `/admin/master-data/employees/${item.ticket_number}`;
    } else if (activeTab === "types") {
      confirmMsg = `Delete Loco Type "${item.loco_type_name}" (#${item.loco_type_id})?`;
      deleteUrl = `/locos/types/${item.loco_type_id}`;
    } else if (activeTab === "locos") {
      confirmMsg = `Delete Locomotive ${item.loco_number}?`;
      deleteUrl = `/locos/${item.loco_number}`;
    } else if (activeTab === "jobs") {
      confirmMsg = `Delete Job "${item.job_description}" (#${item.job_id})?`;
      deleteUrl = `/jobs/${item.job_id}`;
    } else if (activeTab === "admins") {
      if (items.length <= 1) {
        alert("Action Prohibited: Cannot delete or revoke administrator privileges when only one administrator exists in the system.");
        return;
      }
      if (item.is_default) {
        alert("Action Prohibited: Cannot revoke privileges from the default system administrator account.");
        return;
      }
      confirmMsg = `Revoke Administrator privileges for ticket #${item.ticket_number}?`;
      deleteUrl = `/admin/admins/${item.ticket_number}`;
    }

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await api.delete(deleteUrl);
      fetchData();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: unknown }>;
      alert(axiosError.response?.data?.detail || "Delete operation failed.");
    } finally {
      setLoading(false);
    }
  };

  // Filter dataset by search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return JSON.stringify(item).toLowerCase().includes(q);
  });

  // Calculate pagination slice
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="view-content-card">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2>Master Data Administration Wizard</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Full CRUD privileges for system master catalogs. Changes are immediately reflected across operations.
        </p>
      </div>

      {/* Top Wizard Master Tables Navigation Bar */}
      <div className="admin-tab-nav">
        <button className={`admin-tab-btn ${activeTab === "categories" ? "active" : ""}`} onClick={() => setActiveTab("categories")}>
          <Users size={16} /> Categories
        </button>
        <button className={`admin-tab-btn ${activeTab === "designations" ? "active" : ""}`} onClick={() => setActiveTab("designations")}>
          <Briefcase size={16} /> Designations
        </button>
        <button className={`admin-tab-btn ${activeTab === "employees" ? "active" : ""}`} onClick={() => setActiveTab("employees")}>
          <Users size={16} /> Employees
        </button>
        <button className={`admin-tab-btn ${activeTab === "types" ? "active" : ""}`} onClick={() => setActiveTab("types")}>
          <Layers size={16} /> Loco Types
        </button>
        <button className={`admin-tab-btn ${activeTab === "locos" ? "active" : ""}`} onClick={() => setActiveTab("locos")}>
          <Train size={16} /> Locomotives
        </button>
        <button className={`admin-tab-btn ${activeTab === "jobs" ? "active" : ""}`} onClick={() => setActiveTab("jobs")}>
          <Briefcase size={16} /> Master Jobs
        </button>
        <button className={`admin-tab-btn ${activeTab === "admins" ? "active" : ""}`} onClick={() => setActiveTab("admins")}>
          <ShieldAlert size={16} /> Administrators
        </button>
      </div>

      {/* Main Content Action Bar */}
      <div className="action-bar" style={{ marginBottom: "1rem" }}>
        <h3 style={{ textTransform: "capitalize" }}>{activeTab} Management ({filteredItems.length})</h3>
        <div className="action-bar-right" style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <div className={`search-box-wrapper master-search ${searchQuery ? "has-clear" : ""}`}>
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search catalog..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
            {searchQuery && (
              <button type="button" className="search-clear-btn" onClick={() => setSearchQuery("")}><X size={16} /></button>
            )}
          </div>
          <button
            className="btn-add"
            onClick={() => { setShowForm(true); setIsEditing(false); setFormData({}); setError(""); }}
            type="button"
          >
            <Plus size={18} /> Add Entry
          </button>
        </div>
      </div>

      {/* Render Built-in Form for Loco Types, Locos, and Jobs */}
      {showForm && (activeTab === "types" || activeTab === "locos" || activeTab === "jobs") && (
        <MasterDataForm
          activeTab={activeTab}
          isEditing={isEditing}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setIsEditing(false); setFormData({}); setError(""); }}
          locoTypes={locoTypes}
          loading={loading}
          error={error}
        />
      )}

      {/* Render Custom Modals for Categories, Designations, Employees, Admins */}
      {showForm && !(activeTab === "types" || activeTab === "locos" || activeTab === "jobs") && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
              <h2>{isEditing ? "Edit Record" : "Add New Record"}</h2>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="admin-form" style={{ padding: "1rem 0" }}>
              {error && <div className="admin-error-banner">{error}</div>}

              {activeTab === "categories" && (
                <>
                  <div className="form-group">
                    <label>Category ID</label>
                    <input type="text" inputMode="numeric" value={formData.category_id || ""} onChange={(e) => { const val = e.target.value; if (val === "" || /^\d+$/.test(val)) setFormData({ ...formData, category_id: val }); }} required disabled={isEditing} />
                  </div>
                  <div className="form-group">
                    <label>Category Name</label>
                    <input type="text" value={formData.category_name || ""} onChange={(e) => setFormData({ ...formData, category_name: e.target.value })} required />
                  </div>
                </>
              )}

              {activeTab === "designations" && (
                <>
                  <div className="form-group">
                    <label>Designation ID</label>
                    <input type="text" inputMode="numeric" value={formData.designation_id || ""} onChange={(e) => { const val = e.target.value; if (val === "" || /^\d+$/.test(val)) setFormData({ ...formData, designation_id: val }); }} required disabled={isEditing} />
                  </div>
                  <div className="form-group">
                    <label>Designation Name</label>
                    <input type="text" value={formData.designation_name || ""} onChange={(e) => setFormData({ ...formData, designation_name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Parent Category</label>
                    <select value={formData.category_id || ""} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} required>
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.category_id} value={c.category_id}>{c.category_name} (#{c.category_id})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeTab === "employees" && (
                <>
                  <div className="form-group">
                    <label>Ticket Number</label>
                    <input type="text" inputMode="numeric" value={formData.ticket_number || ""} onChange={(e) => { const val = e.target.value; if (val === "" || /^\d+$/.test(val)) setFormData({ ...formData, ticket_number: val }); }} required disabled={isEditing} />
                  </div>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <select value={formData.designation_id || ""} onChange={(e) => setFormData({ ...formData, designation_id: e.target.value })} required>
                      <option value="">Select Designation</option>
                      {designations.map((d) => (
                        <option key={d.designation_id} value={d.designation_id}>{d.designation_name}</option>
                      ))}
                    </select>
                  </div>
                  {!isEditing && (
                    <div className="form-group">
                      <label>Default Password</label>
                      <input type="password" placeholder="Defaults to abcd if left blank" value={formData.password || ""} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                    </div>
                  )}
                </>
              )}

              {activeTab === "admins" && (
                <div className="form-group">
                  <label>Employee Ticket Number</label>
                  <input type="text" inputMode="numeric" placeholder="Enter employee ticket #" value={formData.ticket_number || ""} onChange={(e) => { const val = e.target.value; if (val === "" || /^\d+$/.test(val)) setFormData({ ...formData, ticket_number: val }); }} required />
                </div>
              )}

              <button type="submit" className="admin-submit-btn" disabled={loading} style={{ marginTop: "1rem" }}>
                <Check size={18} /> {loading ? "Saving..." : "Save Record"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Render Table for Loco Types, Locos, Jobs */}
      {(activeTab === "types" || activeTab === "locos" || activeTab === "jobs") && (
        <MasterDataList
          data={paginatedItems}
          activeTab={activeTab}
          locoTypes={locoTypes}
          onEdit={(item) => { setIsEditing(true); setFormData(item); setShowForm(true); }}
          onDelete={handleDelete}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
          loading={loading}
          searchQuery={searchQuery}
        />
      )}

      {/* Render Generic Table for Categories, Designations, Employees, Admins */}
      {!(activeTab === "types" || activeTab === "locos" || activeTab === "jobs") && (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                {activeTab === "categories" && <><th>ID</th><th>Category Name</th><th>Action</th></>}
                {activeTab === "designations" && <><th>ID</th><th>Designation Name</th><th>Category ID</th><th>Action</th></>}
                {activeTab === "employees" && <><th>Ticket #</th><th>Name</th><th>Email</th><th>Designation</th><th>Category</th><th>Action</th></>}
                {activeTab === "admins" && <><th>Ticket #</th><th>Name</th><th>Email</th><th>Status</th><th>Action</th></>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>Loading catalog data...</td></tr>
              ) : paginatedItems.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>No records found.</td></tr>
              ) : (
                paginatedItems.map((item, idx) => (
                  <tr key={idx}>
                    {activeTab === "categories" && (
                      <>
                        <td>#{item.category_id}</td>
                        <td><strong>{item.category_name}</strong></td>
                      </>
                    )}
                    {activeTab === "designations" && (
                      <>
                        <td>#{item.designation_id}</td>
                        <td><strong>{item.designation_name}</strong></td>
                        <td>Category #{item.category_id}</td>
                      </>
                    )}
                    {activeTab === "employees" && (
                      <>
                        <td><strong>#{item.ticket_number}</strong></td>
                        <td>{item.name}</td>
                        <td>{item.email || "N/A"}</td>
                        <td>{item.designation_name}</td>
                        <td>{item.category_name}</td>
                      </>
                    )}
                    {activeTab === "admins" && (
                      <>
                        <td><strong>#{item.ticket_number}</strong></td>
                        <td>{item.name}</td>
                        <td>{item.email || "N/A"}</td>
                        <td>{item.is_default ? <span className="admin-badge badge-pending">Default</span> : <span className="admin-badge badge-approved">Admin</span>}</td>
                      </>
                    )}
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        {activeTab !== "admins" && (
                          <button className="icon-btn" onClick={() => { setIsEditing(true); setFormData(item); setShowForm(true); }} title="Edit"><Edit3 size={16} /></button>
                        )}
                        <button
                          className="icon-btn"
                          onClick={() => handleDelete(item)}
                          title={activeTab === "admins" && items.length <= 1 ? "Cannot delete the only administrator in system" : item.is_default ? "Cannot delete default system administrator" : "Delete"}
                          disabled={activeTab === "admins" && (items.length <= 1 || item.is_default)}
                          style={{
                            color: (activeTab === "admins" && (items.length <= 1 || item.is_default)) ? "var(--text-muted)" : "#ef4444",
                            opacity: (activeTab === "admins" && (items.length <= 1 || item.is_default)) ? 0.35 : 1,
                            cursor: (activeTab === "admins" && (items.length <= 1 || item.is_default)) ? "not-allowed" : "pointer"
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      <div className="pagination-bar">
        <div className="pagination-info">
          Showing {filteredItems.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} entries
        </div>

        <div className="pagination-controls">
          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginRight: "0.5rem" }}>Per Page:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(parseInt(e.target.value, 10)); setCurrentPage(1); }}
            style={{ padding: "0.3rem 0.6rem", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>

          <button
            className="pagination-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="pagination-page-indicator">Page {currentPage} of {totalPages}</span>
          <button
            className="pagination-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MasterDataCrudWizard;
