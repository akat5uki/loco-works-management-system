import React from "react";
import { Train } from "lucide-react";

interface LocoSelectorTabsProps {
  locos: string[];
  selectedLoco: string | null;
  setSelectedLoco: (loco: string | null) => void;
}

const LocoSelectorTabs: React.FC<LocoSelectorTabsProps> = ({
  locos,
  selectedLoco,
  setSelectedLoco,
}) => {
  return (
    <section className="panel-card">
      <h2>Active Locomotives</h2>
      {locos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <Train size={36} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No locomotives are booked in this shift.</p>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {locos.map(locoNum => (
            <button
              key={locoNum}
              className={`back-btn ${selectedLoco === locoNum ? 'active' : ''}`}
              style={selectedLoco === locoNum ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
              onClick={() => setSelectedLoco(locoNum)}
            >
              <Train size={16} /> Loco #{locoNum}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default LocoSelectorTabs;
