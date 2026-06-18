import { useEffect, useState } from "react";

import { Link } from "react-router-dom";
import {
  BarChart,
  Gauge,
  Briefcase,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import "./LandingPage.css";

interface Stats {
  year_wise: { year: number; count: number }[];
  month_wise: { month: number; count: number }[];
}

interface LocoType {
  loco_type_id: number;
  loco_type_name: string;
}

interface Job {
  job_id: number;
  job_description: string;
  stage: number;
}

const LandingPage = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [types, setTypes] = useState<LocoType[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, typesRes, jobsRes] = await Promise.all([
          api.get("/locos/stats/production"),
          api.get("/locos/types"),
          api.get("/locos/ongoing-jobs"),
        ]);
        setStats(statsRes.data);
        setTypes(typesRes.data);
        setJobs(jobsRes.data);
      } catch (error) {
        console.error("Error fetching landing data", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="landing-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div className="logo-box">L</div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "700", margin: 0 }}>
              LocoWorks
            </h1>
          </div>
          <nav className="nav-links" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link to="/login" className="nav-link">
              Login
            </Link>
            <Link to="/login" className="btn-primary">
              Get Started
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div style={{ maxWidth: "80rem", margin: "0 auto", padding: "0 1rem" }}>
          <h2 className="hero-sub">Loco Management System</h2>
          <p className="hero-title">
            Precision Engineering, Managed Efficiently.
          </p>
          <p className="hero-desc">
            Real-time insights into locomotive production, staff allocations,
            and ongoing workshop jobs.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="main-content">
        <div className="grid">
          {/* Production Stats Card */}
          <div className="card">
            <div className="card-header">
              <div className="icon-bg bg-blue-50">
                <BarChart size={20} />
              </div>
              <h3 className="card-title">Production Stats</h3>
            </div>
            <div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  marginBottom: "0.5rem",
                }}
              >
                Yearly Overview
              </p>
              {stats?.year_wise.map((s) => (
                <div key={s.year} className="stat-item">
                  <span style={{ color: "#4b5563" }}>Year {s.year}</span>
                  <span style={{ fontWeight: "700" }}>{s.count} Locos</span>
                </div>
              ))}
              {(!stats || stats.year_wise.length === 0) && (
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#9ca3af",
                    fontStyle: "italic",
                  }}
                >
                  No data yet
                </p>
              )}
            </div>
          </div>

          {/* Loco Types Card */}
          <div className="card">
            <div className="card-header">
              <div className="icon-bg bg-green-50">
                <Gauge size={20} />
              </div>
              <h3 className="card-title">Locomotive Types</h3>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {types.slice(0, 6).map((t) => (
                <li
                  key={t.loco_type_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.875rem",
                    color: "#4b5563",
                    marginBottom: "0.5rem",
                  }}
                >
                  <ChevronRight size={14} style={{ color: "#d1d5db" }} />
                  <span>{t.loco_type_name}</span>
                </li>
              ))}
              {types.length > 6 && (
                <li
                  style={{
                    fontSize: "0.75rem",
                    color: "#9ca3af",
                    fontStyle: "italic",
                    paddingLeft: "1.5rem",
                  }}
                >
                  & more...
                </li>
              )}
              {types.length === 0 && (
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#9ca3af",
                    fontStyle: "italic",
                  }}
                >
                  No types listed
                </p>
              )}
            </ul>
          </div>

          {/* Ongoing Jobs Card */}
          <div className="card">
            <div className="card-header">
              <div className="icon-bg bg-orange-50">
                <Briefcase size={20} />
              </div>
              <h3 className="card-title">Ongoing Jobs</h3>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {jobs.slice(0, 6).map((j) => (
                <li
                  key={j.job_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.875rem",
                    color: "#4b5563",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span>{j.job_description}</span>
                  <span className="badge badge-orange">Stage {j.stage}</span>
                </li>
              ))}
              {jobs.length > 6 && (
                <li
                  style={{
                    fontSize: "0.75rem",
                    color: "#9ca3af",
                    fontStyle: "italic",
                    textAlign: "center",
                    marginTop: "0.5rem",
                  }}
                >
                  + {jobs.length - 6} more jobs...
                </li>
              )}
              {jobs.length === 0 && (
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#9ca3af",
                    fontStyle: "italic",
                  }}
                >
                  No active jobs
                </p>
              )}
            </ul>
          </div>
        </div>

        {/* Quick Links */}
        <div className="quick-links">
          <h3 className="quick-links-title">Quick Access</h3>
          <div className="link-grid">
            <Link to="/login" className="link-tile">
              <LayoutDashboard
                size={24}
                style={{ marginBottom: "0.5rem", color: "#9ca3af" }}
              />
              <span style={{ fontSize: "0.875rem", fontWeight: "500" }}>
                Dashboard
              </span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div style={{ maxWidth: "80rem", margin: "0 auto", padding: "0 1rem" }}>
          &copy; 2026 Loco Works Management System. Built with FastAPI & React.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
