import { useState, useEffect, useCallback } from "react";
import { Settings, Plus, ArrowLeft, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../shared/services/api";
import { AxiosError } from "axios";
import ThemeToggle from "../../shared/components/ThemeToggle";
import TrainLoader from "../../shared/components/TrainLoader";
import MasterDataTabs from "./components/MasterDataTabs";
import MasterDataForm from "./components/MasterDataForm";
import MasterDataList from "./components/MasterDataList";
import "./MasterData.css";

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

  const [activeTab, setActiveTab] = useState<"types" | "locos" | "jobs">("types");
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
  const [searchQuery, setSearchQuery] = useState("");

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
        endpoint = isEditing
          ? `/locos/types/${formData.loco_type_id}`
          : "/locos/types";
      } else if (activeTab === "locos") {
        endpoint = isEditing
          ? `/locos/${formData.loco_number}`
          : "/locos/";
      } else if (activeTab === "jobs") {
        if (!/^\d+$/.test(String(formData.job_id ?? ""))) {
          setError("Job ID must contain only digits.");
          setLoading(false);
          return;
        }
        endpoint = isEditing
          ? `/jobs/${formData.job_id}`
          : "/jobs/";
      }

      // Convert digit fields to strings for the text field submission requirement
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
      console.error("Save error details:", axiosError.response?.data);
      const detail =
        axiosError.response?.data?.detail ||
        "Ensure fields are correct and IDs are unique.";
      setError(
        typeof detail === "object" ? JSON.stringify(detail) : String(detail)
      );
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
      const detail =
        axiosError.response?.data?.detail ||
        "Failed to delete record. It may be referenced by other active tables.";
      setError(
        typeof detail === "object" ? JSON.stringify(detail) : String(detail)
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.trim().toLowerCase();
    
    // For types
    if (activeTab === "types") {
      const type = item as LocoType;
      return (
        String(type.loco_type_id).toLowerCase().includes(query) ||
        type.loco_type_name.toLowerCase().includes(query)
      );
    }
    // For locos
    if (activeTab === "locos") {
      const loco = item as Loco;
      const typeName = locoTypes.find((t) => t.loco_type_id === loco.loco_type_id)?.loco_type_name ?? "";
      const formattedDespatchDate = loco.despatch_date
        ? new Date(loco.despatch_date).toLocaleString().toLowerCase()
        : "";
      return (
        String(loco.loco_number).toLowerCase().includes(query) ||
        String(loco.stage).toLowerCase().includes(query) ||
        typeName.toLowerCase().includes(query) ||
        (loco.despatched ? "despatched" : "active").includes(query) ||
        formattedDespatchDate.includes(query)
      );
    }
    // For jobs
    if (activeTab === "jobs") {
      const job = item as Job;
      return (
        String(job.job_id).toLowerCase().includes(query) ||
        job.job_description.toLowerCase().includes(query) ||
        String(job.stage).toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="master-container">
      <header className="master-header">
        <button
          className="back-btn"
          onClick={() => navigate("/dashboard")}
          type="button"
        >
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

      <MasterDataTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="master-main">
        {error && !showForm && (
          <div className="error-message page-error-message">{error}</div>
        )}

        <div className="action-bar">
          <h3>
            Existing{" "}
            {activeTab === "types"
              ? "Loco Types"
              : activeTab === "locos"
              ? "Locomotives"
              : "Jobs"}
          </h3>
          <div className="action-bar-right">
            <div className={`search-box-wrapper master-search ${searchQuery ? "has-clear" : ""}`}>
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  title="Clear search"
                >
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
              <Plus size={18} /> Add{" "}
              {activeTab === "types"
                ? "Type"
                : activeTab === "locos"
                ? "Locomotive"
                : "Job"}
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

        {loading && !showForm ? (
          <div style={{ padding: "3rem 0" }}>
            <TrainLoader
              message={`Fetching ${
                activeTab === "types"
                  ? "Loco Types"
                  : activeTab === "locos"
                  ? "Locomotives"
                  : "Jobs"
              }...`}
            />
          </div>
        ) : (
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
        )}
      </main>
    </div>
  );
};

export default MasterDataPage;
