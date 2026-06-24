import React from "react";
import { Train, Briefcase } from "lucide-react";

interface MasterDataTabsProps {
  activeTab: "types" | "locos" | "jobs";
  setActiveTab: (tab: "types" | "locos" | "jobs") => void;
}

const MasterDataTabs: React.FC<MasterDataTabsProps> = ({
  activeTab,
  setActiveTab,
}) => {
  return (
    <nav className="master-tabs">
      <button
        className={activeTab === "types" ? "active" : ""}
        onClick={() => setActiveTab("types")}
        type="button"
      >
        <Train size={18} /> Loco Types
      </button>
      <button
        className={activeTab === "locos" ? "active" : ""}
        onClick={() => setActiveTab("locos")}
        type="button"
      >
        <Train size={18} /> Locomotives
      </button>
      <button
        className={activeTab === "jobs" ? "active" : ""}
        onClick={() => setActiveTab("jobs")}
        type="button"
      >
        <Briefcase size={18} /> Jobs
      </button>
    </nav>
  );
};

export default MasterDataTabs;
