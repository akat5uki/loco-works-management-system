import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, X, Layers, Train, Briefcase } from "lucide-react";
import api from "../../../shared/services/api";
import { AxiosError } from "axios";
import MasterDataForm from "../../crud/components/MasterDataForm";
import MasterDataList from "../../crud/components/MasterDataList";
import "../../crud/MasterData.css";

interface LocoType {
  loco_type_id: number;
  loco_type_name: string;
}

interface Loco {
  loco_number: string;
  loco_type_id: number;
  stage: number;
  despatched: boolean;
  despatch_date?: string | null;
}

interface Job {
  job_id: number;
  job_description: string;
  stage: number;
}

type MasterDataItem = LocoType | Loco | Job;

const MasterDataCrudWizard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"types" | "locos" | "jobs">("types");
  const [data, setData] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [locoTypes, setLocoTypes] = useState<LocoType[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const response = await api.get("/locos/types");
        setLocoTypes(response.data);
      } catch (err) {
        console.error("Failed to fetch loco types", err);
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
    } catch (err) {
      console.error("Error fetching master data", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let endpoint = "";
      if (activeTab === "types") {
        if (!/^\d+$/.test(String(formData.loco_type_id ?? ""))) {
          setError("Loco Type ID must contain only digits.");
          setLoading(false);
          return;
        }
        endpoint = isEditing ? `/locos/types/${formData.loco_type_id}` : "/locos/types";
      } else if (activeTab === "locos") {
        endpoint = isEditing ? `/locos/${formData.loco_number}` : "/locos/";
      } else if (activeTab === "jobs") {
        if (!/^\d+$/.test(String(formData.job_id ?? ""))) {
          setError("Job ID must contain only digits.");
          setLoading(false);
          return;
        }
        endpoint = isEditing ? `/jobs/${formData.job_id}` : "/jobs/";
      }

      const submissionData = { ...formData };
      if (activeTab === "types" && submissionData.loco_type_id !== undefined) {
        submissionData.loco_type_id = String(submissionData.loco_type_id);
      }
      if (activeTab === "jobs" && submissionData.job_id !== undefined) {
        submissionData.job_id = String(submissionData.job_id);
      }

      if (isEditing) {
        await api.put(endpoint, submissionData);
      } else {
        await api.post(endpoint, submissionData);
      }
      setShowForm(false);
      setIsEditing(false);
      setFormData({});
      setError("");
      fetchData();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: unknown }>;
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
      fetchData();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: unknown }>;
      const detail = axiosError.response?.data?.detail || "Failed to delete record.";
      setError(typeof detail === "object" ? JSON.stringify(detail) : String(detail));
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.trim().toLowerCase();
    if (activeTab === "types") {
      const type = item as LocoType;
      return String(type.loco_type_id).toLowerCase().includes(query) || type.loco_type_name.toLowerCase().includes(query);
    }
    if (activeTab === "locos") {
      const loco = item as Loco;
      const typeName = locoTypes.find((t) => t.loco_type_id === loco.loco_type_id)?.loco_type_name ?? "";
      return String(loco.loco_number).toLowerCase().includes(query) || typeName.toLowerCase().includes(query);
    }
    if (activeTab === "jobs") {
      const job = item as Job;
      return String(job.job_id).toLowerCase().includes(query) || job.job_description.toLowerCase().includes(query);
    }
    return true;
  });

  return (
    <div className="view-content-card">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2>Master Data Administration Wizard</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Full CRUD privileges for system master catalogs. Changes are immediately reflected across operations.
        </p>
      </div>

      <div className="admin-tab-nav" style={{ marginBottom: "1.5rem" }}>
        <button
          className={`admin-tab-btn ${activeTab === "types" ? "active" : ""}`}
          onClick={() => setActiveTab("types")}
        >
          <Layers size={18} /> Loco Types Catalog
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "locos" ? "active" : ""}`}
          onClick={() => setActiveTab("locos")}
        >
          <Train size={18} /> Locomotive Fleet
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "jobs" ? "active" : ""}`}
          onClick={() => setActiveTab("jobs")}
        >
          <Briefcase size={18} /> Master Jobs & Operations
        </button>
      </div>

      <main className="master-main" style={{ padding: 0 }}>
        {error && !showForm && (
          <div className="error-message page-error-message">{error}</div>
        )}

        <div className="action-bar" style={{ marginBottom: "1rem" }}>
          <h3>Catalog Items</h3>
          <div className="action-bar-right">
            <div className={`search-box-wrapper master-search ${searchQuery ? "has-clear" : ""}`}>
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchQuery("")}>
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              className="btn-add"
              onClick={() => {
                setShowForm(true);
                setIsEditing(false);
                setFormData({});
                setError("");
              }}
              type="button"
            >
              <Plus size={18} /> Add New Entry
            </button>
          </div>
        </div>

        {showForm && (
          <MasterDataForm
            activeTab={activeTab}
            isEditing={isEditing}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setIsEditing(false);
              setFormData({});
              setError("");
            }}
            locoTypes={locoTypes}
            loading={loading}
            error={error}
          />
        )}

        <MasterDataList
          data={filteredData}
          activeTab={activeTab}
          locoTypes={locoTypes}
          onEdit={handleEdit}
          onDelete={handleDelete}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
          loading={loading}
          searchQuery={searchQuery}
        />
      </main>
    </div>
  );
};

export default MasterDataCrudWizard;
