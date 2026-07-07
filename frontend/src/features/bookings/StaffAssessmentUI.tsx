import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  ArrowLeft,
  Briefcase,
  Star,
  CheckCircle,
  Award,
  AlertTriangle,
  Layers,
  Clock,
  Check,
  X,
  Trash2,
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

interface Job {
  job_id: number;
  job_description: string;
  stage: number;
}

interface RatingItem {
  job_id: number;
  rating: number;
}

interface PendingAssessment {
  ticket_number: number;
  name: string;
  designation_name: string;
  ratings: RatingItem[];
  submitted_at: string;
  status: string;
}

const StaffAssessmentUI: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"approved" | "pending">("approved");
  
  // Master lists
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pendingList, setPendingList] = useState<PendingAssessment[]>([]);

  // Selection state
  const [selectedStaff, setSelectedStaff] = useState<Employee | null>(null);
  const [selectedPending, setSelectedPending] = useState<PendingAssessment | null>(null);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDesignation, setSelectedDesignation] = useState("all");

  // Ratings edit map (job_id -> rating)
  const [ratingsMap, setRatingsMap] = useState<{ [jobId: number]: number }>({});
  
  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionRemarks, setRejectionRemarks] = useState("");

  // Feedback notifications
  const [msgSuccess, setMsgSuccess] = useState<string | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchRegistryData = async () => {
    try {
      // 1. Fetch jobs
      const jobsRes = await api.get("/jobs");
      setJobs(jobsRes.data);

      // 2. Fetch employees (only Staff category, category_id !== 1)
      const empRes = await api.get("/employees");
      const staffOnly = empRes.data.filter((emp: Employee) => emp.category_id !== 1);
      setEmployees(staffOnly);

      // 3. Fetch pending self assessments
      const pendingRes = await api.get("/assessments/pending");
      setPendingList(pendingRes.data);
    } catch (err: any) {
      setMsgError(err.response?.data?.detail || "Failed to load database records.");
    }
  };

  useEffect(() => {
    fetchRegistryData();
  }, []);

  // Fetch ratings when selecting a staff member in Approved tab
  useEffect(() => {
    if (!selectedStaff) {
      setRatingsMap({});
      return;
    }

    const fetchStaffRatings = async () => {
      try {
        const res = await api.get(`/assessments/ratings/${selectedStaff.ticket_number}`);
        const map: { [jobId: number]: number } = {};
        
        // Default all jobs to 0
        jobs.forEach((j) => {
          map[j.job_id] = 0;
        });

        // Load database ratings
        res.data.forEach((item: any) => {
          map[item.job_id] = item.rating;
        });

        setRatingsMap(map);
      } catch (err: any) {
        setMsgError("Failed to fetch ratings for selected staff.");
      }
    };

    fetchStaffRatings();
  }, [selectedStaff, jobs]);

  // Load ratings map when selecting a pending self assessment
  useEffect(() => {
    if (!selectedPending) {
      setRatingsMap({});
      return;
    }

    const map: { [jobId: number]: number } = {};
    // Default all jobs to 0
    jobs.forEach((j) => {
      map[j.job_id] = 0;
    });

    // Load proposed ratings
    selectedPending.ratings.forEach((item) => {
      map[item.job_id] = item.rating;
    });

    setRatingsMap(map);
  }, [selectedPending, jobs]);

  const handleStarClick = (jobId: number, rating: number) => {
    const currentRating = ratingsMap[jobId] || 0;
    const nextRating = currentRating === rating ? 0 : rating;
    setRatingsMap({
      ...ratingsMap,
      [jobId]: nextRating,
    });
  };

  // Submit direct updates to DB (Approved tab)
  const handleSaveDirect = async () => {
    if (!selectedStaff) return;
    setSaveLoading(true);
    setMsgSuccess(null);
    setMsgError(null);

    const ratingsPayload = Object.keys(ratingsMap).map((key) => ({
      job_id: parseInt(key),
      rating: ratingsMap[parseInt(key)] || 0,
    }));

    try {
      await api.post(`/assessments/ratings/${selectedStaff.ticket_number}`, { ratings: ratingsPayload });
      setMsgSuccess(`Directly updated competency ratings for ${selectedStaff.name}.`);
      
      // Update local employees list with new average calculation if necessary
      await fetchRegistryData();
      
      setTimeout(() => setMsgSuccess(null), 3000);
    } catch (err: any) {
      setMsgError(err.response?.data?.detail || "Failed to update ratings.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Delete all ratings for selected staff
  const handleDeleteAll = async () => {
    if (!selectedStaff) return;
    if (!window.confirm(`Are you sure you want to delete ALL competency ratings for ${selectedStaff.name}?`)) {
      return;
    }

    setSaveLoading(true);
    setMsgSuccess(null);
    setMsgError(null);

    try {
      await api.delete(`/assessments/ratings/${selectedStaff.ticket_number}`);
      setMsgSuccess(`Successfully cleared all ratings for ${selectedStaff.name}.`);
      
      const resetMap: { [jobId: number]: number } = {};
      jobs.forEach((j) => {
        resetMap[j.job_id] = 0;
      });
      setRatingsMap(resetMap);
      
      await fetchRegistryData();
      setTimeout(() => setMsgSuccess(null), 3000);
    } catch (err: any) {
      setMsgError("Failed to clear ratings database records.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Approve pending self-assessment (with optional edits)
  const handleApprove = async () => {
    if (!selectedPending) return;
    setSaveLoading(true);
    setMsgSuccess(null);
    setMsgError(null);

    const ratingsPayload = Object.keys(ratingsMap).map((key) => ({
      job_id: parseInt(key),
      rating: ratingsMap[parseInt(key)] || 0,
    }));

    try {
      await api.post(`/assessments/approve/${selectedPending.ticket_number}`, { ratings: ratingsPayload });
      setMsgSuccess(`Self-assessment for ${selectedPending.name} approved successfully.`);
      
      setSelectedPending(null);
      await fetchRegistryData();
      setTimeout(() => setMsgSuccess(null), 3000);
    } catch (err: any) {
      setMsgError(err.response?.data?.detail || "Failed to approve assessment.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Reject pending self-assessment
  const handleRejectConfirm = async () => {
    if (!selectedPending) return;
    setSaveLoading(true);
    setMsgSuccess(null);
    setMsgError(null);

    try {
      await api.post(`/assessments/reject/${selectedPending.ticket_number}`, { remarks: rejectionRemarks });
      setMsgSuccess(`Self-assessment for ${selectedPending.name} has been rejected.`);
      
      setShowRejectModal(false);
      setRejectionRemarks("");
      setSelectedPending(null);
      await fetchRegistryData();
      
      setTimeout(() => setMsgSuccess(null), 3000);
    } catch (err: any) {
      setMsgError(err.response?.data?.detail || "Failed to reject assessment.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Helper helper average calc
  const getAverageRating = (ticketNo: number): number => {
    // If pending list, calculate from pending ratings
    const pend = pendingList.find((p) => p.ticket_number === ticketNo);
    if (pend) {
      if (pend.ratings.length === 0) return 0;
      return parseFloat((pend.ratings.reduce((a, b) => a + b.rating, 0) / pend.ratings.length).toFixed(1));
    }
    return 0; // The parent list will display real average database values.
  };

  // Filter staff registry list (Direct CRUD tab)
  const filteredStaff = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.ticket_number.toString().includes(searchQuery);
    const matchesDesig = selectedDesignation === "all" || emp.designation_name === selectedDesignation;
    return matchesSearch && matchesDesig;
  });

  // Filter pending requests list
  const filteredPending = pendingList.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ticket_number.toString().includes(searchQuery)
  );

  // Unique designations for filter chips
  const designations = Array.from(new Set(employees.map((emp) => emp.designation_name)));

  // Calculate Metrics
  const totalStaffCount = employees.length;
  const pendingRequestsCount = pendingList.length;

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
          <Users size={20} color="#10b981" /> Staff Competency Manager
        </h1>
      </header>

      {/* Tabs Selector Navigation */}
      <nav
        style={{
          padding: "0.75rem 2rem",
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          gap: "1rem",
        }}
      >
        <button
          onClick={() => {
            setActiveTab("approved");
            setSelectedPending(null);
            setSearchQuery("");
          }}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            border: "none",
            background: activeTab === "approved" ? "rgba(16, 185, 129, 0.1)" : "none",
            color: activeTab === "approved" ? "#10b981" : "var(--text-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Award size={16} /> Direct Ratings CRUD Management
        </button>

        <button
          onClick={() => {
            setActiveTab("pending");
            setSelectedStaff(null);
            setSearchQuery("");
          }}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            border: "none",
            background: activeTab === "pending" ? "rgba(245, 158, 11, 0.1)" : "none",
            color: activeTab === "pending" ? "#f59e0b" : "var(--text-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Clock size={16} /> Pending Self-Assessments ({pendingRequestsCount})
        </button>
      </nav>

      {/* Stats Cards Section */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", padding: "1.5rem 2rem 0 2rem" }}>
        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "var(--shadow)" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", display: "inline-flex", justifyContent: "center", alignItems: "center" }}>
            <Users size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Registered Technicians</h4>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-h)", marginTop: "0.1rem" }}>{totalStaffCount}</div>
          </div>
        </div>

        <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", boxShadow: "var(--shadow)" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", display: "inline-flex", justifyContent: "center", alignItems: "center" }}>
            <Clock size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Pending Self-Assessments</h4>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text-h)", marginTop: "0.1rem" }}>{pendingRequestsCount}</div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div style={{ display: "flex", flex: 1, padding: "1.5rem 2rem 2rem 2rem", gap: "2rem", flexWrap: "wrap" }}>
        
        {/* Left Side: Directory Sidebar */}
        <aside style={{ flex: "1 1 350px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1.5rem", boxShadow: "var(--shadow)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "var(--text-h)" }}>
              {activeTab === "approved" ? "Staff Directory" : "Pending Reviews"}
            </h2>
            
            {/* Search Input */}
            <div style={{ position: "relative", marginBottom: "1rem" }}>
              <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder={activeTab === "approved" ? "Search name or ticket..." : "Search pending reviews..."}
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

            {/* Filter chips (Only in Approved direct view) */}
            {activeTab === "approved" && (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
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
            )}

            {/* Directory List Container */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "420px", overflowY: "auto", paddingRight: "0.25rem" }}>
              {activeTab === "approved" ? (
                filteredStaff.map((emp) => {
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
                    </div>
                  );
                })
              ) : (
                filteredPending.map((p) => {
                  const isSelected = selectedPending?.ticket_number === p.ticket_number;
                  const avg = getAverageRating(p.ticket_number);
                  return (
                    <div
                      key={p.ticket_number}
                      onClick={() => setSelectedPending(p)}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        background: isSelected ? "rgba(245, 158, 11, 0.08)" : "var(--bg-secondary)",
                        border: "1px solid " + (isSelected ? "#f59e0b" : "var(--border-color)"),
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-h)" }}>{p.name}</div>
                        <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem", alignItems: "center" }}>
                          <Briefcase size={12} /> {p.designation_name} • #{p.ticket_number}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "#f59e0b",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <Star size={12} fill="currentColor" /> {avg}
                      </span>
                    </div>
                  );
                })
              )}

              {((activeTab === "approved" && filteredStaff.length === 0) ||
                (activeTab === "pending" && filteredPending.length === 0)) && (
                <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No records found matching criteria.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right Side: Detailed Editor/Review Dashboard */}
        <main style={{ flex: "2 1 500px", display: "flex", flexDirection: "column" }}>
          
          {/* Notifications */}
          {msgSuccess && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(34, 197, 94, 0.12)", color: "#16a34a", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              <CheckCircle size={16} /> {msgSuccess}
            </div>
          )}
          {msgError && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", padding: "0.75rem 1rem", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              <AlertTriangle size={16} /> {msgError}
            </div>
          )}

          {activeTab === "approved" && selectedStaff ? (
            <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "2rem", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* Header profile info */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-color)", paddingBottom: "1.25rem", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-h)", margin: 0 }}>{selectedStaff.name}</h3>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {selectedStaff.designation_name} • Ticket ID #{selectedStaff.ticket_number}
                  </p>
                </div>
                
                {/* Actions */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={handleDeleteAll}
                    disabled={saveLoading}
                    style={{
                      padding: "0.5rem 0.85rem",
                      borderRadius: "6px",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      color: "#ef4444",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                    }}
                  >
                    <Trash2 size={14} /> Clear All Ratings
                  </button>
                  
                  <button
                    onClick={handleSaveDirect}
                    disabled={saveLoading}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "6px",
                      background: "#10b981",
                      border: "none",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                    }}
                  >
                    <Check size={14} /> {saveLoading ? "Saving..." : "Save Ratings"}
                  </button>
                </div>
              </div>

              {/* Ratings List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "400px", overflowY: "auto", paddingRight: "0.25rem" }}>
                {jobs.map((job) => {
                  const ratingVal = ratingsMap[job.job_id] || 0;
                  return (
                    <div
                      key={job.job_id}
                      style={{
                        padding: "0.85rem 1.25rem",
                        borderRadius: "8px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-h)" }}>
                          {job.job_description}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                          <Layers size={11} /> Target Stage: Stage {job.stage}
                        </span>
                      </div>

                      {/* Interactive Stars */}
                      <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginRight: "0.4rem" }}>
                          {ratingVal === 0 ? "0 (Unrated)" : `${ratingVal} Stars`}
                        </span>
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            onClick={() => handleStarClick(job.job_id, val)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              color: val <= ratingVal ? "#f59e0b" : "var(--text-muted)",
                            }}
                          >
                            <Star size={18} fill={val <= ratingVal ? "#f59e0b" : "none"} />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : activeTab === "pending" && selectedPending ? (
            <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "2rem", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* Header profile info */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-color)", paddingBottom: "1.25rem", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-h)", margin: 0 }}>Reviewing {selectedPending.name}</h3>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    {selectedPending.designation_name} • Ticket ID #{selectedPending.ticket_number}
                  </p>
                </div>
                
                {/* Actions */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={saveLoading}
                    style={{
                      padding: "0.5rem 0.85rem",
                      borderRadius: "6px",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      color: "#ef4444",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                    }}
                  >
                    <X size={14} /> Reject
                  </button>
                  
                  <button
                    onClick={handleApprove}
                    disabled={saveLoading}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "6px",
                      background: "#10b981",
                      border: "none",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                    }}
                  >
                    <Check size={14} /> Approve & Save
                  </button>
                </div>
              </div>

              {/* Proposed ratings list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "400px", overflowY: "auto", paddingRight: "0.25rem" }}>
                {jobs.map((job) => {
                  const ratingVal = ratingsMap[job.job_id] || 0;
                  const originalVal = (selectedPending.ratings.find((r) => r.job_id === job.job_id))?.rating || 0;
                  const isModified = ratingVal !== originalVal;
                  
                  return (
                    <div
                      key={job.job_id}
                      style={{
                        padding: "0.85rem 1.25rem",
                        borderRadius: "8px",
                        background: isModified ? "rgba(99, 102, 241, 0.04)" : "var(--bg-secondary)",
                        border: "1px solid " + (isModified ? "rgba(99, 102, 241, 0.3)" : "var(--border-color)"),
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-h)" }}>
                          {job.job_description}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                          <Layers size={11} /> Target Stage: Stage {job.stage}
                          {isModified && <span style={{ color: "#6366f1", marginLeft: "0.5rem" }}>(Edited by Supervisor)</span>}
                        </span>
                      </div>

                      {/* Stars Selector */}
                      <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginRight: "0.4rem" }}>
                          {ratingVal === 0 ? "0 (Unrated)" : `${ratingVal} Stars`}
                        </span>
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            onClick={() => handleStarClick(job.job_id, val)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              color: val <= ratingVal ? "#f59e0b" : "var(--text-muted)",
                            }}
                          >
                            <Star size={18} fill={val <= ratingVal ? "#f59e0b" : "none"} />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)", boxShadow: "var(--shadow)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <Users size={48} style={{ color: "var(--text-muted)", opacity: 0.5, marginBottom: "1rem" }} />
              <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-h)" }}>
                {activeTab === "approved" ? "No Technician Selected" : "No Pending Review Selected"}
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", maxWidth: "340px", lineHeight: 1.4 }}>
                {activeTab === "approved"
                  ? "Please select a staff member from the left directory to view, edit, or clear their active competency scores."
                  : "Please select a pending self-assessment request from the left list to review, edit, approve, or reject."}
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Rejection Remarks Dialog Modal */}
      {showRejectModal && selectedPending && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowRejectModal(false)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              padding: "2rem",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "var(--shadow)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "var(--text-h)" }}>
              Reject Self-Assessment
            </h3>
            
            <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
              Specify the reasons or feedback for rejecting <strong>{selectedPending.name}</strong>'s self-assessment request. This message will be sent directly to their notifications dashboard.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label htmlFor="rejectionRemarksInput" style={{ fontSize: "0.8rem", fontWeight: 600 }}>Rejection Remarks / Feedback</label>
              <textarea
                id="rejectionRemarksInput"
                placeholder="e.g. Please reassess your traction motor calibration rating after practical trials."
                value={rejectionRemarks}
                onChange={(e) => setRejectionRemarks(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "100px",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-h)",
                  fontSize: "0.875rem",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionRemarks("");
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  background: "none",
                  color: "var(--text-h)",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={saveLoading}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  background: "#ef4444",
                  border: "none",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffAssessmentUI;
