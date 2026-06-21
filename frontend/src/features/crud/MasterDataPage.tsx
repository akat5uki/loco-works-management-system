import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Plus,
  Train,
  Briefcase,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../shared/services/api";
import { AxiosError } from "axios";
import ThemeToggle from "../../shared/components/ThemeToggle";
import TrainLoader from "../../shared/components/TrainLoader";
import "./MasterData.css";

interface LocoType {
  loco_type_id: number;
  loco_type_name: string;
}

interface Loco {
  loco_number: string;
  loco_type_id: number;
  date_time: string;
  stage: number;
  shift: number;
  despatched: boolean;
}

interface Job {
  job_id: number;
  job_description: string;
  stage: number;
}

type MasterDataItem = LocoType | Loco | Job;

const MasterDataPage = () => {
  const navigate = useNavigate();

  // Check supervisor access on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await api.get("/auth/me");
        if (!response.data.is_supervisor) {
          alert("Access Denied: Supervisor only area.");
          navigate("/dashboard", { replace: true });
        }
      } catch {
        navigate("/login", { replace: true });
      }
    };
    checkAccess();
  }, [navigate]);

  const [activeTab, setActiveTab] = useState<
    "types" | "locos" | "jobs"
  >("types");
  const [data, setData] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [locoTypes, setLocoTypes] = useState<LocoType[]>([]);

  // Form States
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const response = await api.get("/locos/types");
        setLocoTypes(response.data);
      } catch (error) {
        console.error("Failed to fetch loco types", error);
      }
    };
    fetchTypes();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "types") endpoint = "/locos/types";
      else if (activeTab === "locos") endpoint = "/locos/";
      else if (activeTab === "jobs") endpoint = "/jobs/";

      const response = await api.get(endpoint);
      setData(response.data);
    } catch (error) {
      console.error("Error fetching master data", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    // Reset form states and fetch data when tab changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowForm(false);
    setIsEditing(false);
    setFormData({});
    setError("");
    setCurrentPage(1);
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let endpoint = "";
      if (activeTab === "types") {
        endpoint = isEditing
          ? `/locos/types/${formData.loco_type_id}`
          : "/locos/types";
      } else if (activeTab === "locos") {
        endpoint = isEditing
          ? `/locos/${formData.loco_number}`
          : "/locos/";
      } else if (activeTab === "jobs") {
        endpoint = isEditing
          ? `/jobs/${formData.job_id}`
          : "/jobs/";
      }

      if (isEditing) {
        await api.put(endpoint, formData);
      } else {
        await api.post(endpoint, formData);
      }
      setShowForm(false);
      setIsEditing(false);
      setFormData({});
      setError("");
      fetchData();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: unknown }>;
      console.error("Save error details:", axiosError.response?.data);
      const detail = axiosError.response?.data?.detail || "Ensure fields are correct and IDs are unique.";
      setError(typeof detail === "object" ? JSON.stringify(detail) : String(detail));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: MasterDataItem) => {
    setIsEditing(true);
    setFormData(item);
    setShowForm(true);
    setError("");
  };

  const handleDelete = async (item: MasterDataItem) => {
    let confirmMsg = "Are you sure you want to delete this record?";
    let deleteUrl = "";
    
    if (activeTab === "types") {
      const typeItem = item as LocoType;
      confirmMsg = `Are you sure you want to delete Loco Type "${typeItem.loco_type_name}" (ID: ${typeItem.loco_type_id})?`;
      deleteUrl = `/locos/types/${typeItem.loco_type_id}`;
    } else if (activeTab === "locos") {
      const locoItem = item as Loco;
      confirmMsg = `Are you sure you want to delete Locomotive ${locoItem.loco_number}?`;
      deleteUrl = `/locos/${locoItem.loco_number}`;
    } else if (activeTab === "jobs") {
      const jobItem = item as Job;
      confirmMsg = `Are you sure you want to delete Job "${jobItem.job_description}" (ID: ${jobItem.job_id})?`;
      deleteUrl = `/jobs/${jobItem.job_id}`;
    }

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    setError("");
    try {
      await api.delete(deleteUrl);
      setError("");
      fetchData();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: unknown }>;
      console.error("Delete error details:", axiosError.response?.data);
      const detail = axiosError.response?.data?.detail || "Failed to delete record. It may be referenced by other active tables.";
      setError(typeof detail === "object" ? JSON.stringify(detail) : String(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="master-container">
      <header className="master-header">
        <button className="back-btn" onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={20} /> Dashboard
        </button>
        <div className="title-section">
          <Settings className="text-blue-600" />
          <h1>Master Data Management</h1>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ThemeToggle />
        </div>
      </header>

      <nav className="master-tabs">
        <button
          className={activeTab === "types" ? "active" : ""}
          onClick={() => setActiveTab("types")}
        >
          <Train size={18} /> Loco Types
        </button>
        <button
          className={activeTab === "locos" ? "active" : ""}
          onClick={() => setActiveTab("locos")}
        >
          <Train size={18} /> Locomotives
        </button>
        <button
          className={activeTab === "jobs" ? "active" : ""}
          onClick={() => setActiveTab("jobs")}
        >
          <Briefcase size={18} /> Jobs
        </button>
      </nav>

      <main className="master-main">
        {error && !showForm && (
          <div className="error-message page-error-message">
            {error}
          </div>
        )}
        <div className="action-bar">
          <h3>
            {isEditing ? "Edit" : "Existing"}{" "}
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </h3>
          <button 
            className="btn-add" 
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                setIsEditing(false);
                setFormData({});
                setError("");
              } else {
                setShowForm(true);
                setError("");
              }
            }}
          >
            <Plus size={18} />{" "}
            {showForm ? "Cancel" : `Add ${activeTab === "types" ? "Type" : activeTab === "locos" ? "Locomotive" : "Job"}`}
          </button>
        </div>

        {showForm && (
          <form className="crud-form" onSubmit={handleSubmit}>
            {error && <div className="error-message form-error-message">{error}</div>}
            {activeTab === "types" && (
              <>
                <input
                  type="number"
                  placeholder="Type ID"
                  required
                  disabled={isEditing}
                  value={formData.loco_type_id ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loco_type_id: parseInt(e.target.value),
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Type Name (e.g. WAP-7)"
                  required
                  value={formData.loco_type_name ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, loco_type_name: e.target.value })
                  }
                />
              </>
            )}
            {activeTab === "locos" && (
              <>
                <input
                  type="text"
                  placeholder="Loco Number"
                  required
                  disabled={isEditing}
                  value={formData.loco_number ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loco_number: e.target.value.trim(),
                    })
                  }
                />
                <select
                  required
                  value={formData.loco_type_id ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loco_type_id: parseInt(e.target.value),
                    })
                  }
                >
                  <option value="">-- Select Loco Type --</option>
                  {locoTypes.map((t) => (
                    <option key={t.loco_type_id} value={t.loco_type_id}>
                      {t.loco_type_name}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  required
                  value={
                    formData.date_time
                      ? new Date(formData.date_time).toISOString().substring(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const localVal = e.target.value;
                    const isoVal = localVal ? new Date(localVal).toISOString() : "";
                    setFormData({
                      ...formData,
                      date_time: isoVal,
                    });
                  }}
                />
                <select
                  required
                  value={formData.stage ?? ""}
                  onChange={(e) => {
                    const nextStage = parseInt(e.target.value);
                    setFormData({
                      ...formData,
                      stage: nextStage,
                      despatched: nextStage === 9,
                    });
                  }}
                >
                  <option value="">-- Select Stage --</option>
                  <option value="0">0</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="9">9</option>
                </select>
                <select
                  required
                  value={formData.shift ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shift: parseInt(e.target.value),
                    })
                  }
                >
                  <option value="">-- Select Shift --</option>
                  <option value="1">Shift 1</option>
                  <option value="2">Shift 2</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    style={{ width: "1rem", height: "1rem", accentColor: "var(--accent)" }}
                    checked={!!formData.despatched}
                    onChange={(e) => {
                      const nextDespatched = e.target.checked;
                      setFormData({
                        ...formData,
                        despatched: nextDespatched,
                        stage: nextDespatched ? 9 : (formData.stage === 9 ? 0 : (formData.stage ?? 0)),
                      });
                    }}
                  />
                  Despatched (left production unit)
                </label>
              </>
            )}
            {activeTab === "jobs" && (
              <>
                <input
                  type="number"
                  placeholder="Job ID"
                  required
                  disabled={isEditing}
                  value={formData.job_id ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      job_id: parseInt(e.target.value),
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Description"
                  required
                  value={formData.job_description ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      job_description: e.target.value,
                    })
                  }
                />
                <select
                  required
                  value={formData.stage ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stage: parseInt(e.target.value),
                    })
                  }
                >
                  <option value="">-- Select Job Stage --</option>
                  <option value="0">0</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="9">9</option>
                </select>
              </>
            )}
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Record"}
            </button>
          </form>
        )}

        <div className="table-wrapper">
          {loading && !showForm ? (
            <TrainLoader message={`Fetching ${activeTab === "types" ? "Loco Types" : activeTab === "locos" ? "Locomotives" : "Jobs"}...`} />
          ) : (
            <table>
              <thead>
                <tr>
                  {data.length > 0 &&
                    Object.keys(data[0]).map((key) => (
                      <th key={key}>
                        {key === "loco_type_id" && activeTab === "locos"
                          ? "LOCO TYPE"
                          : key.replace("_", " ").toUpperCase()}
                      </th>
                    ))}
                  {data.length > 0 && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, i) => {
                  const itemKeys = data.length > 0 ? Object.keys(data[0]) : [];
                  const globalIndex = (currentPage - 1) * itemsPerPage + i;
                  return (
                    <tr key={globalIndex}>
                      {itemKeys.map((key, j) => {
                        const val = (item as any)[key];
                        return (
                          <td key={j}>
                            {key === "loco_type_id" && activeTab === "locos"
                              ? (locoTypes.find((t) => t.loco_type_id === val)?.loco_type_name || val)
                              : key === "despatched"
                                ? <span style={{
                                    display: "inline-block",
                                    padding: "0.2rem 0.6rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    background: val ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)",
                                    color: val ? "#ef4444" : "#10b981",
                                  }}>{val ? "Despatched" : "Active"}</span>
                                : typeof val === "string" && val.includes("T") && val.length > 10
                                  ? new Date(val).toLocaleString()
                                  : String(val)}
                          </td>
                        );
                      })}
                      <td>
                        <div className="actions-cell" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button className="btn-edit-action" onClick={() => handleEdit(item)}>
                            Edit
                          </button>
                          <button className="btn-delete-action" onClick={() => handleDelete(item)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && data.length > itemsPerPage && (
            <div className="pagination-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--text)" }}>
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, data.length)} of {data.length} records
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    color: "var(--text)",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    opacity: currentPage === 1 ? 0.5 : 1,
                  }}
                >
                  Previous
                </button>
                <span style={{ display: "flex", alignItems: "center", padding: "0 0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--text-h)" }}>
                  Page {currentPage} of {Math.ceil(data.length / itemsPerPage)}
                </span>
                <button
                  type="button"
                  disabled={currentPage === Math.ceil(data.length / itemsPerPage)}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--border)",
                    background: "var(--bg-card)",
                    color: "var(--text)",
                    cursor: currentPage === Math.ceil(data.length / itemsPerPage) ? "not-allowed" : "pointer",
                    opacity: currentPage === Math.ceil(data.length / itemsPerPage) ? 0.5 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          {!loading && data.length === 0 && (
            <p className="empty-state">
              No records found. Add one to get started.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default MasterDataPage;
