import React from "react";
import MasterDataCard from "./MasterDataCard";

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

interface MasterDataListProps {
  data: MasterDataItem[];
  activeTab: "types" | "locos" | "jobs";
  locoTypes: LocoType[];
  onEdit: (item: MasterDataItem) => void;
  onDelete: (item: MasterDataItem) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  loading: boolean;
  searchQuery?: string;
}

const MasterDataList: React.FC<MasterDataListProps> = ({
  data,
  activeTab,
  locoTypes,
  onEdit,
  onDelete,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  loading,
  searchQuery,
}) => {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  if (loading) return null;

  if (data.length === 0) {
    return (
      <p className="empty-state">
        {searchQuery
          ? `No records found matching "${searchQuery}".`
          : "No records found. Add one to get started."}
      </p>
    );
  }

  // Get table header keys based on the first item in the list
  const itemKeys = Object.keys(data[0]);

  // Derive current sort key safely to clear it on activeTab change without using useEffect
  const currentSortKey = sortKey && itemKeys.includes(sortKey) ? sortKey : null;

  // Compute sorted data
  const sortedData = [...data].sort((a, b) => {
    if (!currentSortKey) return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valA = (a as any)[currentSortKey];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valB = (b as any)[currentSortKey];

    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (typeof valA === "string" && typeof valB === "string") {
      const cmp = valA.localeCompare(valB);
      return sortDirection === "asc" ? cmp : -cmp;
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = currentPage * itemsPerPage;
  const currentItems = sortedData.slice(startIndex, endIndex);

  const handleSort = (key: string) => {
    if (currentSortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  return (
    <div className="master-data-list-wrapper">
      {/* Mobile Sort Selector */}
      <div className="mobile-sort-bar mobile-only">
        <label htmlFor="mobile-sort-select">Sort by:</label>
        <div className="mobile-sort-row">
          <select
            id="mobile-sort-select"
            value={currentSortKey || ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                setSortKey(val);
                setSortDirection("asc");
              } else {
                setSortKey(null);
              }
            }}
          >
            <option value="">-- Default --</option>
            {itemKeys.map((key) => (
              <option key={key} value={key}>
                {key === "loco_type_id" && activeTab === "locos"
                  ? "Loco Type"
                  : key.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          {currentSortKey && (
            <button
              type="button"
              className="btn-sort-dir"
              onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            >
              {sortDirection === "asc" ? "Ascending ▲" : "Descending ▼"}
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="table-wrapper desktop-only">
        <table>
          <thead>
            <tr>
              {itemKeys.map((key) => {
                const isActive = currentSortKey === key;
                return (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{ cursor: "pointer", userSelect: "none" }}
                    className={isActive ? "sorted-header" : ""}
                  >
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      {key === "loco_type_id" && activeTab === "locos"
                        ? "LOCO TYPE"
                        : key.replace("_", " ").toUpperCase()}
                      {isActive ? (
                        sortDirection === "asc" ? " ▲" : " ▼"
                      ) : (
                        <span style={{ opacity: 0.3 }}> ▲</span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((item, i) => {
              const globalIndex = startIndex + i;
              return (
                <tr key={globalIndex}>
                  {itemKeys.map((key, j) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const val = (item as any)[key];
                    return (
                      <td key={j}>
                        {key === "loco_type_id" && activeTab === "locos" ? (
                          locoTypes.find((t) => t.loco_type_id === val)
                            ?.loco_type_name || val
                        ) : key === "despatched" ? (
                          <span
                            className="status-badge"
                            style={{
                              display: "inline-block",
                              padding: "0.2rem 0.6rem",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              background: val
                                ? "rgba(239,68,68,0.12)"
                                : "rgba(16,185,129,0.12)",
                              color: val ? "#ef4444" : "#10b981",
                            }}
                          >
                            {val ? "Despatched" : "Active"}
                          </span>
                        ) : typeof val === "string" &&
                          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val) ? (
                          new Date(val).toLocaleString()
                        ) : val === null || val === undefined ? (
                          ""
                        ) : (
                          String(val)
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn-edit-action"
                        onClick={() => onEdit(item)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="btn-delete-action"
                        onClick={() => onDelete(item)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Grid View */}
      <div className="cards-wrapper mobile-only">
        {currentItems.map((item, i) => {
          const globalIndex = startIndex + i;
          return (
            <MasterDataCard
              key={globalIndex}
              item={item}
              activeTab={activeTab}
              locoTypes={locoTypes}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        })}
      </div>

      {/* Pagination Bar */}
      {data.length > itemsPerPage && (
        <div className="pagination-bar">
          <span className="pagination-info">
            Showing {startIndex + 1}-{Math.min(endIndex, data.length)} of{" "}
            {data.length} records
          </span>
          <div className="pagination-controls">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="btn-pagination"
            >
              Previous
            </button>
            <span className="pagination-current">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="btn-pagination"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterDataList;
