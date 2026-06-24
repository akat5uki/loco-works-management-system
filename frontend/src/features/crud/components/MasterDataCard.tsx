import React from "react";
import { Edit2, Trash2 } from "lucide-react";

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

interface MasterDataCardProps {
  item: MasterDataItem;
  activeTab: "types" | "locos" | "jobs";
  locoTypes: LocoType[];
  onEdit: (item: MasterDataItem) => void;
  onDelete: (item: MasterDataItem) => void;
}

const MasterDataCard: React.FC<MasterDataCardProps> = ({
  item,
  activeTab,
  locoTypes,
  onEdit,
  onDelete,
}) => {
  if (activeTab === "types") {
    const typeItem = item as LocoType;
    return (
      <div className="master-data-card">
        <div className="card-header">
          <span className="card-id-badge">ID: {typeItem.loco_type_id}</span>
        </div>
        <div className="card-content">
          <div className="card-field">
            <span className="field-label">Type Name</span>
            <span className="field-value">{typeItem.loco_type_name}</span>
          </div>
        </div>
        <div className="card-actions">
          <button className="btn-edit-action" onClick={() => onEdit(item)} type="button">
            <Edit2 size={14} /> Edit
          </button>
          <button className="btn-delete-action" onClick={() => onDelete(item)} type="button">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    );
  }

  if (activeTab === "locos") {
    const locoItem = item as Loco;
    const typeName =
      locoTypes.find((t) => t.loco_type_id === locoItem.loco_type_id)
        ?.loco_type_name || locoItem.loco_type_id;

    return (
      <div className="master-data-card">
        <div className="card-header">
          <span className="card-id-badge font-bold">Number: {locoItem.loco_number}</span>
          <span
            className="status-badge"
            style={{
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: locoItem.despatched
                ? "rgba(239,68,68,0.12)"
                : "rgba(16,185,129,0.12)",
              color: locoItem.despatched ? "#ef4444" : "#10b981",
            }}
          >
            {locoItem.despatched ? "Despatched" : "Active"}
          </span>
        </div>
        <div className="card-content">
          <div className="card-field">
            <span className="field-label">Loco Type</span>
            <span className="field-value">{typeName}</span>
          </div>
          <div className="card-field">
            <span className="field-label">Production Stage</span>
            <span className="field-value badge-stage">Stage {locoItem.stage}</span>
          </div>
          {locoItem.despatched && locoItem.despatch_date && (
            <div className="card-field">
              <span className="field-label">Despatch Date</span>
              <span className="field-value">
                {new Date(locoItem.despatch_date).toLocaleString()}
              </span>
            </div>
          )}
        </div>
        <div className="card-actions">
          <button className="btn-edit-action" onClick={() => onEdit(item)} type="button">
            <Edit2 size={14} /> Edit
          </button>
          <button className="btn-delete-action" onClick={() => onDelete(item)} type="button">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    );
  }

  // ActiveTab === "jobs"
  const jobItem = item as Job;
  return (
    <div className="master-data-card">
      <div className="card-header">
        <span className="card-id-badge">Job ID: {jobItem.job_id}</span>
      </div>
      <div className="card-content">
        <div className="card-field">
          <span className="field-label">Description</span>
          <span className="field-value">{jobItem.job_description}</span>
        </div>
        <div className="card-field">
          <span className="field-label">Stage</span>
          <span className="field-value badge-stage">Stage {jobItem.stage}</span>
        </div>
      </div>
      <div className="card-actions">
        <button className="btn-edit-action" onClick={() => onEdit(item)} type="button">
          <Edit2 size={14} /> Edit
        </button>
        <button className="btn-delete-action" onClick={() => onDelete(item)} type="button">
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
};

export default MasterDataCard;
