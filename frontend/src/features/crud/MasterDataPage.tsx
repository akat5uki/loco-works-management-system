import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Plus,
  Train,
  Briefcase,
  ListChecks,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../shared/services/api";
import "./MasterData.css";

interface LocoType {
  loco_type_id: number;
  loco_type_name: string;
}

interface Loco {
  loco_number: number;
  loco_type_id: number;
  date_time: string;
  stage: number;
  shift: number;
}

interface Job {
  job_id: number;
  job_description: string;
  stage: number;
}

interface Task {
  task_id: number;
  task_description: string;
}

type MasterDataItem = LocoType | Loco | Job | Task;

const MasterDataPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "types" | "locos" | "jobs" | "tasks"
  >("types");
  const [data, setData] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form States
  const [formData, setFormData] = useState<Record<string, string | number>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "types") endpoint = "/locos/types";
      else if (activeTab === "locos") endpoint = "/locos/";
      else if (activeTab === "jobs") endpoint = "/jobs/";
      else if (activeTab === "tasks") endpoint = "/jobs/tasks";

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
    setFormData({});
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let endpoint = "";
      if (activeTab === "types") endpoint = "/locos/types";
      else if (activeTab === "locos") endpoint = "/locos/";
      else if (activeTab === "jobs") endpoint = "/jobs/";
      else if (activeTab === "tasks") endpoint = "/jobs/tasks";

      await api.post(endpoint, formData);
      setShowForm(false);
      fetchData();
    } catch {
      alert("Failed to save data. Ensure IDs are unique.");
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
        <button
          className={activeTab === "tasks" ? "active" : ""}
          onClick={() => setActiveTab("tasks")}
        >
          <ListChecks size={18} /> Tasks
        </button>
      </nav>

      <main className="master-main">
        <div className="action-bar">
          <h3>
            Existing {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </h3>
          <button className="btn-add" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} />{" "}
            {showForm ? "Cancel" : `Add ${activeTab.slice(0, -1)}`}
          </button>
        </div>

        {showForm && (
          <form className="crud-form" onSubmit={handleSubmit}>
            {activeTab === "types" && (
              <>
                <input
                  type="number"
                  placeholder="Type ID"
                  required
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
                  onChange={(e) =>
                    setFormData({ ...formData, loco_type_name: e.target.value })
                  }
                />
              </>
            )}
            {activeTab === "locos" && (
              <>
                <input
                  type="number"
                  placeholder="Loco Number"
                  required
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loco_number: parseInt(e.target.value),
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="Type ID"
                  required
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loco_type_id: parseInt(e.target.value),
                    })
                  }
                />
                <input
                  type="datetime-local"
                  required
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      date_time: new Date(e.target.value).toISOString(),
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="Stage"
                  required
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stage: parseInt(e.target.value),
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="Shift"
                  required
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shift: parseInt(e.target.value),
                    })
                  }
                />
              </>
            )}
            {activeTab === "jobs" && (
              <>
                <input
                  type="number"
                  placeholder="Job ID"
                  required
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
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      job_description: e.target.value,
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="Stage"
                  required
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stage: parseInt(e.target.value),
                    })
                  }
                />
              </>
            )}
            {activeTab === "tasks" && (
              <>
                <input
                  type="number"
                  placeholder="Task ID"
                  required
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      task_id: parseInt(e.target.value),
                    })
                  }
                />
                <input
                  type="text"
                  placeholder="Task Description"
                  required
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      task_description: e.target.value,
                    })
                  }
                />
              </>
            )}
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Record"}
            </button>
          </form>
        )}

        <div className="table-wrapper">
          {loading && !showForm ? (
            <p>Loading data...</p>
          ) : (
            <table>
              <thead>
                <tr>
                  {data.length > 0 &&
                    Object.keys(data[0]).map((key) => (
                      <th key={key}>{key.replace("_", " ").toUpperCase()}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item, i) => (
                  <tr key={i}>
                    {Object.values(item).map((val, j) => (
                      <td key={j}>
                        {typeof val === "string" && val.includes("T")
                          ? new Date(val).toLocaleString()
                          : String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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
