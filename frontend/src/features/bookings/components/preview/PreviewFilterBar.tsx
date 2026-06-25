import React from "react";
import { Calendar, Clock, RefreshCw, FileSpreadsheet, Printer, AlertTriangle } from "lucide-react";

interface PreviewFilterBarProps {
  dateStr: string;
  setDateStr: (d: string) => void;
  shift: number;
  setShift: (s: number) => void;
  fetchData: () => void;
  exportToExcel: () => void;
  handlePrint: () => void;
  isCurrentOrNextShift: boolean;
}

const PreviewFilterBar: React.FC<PreviewFilterBarProps> = ({
  dateStr,
  setDateStr,
  shift,
  setShift,
  fetchData,
  exportToExcel,
  handlePrint,
  isCurrentOrNextShift,
}) => {
  return (
    <>
      {/* Warning Banner */}
      {!isCurrentOrNextShift && (
        <div className="lock-banner no-print" style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid #f59e0b", color: "#f59e0b", marginBottom: "1.5rem" }}>
          <AlertTriangle size={18} />
          <span>
            Warning: You are viewing summary data for a shift other than the current or next shift.
          </span>
        </div>
      )}

      {/* Selection Bar */}
      <div className="global-config-bar no-print">
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
        <div className="preview-filter-actions">
          <button className="back-btn" onClick={fetchData} style={{ height: "38px" }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="back-btn" onClick={exportToExcel} style={{ height: "38px", background: "var(--accent)", color: "white", borderColor: "var(--accent)" }}>
            <FileSpreadsheet size={14} /> Export Excel
          </button>
          <button className="back-btn" onClick={handlePrint} style={{ height: "38px" }}>
            <Printer size={14} /> Print PDF
          </button>
        </div>
      </div>
    </>
  );
};

export default PreviewFilterBar;
