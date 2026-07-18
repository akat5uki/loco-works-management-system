import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  ArrowLeft,
  Search,
  Star,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  RefreshCw,
  Layers,
  HelpCircle,
} from "lucide-react";
import api from "../../shared/services/api";

interface Job {
  job_id: number;
  job_description: string;
  stage: number;
}

interface RatingItem {
  job_id: number;
  rating: number;
}

interface ApprovedRating {
  job_id: number;
  job_description: string;
  stage: number;
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

const SelfAssessmentUI: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingsMap, setRatingsMap] = useState<{ [jobId: number]: number }>({});
  
  // Status from backend
  const [pending, setPending] = useState<PendingAssessment | null>(null);
  const [approvedRatings, setApprovedRatings] = useState<ApprovedRating[]>([]);
  const [msgSuccess, setMsgSuccess] = useState<string | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);

  const fetchAssessmentData = async () => {
    try {
      // 1. Fetch all jobs
      const jobsRes = await api.get("/jobs");
      setJobs(jobsRes.data);

      // 2. Fetch self assessment status
      const selfRes = await api.get("/assessments/self");
      const { pending: pendingData, approved: approvedData } = selfRes.data;
      
      setPending(pendingData);
      setApprovedRatings(approvedData);

      // 3. Initialize rating values map
      const initialMap: { [jobId: number]: number } = {};
      
      // Default all jobs to 0
      jobsRes.data.forEach((job: Job) => {
        initialMap[job.job_id] = 0;
      });

      // Fill in currently approved ratings if they exist
      if (approvedData && approvedData.length > 0) {
        approvedData.forEach((item: ApprovedRating) => {
          initialMap[item.job_id] = item.rating;
        });
      }

      // If there is a pending self-assessment, override with those values
      if (pendingData && pendingData.ratings) {
        pendingData.ratings.forEach((item: RatingItem) => {
          initialMap[item.job_id] = item.rating;
        });
      }

      setRatingsMap(initialMap);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setMsgError(err.response?.data?.detail || "Failed to load competency data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssessmentData();
  }, []);

  const handleStarClick = (jobId: number, rating: number) => {
    // If they click the same rating they currently have, toggle it to 0 (default/clear rating)
    const currentRating = ratingsMap[jobId] || 0;
    const nextRating = currentRating === rating ? 0 : rating;
    setRatingsMap({
      ...ratingsMap,
      [jobId]: nextRating,
    });
  };

  const handleResetToApproved = () => {
    const initialMap: { [jobId: number]: number } = {};
    jobs.forEach((job) => {
      initialMap[job.job_id] = 0;
    });
    approvedRatings.forEach((item) => {
      initialMap[item.job_id] = item.rating;
    });
    setRatingsMap(initialMap);
    setMsgSuccess("Reset ratings back to currently approved profile scores.");
    setTimeout(() => setMsgSuccess(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsgSuccess(null);
    setMsgError(null);

    const ratingsPayload: RatingItem[] = Object.keys(ratingsMap).map((key) => ({
      job_id: parseInt(key),
      rating: ratingsMap[parseInt(key)] || 0,
    }));

    try {
      await api.post("/assessments/self", { ratings: ratingsPayload });
      setMsgSuccess("Self-assessment submitted successfully! Sent to supervisors for approval.");
      await fetchAssessmentData(); // Refresh to show pending status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setMsgError(err.response?.data?.detail || "Failed to submit self-assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredJobs = jobs.filter((job) =>
    job.job_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.job_id.toString().includes(searchQuery)
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
        Loading self-assessment portal...
      </div>
    );
  }

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
          <Award size={20} color="#8b5cf6" /> Self Competency Assessment
        </h1>
      </header>

      {/* Main Container */}
      <div style={{ display: "flex", flex: 1, padding: "2rem", gap: "2rem", flexWrap: "wrap" }}>
        
        {/* Left Side: Status and Instructions */}
        <aside style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Status Panel */}
          <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1.5rem", boxShadow: "var(--shadow)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "var(--text-h)" }}>Approval Status</h2>
            
            {pending ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  padding: "1rem",
                  borderRadius: "8px",
                  background: "rgba(245, 158, 11, 0.08)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#f59e0b", fontWeight: 700, fontSize: "0.9rem" }}>
                  <Clock size={18} /> Pending Review
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  Submitted on {new Date(pending.submitted_at).toLocaleDateString()} at {new Date(pending.submitted_at).toLocaleTimeString()}.
                </p>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Your submission is waiting for supervisor verification. You can modify your ratings and resubmit if needed.
                </span>
              </div>
            ) : approvedRatings.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  padding: "1rem",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#10b981", fontWeight: 700, fontSize: "0.9rem" }}>
                  <CheckCircle size={18} /> Profile Approved
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  Your competency record is approved and active in the database.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  padding: "1rem",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", fontWeight: 700, fontSize: "0.9rem" }}>
                  <HelpCircle size={18} /> No Active Rating
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  You have not submitted a self-assessment yet. Please rate your skills in the panel on the right.
                </p>
              </div>
            )}
          </div>

          {/* Guidelines */}
          <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "1.5rem", boxShadow: "var(--shadow)" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", color: "var(--text-h)" }}>Guidelines</h2>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "0.6rem", lineHeight: 1.4 }}>
              <li>Rate your skills honestly between <strong>1 (Basic)</strong> and <strong>5 (Expert)</strong>.</li>
              <li>Select <strong>0 stars</strong> (or click an active star to toggle off) if you do not have capability or experience for that job.</li>
              <li>Your self-assessment goes to the Supervisors. They can edit and adjust your ratings before final database signoff.</li>
              <li>Approved ratings are visible in the shift scheduling wizard to help assign compatible staff to locos.</li>
            </ul>
          </div>

          {/* Security Alert */}
          <div style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "12px", padding: "1.25rem", display: "flex", gap: "0.75rem" }}>
            <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
            <div>
              <h4 style={{ margin: "0 0 0.25rem 0", color: "#f59e0b", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase" }}>Audit Notice</h4>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text)", opacity: 0.85, lineHeight: 1.4 }}>
                All rating approval transactions are written to the partitioned `audit_logs` database ledger. Misrepresentation may trigger review.
              </p>
            </div>
          </div>
        </aside>

        {/* Right Side: Interactive Assessment Form */}
        <main style={{ flex: "2 1 600px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          <div style={{ background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "2rem", boxShadow: "var(--shadow)" }}>
            
            {/* Form Top Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "1.25rem", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-h)", margin: 0 }}>Operational Skill Matrix</h3>
                <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Assign your self-assessed capability scores across works categories.
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {approvedRatings.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetToApproved}
                    style={{
                      padding: "0.5rem 0.85rem",
                      borderRadius: "6px",
                      background: "none",
                      border: "1px solid var(--border-color)",
                      color: "var(--text)",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                    }}
                  >
                    <RefreshCw size={14} /> Reset to Approved
                  </button>
                )}
              </div>
            </div>

            {/* Notifications */}
            {msgSuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(34, 197, 94, 0.12)", color: "#16a34a", padding: "0.75rem 1rem", borderRadius: "6px", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                <CheckCircle size={16} /> {msgSuccess}
              </div>
            )}
            {msgError && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", padding: "0.75rem 1rem", borderRadius: "6px", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                <AlertTriangle size={16} /> {msgError}
              </div>
            )}

            {/* Search filter for jobs */}
            <div style={{ position: "relative", marginBottom: "1.5rem" }}>
              <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search job description or stage..."
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

            {/* Jobs list form */}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "480px", overflowY: "auto", paddingRight: "0.25rem" }}>
                {filteredJobs.map((job) => {
                  const ratingVal = ratingsMap[job.job_id] || 0;
                  return (
                    <div
                      key={job.job_id}
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "10px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-h)" }}>
                          {job.job_description}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                          <Layers size={11} /> Target Stage: Stage {job.stage} • Job #{job.job_id}
                        </span>
                      </div>

                      {/* Stars Selector & Text Indicator */}
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: ratingVal > 0 ? "var(--text)" : "var(--text-muted)" }}>
                          {ratingVal === 0 ? "0 (Unrated)" : `${ratingVal} Stars`}
                        </span>
                        
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleStarClick(job.job_id, val)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                color: val <= ratingVal ? "#f59e0b" : "var(--text-muted)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Star size={20} fill={val <= ratingVal ? "#f59e0b" : "none"} style={{ transition: "transform 0.1s ease" }} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredJobs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)", fontSize: "0.88rem" }}>
                    No matching jobs found. Try typing another search term.
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "1.25rem" }}>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "0.6rem 1.25rem",
                    borderRadius: "6px",
                    background: "#8b5cf6",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: submitting ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    boxShadow: "0 4px 12px rgba(139, 92, 246, 0.2)",
                  }}
                >
                  <Send size={16} /> {submitting ? "Submitting..." : pending ? "Resubmit Self-Assessment" : "Submit Self-Assessment"}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SelfAssessmentUI;
