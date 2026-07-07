import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Search,
  ArrowLeft,
  Settings,
  ShieldAlert,
  FileText,
  Terminal,
  Cpu,
  Bookmark,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import "../../shared/components/CookieConsent.css"; // Reuse styling variables

interface Article {
  id: string;
  title: string;
  category: "electrical" | "mechanical" | "brakes" | "telemetry" | "safety";
  description: string;
  author: string;
  readTime: string;
  lastUpdated: string;
  content: string[];
}

const KNOWLEDGE_ARTICLES: Article[] = [
  {
    id: "wag9-traction",
    title: "WAG-9 Locomotive Traction Motor Overhaul Manual",
    category: "electrical",
    description: "Step-by-step procedures for the stator rewinding, insulation testing, and rotor balancing of 3-Phase asynchronous traction motors.",
    author: "S. K. Sharma (Senior Section Engineer)",
    readTime: "12 min read",
    lastUpdated: "June 28, 2026",
    content: [
      "Ensure the locomotive is completely de-energized and grounded before beginning traction motor isolation.",
      "Step 1: Check insulation resistance using a 1000V Megger. Minimum acceptable value is 100 Megaohms.",
      "Step 2: Inspect stator windings for localized heat damage, cracks in insulation varnish, and dust accumulation.",
      "Step 3: Measure rotor shaft run-out. Maximum allowable tolerance is 0.03mm. Anything higher requires machining.",
      "Step 4: Clean the carbon brush holders and replace brushes worn past the wear-limit line (minimum length 22mm).",
      "Apply protective varnish and bake the motor assembly at 120°C for 4 hours to dry out any moisture absorption.",
    ],
  },
  {
    id: "brake-calib",
    title: "E-Control Pneumatic Brake System Calibration",
    category: "brakes",
    description: "Guidelines for calibrating distributor valves, air drier cycles, and pressure indicators to maintain safety compliance.",
    author: "Aastha (Junior Engineer)",
    readTime: "8 min read",
    lastUpdated: "July 02, 2026",
    content: [
      "Perform calibration only on a level track with handbrakes applied and wheels chocked.",
      "Step 1: Verify brake pipe pressure is exactly 5.0 kg/cm² and feed pipe pressure is 6.0 kg/cm².",
      "Step 2: Initiate full service application. Verify brake cylinder pressure rises to 3.8 ± 0.1 kg/cm² within 28 seconds.",
      "Step 3: Check air drier purge cycles. The cycle should trigger every 60 seconds of compressor run time.",
      "Step 4: Audit leak rate. Maximum allowable drop is 0.2 kg/cm² per minute with the compressor shut down.",
    ],
  },
  {
    id: "telemetry-trouble",
    title: "FastAPI Pub/Sub Telemetry Integration & Troubleshooting",
    category: "telemetry",
    description: "Developer guide to debugging live Redis Stream telemetry broadcasts (`workshop_telemetry`) and active WebSockets.",
    author: "LWMS DevOps Team",
    readTime: "15 min read",
    lastUpdated: "July 05, 2026",
    content: [
      "The backend utilizes a Redis Stream (`workshop_telemetry`) to broadcast event notifications in real time.",
      "Verify Sentinel health: run `docker compose exec redis-sentinel-1 redis-cli -p 26379 sentinel masters`.",
      "Ensure the Websocket endpoint (`/api/v1/realtime/ws`) has active handshakes. Look for HTTP 101 status codes in browser DevTools.",
      "If telemetry drops, check Uvicorn console logs for connections terminated by database read/write primary-replica replication lag.",
      "To test stream messages manually, run `XADD workshop_telemetry * event_type 'test' message 'system check'` via redis-cli.",
    ],
  },
  {
    id: "stage-checklist",
    title: "Stage-Wise Locomotive Commissioning Checklist",
    category: "mechanical",
    description: "Required inspection phases (Stage 5 to Stage 9) for high-horsepower freight locomotives prior to final despatch.",
    author: "R. K. Verma (SSE - Mechanical Shed)",
    readTime: "10 min read",
    lastUpdated: "June 15, 2026",
    content: [
      "Stage 5 (Pneumatics & Piping Check): Inspect underframe piping alignment and pressure tightness.",
      "Stage 6 (Electrical Cabling Audit): Verify continuity of control cables and check wire numbering layout against schema.",
      "Stage 7 (Static Telemetry Setup): Register locomotive IoT hub and perform initial data transmission check.",
      "Stage 9 (Final Despatch Certification): Check wheel profiles, buffer height alignment, and sign off the safety certificate.",
    ],
  },
  {
    id: "safety-emergency",
    title: "High-Voltage Overhead Equipment Safety Protocols",
    category: "safety",
    description: "Crucial safety instructions for personnel working near 25kV AC overhead lines and locomotive pantograph assemblies.",
    author: "Safety Assurance Cell",
    readTime: "6 min read",
    lastUpdated: "May 20, 2026",
    content: [
      "WARNING: 25kV Overhead Equipment (OHE) is extremely hazardous. Maintain a minimum safe distance of 2 meters at all times.",
      "Never climb onto a locomotive roof unless the OHE is shut down, isolated, and grounded with discharge rods applied.",
      "Ensure all staff members are wearing insulation-rated safety boots (Class E, tested to 20kV) and high-visibility vests.",
      "In case of OHE breakdown, immediately notify the Traction Power Controller (TPC) and evacuate the bay area.",
    ],
  },
];

const KnowledgeBaseUI: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const categories = [
    { id: "all", name: "All Manuals", icon: <BookOpen size={16} /> },
    { id: "electrical", name: "Electrical", icon: <Cpu size={16} /> },
    { id: "mechanical", name: "Mechanical", icon: <Settings size={16} /> },
    { id: "brakes", name: "Pneumatic Brakes", icon: <FileText size={16} /> },
    { id: "telemetry", name: "Dev & Telemetry", icon: <Terminal size={16} /> },
    { id: "safety", name: "Safety & OHE", icon: <ShieldAlert size={16} /> },
  ];

  const filteredArticles = KNOWLEDGE_ARTICLES.filter((art) => {
    const matchesSearch =
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "all" || art.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-secondary)", color: "var(--text)" }}>
      {/* Header Banner */}
      <header
        style={{
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border-color)",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          boxShadow: "var(--shadow)",
        }}
      >
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </button>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text-h)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <BookOpen size={20} color="#0284c7" /> Supervisor Knowledge Base
        </h1>
      </header>

      {/* Main Container */}
      <div style={{ display: "flex", flex: 1, padding: "2rem", gap: "2rem", flexWrap: "wrap" }}>
        
        {/* Sidebar Filter and Search */}
        <aside style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1.5rem", boxShadow: "var(--shadow)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "var(--text-h)" }}>Search & Catalog</h2>
            
            {/* Search Input */}
            <div style={{ position: "relative", marginBottom: "1.5rem" }}>
              <Search size={18} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search manual or procedure..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem 0.6rem 2.25rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-h)",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            {/* Category selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                Filter By Discipline
              </label>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    width: "100%",
                    padding: "0.6rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid " + (selectedCategory === cat.id ? "var(--border-color)" : "transparent"),
                    background: selectedCategory === cat.id ? "rgba(2, 132, 199, 0.08)" : "none",
                    color: selectedCategory === cat.id ? "#0284c7" : "var(--text)",
                    fontWeight: selectedCategory === cat.id ? 700 : 500,
                    fontSize: "0.88rem",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", color: selectedCategory === cat.id ? "#0284c7" : "var(--text-muted)" }}>
                    {cat.icon}
                  </span>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Safety Warning */}
          <div style={{ background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "12px", padding: "1.25rem", display: "flex", gap: "0.75rem" }}>
            <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
            <div>
              <h4 style={{ margin: "0 0 0.25rem 0", color: "#ef4444", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase" }}>Critical Safety Note</h4>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text)", opacity: 0.85, lineHeight: 1.4 }}>
                Overhaul procedures must comply with Indian Railways safety code. Do not initiate any electrical isolation checks without proper permit-to-work tags.
              </p>
            </div>
          </div>
        </aside>

        {/* Manuals Listing */}
        <main style={{ flex: "2 1 600px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "var(--text-h)" }}>
            Available Technical Guidelines ({filteredArticles.length})
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {filteredArticles.map((art) => (
              <div
                key={art.id}
                onClick={() => setSelectedArticle(art)}
                style={{
                  background: "var(--bg-card)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  padding: "1.5rem",
                  boxShadow: "var(--shadow)",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1.5rem",
                }}
                className="article-card-hover"
              >
                <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "8px",
                      background: "rgba(2, 132, 199, 0.08)",
                      color: "#0284c7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Bookmark size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: "0 0 0.4rem 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-h)" }}>{art.title}</h3>
                    <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{art.description}</p>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      <span>Authored: <strong>{art.author}</strong></span>
                      <span>•</span>
                      <span>{art.readTime}</span>
                      <span>•</span>
                      <span>Updated: {art.lastUpdated}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>
            ))}

            {filteredArticles.length === 0 && (
              <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                No articles match your search filter settings. Try typing other keywords.
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Manual Detail Slide-over Drawer Modal */}
      {selectedArticle && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 1000,
          }}
          onClick={() => setSelectedArticle(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "680px",
              background: "var(--bg-card)",
              height: "100%",
              overflowY: "auto",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              padding: "2.5rem 2rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "0.25rem 0.6rem",
                  borderRadius: "4px",
                  background: "rgba(2, 132, 199, 0.1)",
                  color: "#0284c7",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {selectedArticle.category} manual
              </span>
              <button
                onClick={() => setSelectedArticle(null)}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "0.3rem 0.6rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-h)",
                  cursor: "pointer",
                }}
              >
                Close Drawer
              </button>
            </div>

            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-h)", margin: "0 0 1rem 0" }}>{selectedArticle.title}</h2>
            
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "2rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "1rem" }}>
              <span>Author: {selectedArticle.author}</span>
              <span>•</span>
              <span>Updated: {selectedArticle.lastUpdated}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-h)", margin: "0 0 0.5rem 0" }}>Inspection & Repair Guide Steps</h3>
              {selectedArticle.content.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "1rem",
                    borderRadius: "8px",
                    background: "var(--bg-secondary)",
                    borderLeft: "4px solid " + (step.startsWith("WARNING") ? "#ef4444" : "#0284c7"),
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    color: "var(--text)",
                  }}
                >
                  {step}
                </div>
              ))}
            </div>

            <div style={{ marginTop: "3rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end" }}>
              <a
                href="https://rdso.indianrailways.gov.in"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.82rem",
                  color: "#0284c7",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Open RDSO Specifications Link <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseUI;
