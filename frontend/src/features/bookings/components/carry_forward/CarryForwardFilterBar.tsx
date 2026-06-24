import React from "react";
import { Calendar, Clock, RefreshCw } from "lucide-react";

interface CarryForwardFilterBarProps {
  dateStr: string;
  setDateStr: (d: string) => void;
  shift: number;
  setShift: (s: number) => void;
  fetchLocos: () => void;
}

const CarryForwardFilterBar: React.FC<CarryForwardFilterBarProps> = ({
  dateStr,
  setDateStr,
  shift,
  setShift,
  fetchLocos,
}) => {
  return (
    <div className="global-config-bar">
      <div className="config-group">
        <label><Calendar size={14} style={{ marginRight: 4 }} /> Date</label>
        <input
          type="date"
          className="config-input"
          required={true}
          value={dateStr}
          onChange={e => setDateStr(e.target.value)}
        />
      </div>
      <div className="config-group">
        <label><Clock size={14} style={{ marginRight: 4 }} /> Shift</label>
        <select
          className="config-select"
          value={shift}
          onChange={e => setShift(parseInt(e.target.value))}
        >
          <option value={1}>Shift 1 (Day)</option>
          <option value={2}>Shift 2 (Night)</option>
        </select>
      </div>
      <button className="back-btn" onClick={fetchLocos} style={{ height: "38px" }}>
        <RefreshCw size={14} /> Refresh Locomotives
      </button>
    </div>
  );
};

export default CarryForwardFilterBar;
