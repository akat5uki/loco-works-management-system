import React from "react";
import { X } from "lucide-react";

interface LocoType {
  loco_type_id: number;
  loco_type_name: string;
}

interface MasterDataFormProps {
  activeTab: "types" | "locos" | "jobs";
  isEditing: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (data: Record<string, any>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  locoTypes: LocoType[];
  loading: boolean;
  error: string;
}

const MasterDataForm: React.FC<MasterDataFormProps> = ({
  activeTab,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  locoTypes,
  loading,
  error,
}) => {
  return (
    <div className="crud-form-overlay" onClick={onCancel}>
      <div className="crud-form-container" onClick={(e) => e.stopPropagation()}>
        <div className="form-header">
          <h3>
            {isEditing ? "Edit" : "Add New"}{" "}
            {activeTab === "types"
              ? "Loco Type"
              : activeTab === "locos"
              ? "Locomotive"
              : "Job"}
          </h3>
          <button className="close-drawer-btn" onClick={onCancel} type="button">
            <X size={20} />
          </button>
        </div>

        <form className="crud-form-body" onSubmit={onSubmit}>
          {error && <div className="error-message form-error-message">{error}</div>}

          {activeTab === "types" && (
            <div className="form-fields">
              <div className="form-group">
                <label htmlFor="loco_type_id">Type ID</label>
                <input
                  id="loco_type_id"
                  type="text"
                  placeholder="e.g. 1, 2"
                  required
                  disabled={isEditing}
                  value={formData.loco_type_id ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loco_type_id: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="loco_type_name">Type Name</label>
                <input
                  id="loco_type_name"
                  type="text"
                  placeholder="e.g. WAP-7"
                  required
                  value={formData.loco_type_name ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, loco_type_name: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {activeTab === "locos" && (
            <div className="form-fields">
              <div className="form-group">
                <label htmlFor="loco_number">Loco Number</label>
                <input
                  id="loco_number"
                  type="text"
                  placeholder="e.g. 30123"
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
              </div>

              <div className="form-group">
                <label htmlFor="loco_type_id">Loco Type</label>
                <select
                  id="loco_type_id"
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
              </div>

              <div className="form-group">
                <label htmlFor="stage">Stage</label>
                <select
                  id="stage"
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
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!formData.despatched}
                    onChange={(e) => {
                      const nextDespatched = e.target.checked;
                      setFormData({
                        ...formData,
                        despatched: nextDespatched,
                        stage: nextDespatched
                          ? 9
                          : formData.stage === 9
                          ? 0
                          : formData.stage ?? 0,
                      });
                    }}
                  />
                  <span>Despatched (left production unit)</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === "jobs" && (
            <div className="form-fields">
              <div className="form-group">
                <label htmlFor="job_id">Job ID</label>
                <input
                  id="job_id"
                  type="text"
                  placeholder="e.g. 101"
                  required
                  disabled={isEditing}
                  value={formData.job_id ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      job_id: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="job_description">Description</label>
                <input
                  id="job_description"
                  type="text"
                  placeholder="e.g. Underframe Piping"
                  required
                  value={formData.job_description ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      job_description: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="job_stage">Stage</label>
                <select
                  id="job_stage"
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
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              className="btn-cancel-action"
              type="button"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button className="btn-submit-action" type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MasterDataForm;
