import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  ArrowLeft,
  Briefcase,
  Star,
  CheckCircle,
  TrendingUp,
  Award,
  AlertTriangle,
} from "lucide-react";
import api from "../../shared/services/api";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
}

interface SkillRating {
  [jobName: string]: number;
}

interface AssessmentStore {
  [ticketNumber: number]: SkillRating;
}

const DEFAULT_SKILLS = [
  "Traction Motor Isolation & Alignment",
  "Pneumatic Distributor Valve Calibration",
  "High-Voltage Cable Crimping & Routing",
  "Pantograph Alignment & Tension Test",
];

const StaffAssessmentUI: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState("all");
  const [assessments, setAssessments] = useState<AssessmentStore>({});
  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load staff list from backend employees endpoint
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await api.get("/employees");
        // Filter: only show Staff (category_id !== 1 which represents Supervisors)
        const staffOnly = res.data.filter((emp: Employee) => emp.category_id !== 1);
        setEmployees(staffOnly);

        // Load existing assessments from localStorage
        const stored = localStorage.getItem("lwms_staff_assessments");
        if (stored) {
          setAssessments(JSON.parse(stored));
        } else {
          // Initialize mock default assessments for first launch
          const mockData: AssessmentStore = {};
          staffOnly.forEach((emp: Employee) => {
            mockData[emp.ticket_number] = {
              [DEFAULT_SKILLS[0]]: Math.floor(Math.random() * 3) + 3, // 3 to 5
              [DEFAULT_SKILLS[1]]: Math.floor(Math.random() * 3) + 3,
              [DEFAULT_SKILLS[2]]: Math.floor(Math.random() * 3) + 3,
              [DEFAULT_SKILLS[3]]: Math.floor(Math.random() * 3) + 3,
            };
          });
          setAssessments(mockData);
          localStorage.setItem("lwms_staff_assessments", JSON.stringify(mockData));
        }
      } catch (err) {
        console.error("Failed to load staff list", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, []);

  const handleRatingChange = (ticketNo: number, skill: string, value: number) => {
    const updated = {
      ...assessments,
      [ticketNo]: {
        ...(assessments[ticketNo] || {}),
        [skill]: value,
      },
    };
    setAssessments(updated);
    localStorage.setItem("lwms_staff_assessments", JSON.stringify(updated));

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const getAverageRating = (ticketNo: number): number => {
    const ratingObj = assessments[ticketNo];
    if (!ratingObj) return 0;
    const vals = Object.values(ratingObj);
    if (vals.length === 0) return 0;
    return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
  };

  // Filter staff list
  const filteredStaff = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.ticket_number.toString().includes(searchQuery);
    const matchesDesig = selectedDesignation === "all" || emp.designation_name === selectedDesignation;
    return matchesSearch && matchesDesig;
  });

  // Unique designations for filter list
  const designations = Array.from(new Set(employees.map((emp) => emp.designation_name)));

  // Calculate metrics
  const totalStaffCount = employees.length;
  const highPerformers = Object.keys(assessments).filter((ticketStr) => {
    const tNum = parseInt(ticketStr);
    return getAverageRating(tNum) >= 4.2;
  }).length;
  const needTraining = Object.keys(assessments).filter((ticketStr) => {
    const tNum = parseInt(ticketStr);
    return getAverageRating(tNum) < 3.5;
  }).length;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
        Loading employee registry and assessment database...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-secondary)", color: "var(--text)" }}>
      {/* Header */}
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
          <Users size={20} color="#10b981" /> Staff Competency Assessment
        </h1>
      </header>

      {/* Stats Cards Section */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", padding: "2rem 2rem 0 2rem" }}>
        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "var(--shadow)" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", display: "inline-flex", justifyContent: "center", alignItems: "center" }}>
            <Users size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Registered Technicians</h4>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-h)", marginTop: "0.2rem" }}>{totalStaffCount}</div>
          </div>
        </div>

        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "var(--shadow)" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.1)", color: "#6366f1", display: "inline-flex", justifyContent: "center", alignItems: "center" }}>
            <Award size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Expert Staff (&gt;= 4.2)</h4>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-h)", marginTop: "0.2rem" }}>{highPerformers}</div>
          </div>
        </div>

        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "var(--shadow)" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", display: "inline-flex", justifyContent: "center", alignItems: "center" }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Training Mandated (&lt; 3.5)</h4>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-h)", marginTop: "0.2rem" }}>{needTraining}</div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div style={{ display: "flex", flex: 1, padding: "2rem", gap: "2rem", flexWrap: "wrap" }}>
        
        {/* Left Side: Filter and Employee List */}
        <aside style={{ flex: "1 1 350px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1.5rem", boxShadow: "var(--shadow)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "var(--text-h)" }}>Staff Directory</h2>
            
            {/* Search Input */}
            <div style={{ position: "relative", marginBottom: "1rem" }}>
              <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search by ticket or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-h)",
                  fontSize: "0.875rem",
                }}
              />
            </div>

            {/* Filter by Designation */}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
              <button
                onClick={() => setSelectedDesignation("all")}
                style={{
                  padding: "0.3rem 0.75rem",
                  borderRadius: "9999px",
                  border: "1px solid " + (selectedDesignation === "all" ? "#10b981" : "var(--border-color)"),
                  background: selectedDesignation === "all" ? "rgba(16, 185, 129, 0.1)" : "none",
                  color: selectedDesignation === "all" ? "#10b981" : "var(--text-muted)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                All
              </button>
              {designations.map((desig) => (
                <button
                  key={desig}
                  onClick={() => setSelectedDesignation(desig)}
                  style={{
                    padding: "0.3rem 0.75rem",
                    borderRadius: "9999px",
                    border: "1px solid " + (selectedDesignation === desig ? "#10b981" : "var(--border-color)"),
                    background: selectedDesignation === desig ? "rgba(16, 185, 129, 0.1)" : "none",
                    color: selectedDesignation === desig ? "#10b981" : "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {desig}
                </button>
              ))}
            </div>

            {/* List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "450px", overflowY: "auto", paddingRight: "0.25rem" }}>
              {filteredStaff.map((emp) => {
                const avg = getAverageRating(emp.ticket_number);
                const isSelected = selectedStaff?.ticket_number === emp.ticket_number;
                return (
                  <div
                    key={emp.ticket_number}
                    onClick={() => setSelectedStaff(emp)}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: isSelected ? "rgba(16, 185, 129, 0.08)" : "var(--bg-secondary)",
                      border: "1px solid " + (isSelected ? "#10b981" : "var(--border-color)"),
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-h)" }}>{emp.name}</div>
                      <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem", alignItems: "center" }}>
                        <Briefcase size={12} /> {emp.designation_name} • #{emp.ticket_number}
                      </div>
                    </div>
                    
                    {/* Badge competency */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: avg >= 4.0 ? "#10b981" : avg >= 3.0 ? "#f59e0b" : "#ef4444",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <Star size={12} fill="currentColor" /> {avg || "N/A"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredStaff.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No technicians found in the registry.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right Side: Detailed Assessment Form */}
        <main style={{ flex: "2 1 500px", display: "flex", flexDirection: "column" }}>
          {selectedStaff ? (
            <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "2rem", boxShadow: "var(--shadow)", position: "relative" }}>
              
              {/* Header profile info */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-color)", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-h)", margin: 0 }}>{selectedStaff.name}</h3>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {selectedStaff.designation_name} • Ticket Number #{selectedStaff.ticket_number}
                  </p>
                </div>
                
                {/* Average Score Badge */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Overall Skill Score</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "1.75rem", fontWeight: 800, color: "var(--text-h)" }}>
                    <Star size={24} fill="#f59e0b" color="#f59e0b" /> {getAverageRating(selectedStaff.ticket_number)}
                  </div>
                </div>
              </div>

              {/* Success Notification */}
              {saveSuccess && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(34, 197, 94, 0.12)", color: "#16a34a", padding: "0.6rem 0.85rem", borderRadius: "6px", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
                  <CheckCircle size={16} /> Competency database updated in real-time.
                </div>
              )}

              {/* Skills rating sliders/stars */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-h)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Operational Skill Matrix</h4>
                
                {DEFAULT_SKILLS.map((skill) => {
                  const ratingVal = (assessments[selectedStaff.ticket_number] || {})[skill] || 3;
                  return (
                    <div
                      key={skill}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "10px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-h)" }}>{skill}</span>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            color: ratingVal >= 4 ? "#10b981" : ratingVal >= 3 ? "#f59e0b" : "#ef4444",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            background: ratingVal >= 4 ? "rgba(16, 185, 129, 0.1)" : ratingVal >= 3 ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          }}
                        >
                          {ratingVal === 5 ? "Expert (5/5)" : ratingVal === 4 ? "Proficient (4/5)" : ratingVal === 3 ? "Competent (3/5)" : ratingVal === 2 ? "Developing (2/5)" : "Needs Work (1/5)"}
                        </span>
                      </div>

                      {/* Interactive Stars */}
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            onClick={() => handleRatingChange(selectedStaff.ticket_number, skill, val)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              color: val <= ratingVal ? "#f59e0b" : "var(--text-muted)",
                            }}
                          >
                            <Star size={24} fill={val <= ratingVal ? "#f59e0b" : "none"} style={{ transition: "transform 0.15s ease" }} className="star-btn" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Assessment Warnings */}
              <div style={{ display: "flex", gap: "0.75rem", background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "8px", padding: "1rem", marginTop: "2rem" }}>
                <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text)", opacity: 0.85, lineHeight: 1.4 }}>
                  Adjusting these scores affects resource suggestions and allocation checks when booking staff in the shift scheduling wizard. Adjust ratings objectively based on shift performance reviews.
                </p>
              </div>

            </div>
          ) : (
            <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)", boxShadow: "var(--shadow)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <Users size={48} style={{ color: "var(--text-muted)", opacity: 0.5, marginBottom: "1rem" }} />
              <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-h)" }}>No Technician Selected</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", maxWidth: "340px", lineHeight: 1.4 }}>
                Please select a staff member from the left directory pane to view and manage their competency scorecards and skill assessments.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StaffAssessmentUI;
