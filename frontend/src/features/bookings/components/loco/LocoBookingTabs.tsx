import React from "react";
import { Plus, ClipboardList, History } from "lucide-react";

interface LocoBookingTabsProps {
  activeTab: "booking" | "list" | "history";
  setActiveTab: (tab: "booking" | "list" | "history") => void;
}

const LocoBookingTabs: React.FC<LocoBookingTabsProps> = ({
  activeTab,
  setActiveTab,
}) => {
  return (
    <nav className="master-tabs loco-booking-tabs">
      <button
        className={activeTab === "booking" ? "active" : ""}
        onClick={() => setActiveTab("booking")}
        type="button"
      >
        <Plus size={18} /> Create Booking
      </button>
      <button
        className={activeTab === "list" ? "active" : ""}
        onClick={() => setActiveTab("list")}
        type="button"
      >
        <ClipboardList size={18} /> Daily Bookings
      </button>
      <button
        className={activeTab === "history" ? "active" : ""}
        onClick={() => setActiveTab("history")}
        type="button"
      >
        <History size={18} /> Booking History
      </button>
    </nav>
  );
};

export default LocoBookingTabs;
