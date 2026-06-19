import { useEffect, useState } from "react";

import { Link } from "react-router-dom";
import {
  BarChart,
  Gauge,
  Users,
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

interface LocoTypeCount {
  loco_type_id: number;
  loco_type_name: string;
  total: number;
  active: number;
  despatched: number;
}

interface EmployeeStats {
  total: number;
  by_designation: {
    designation_name: string;
    category_name: string;
    count: number;
  }[];
}

const LandingPage = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [typeCounts, setTypeCounts] = useState<LocoTypeCount[]>([]);
  const [empStats, setEmpStats] = useState<EmployeeStats | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, typeCountsRes, empStatsRes] = await Promise.all([
          api.get("/locos/stats/production"),
          api.get("/locos/type-counts"),
          api.get("/employees/stats"),
        ]);
        setStats(statsRes.data);
        setTypeCounts(typeCountsRes.data);
        setEmpStats(empStatsRes.data);
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

          {/* Loco Types Card — with per-type counts */}
          <div className="card">
            <div className="card-header">
              <div className="icon-bg bg-green-50">
                <Gauge size={20} />
              </div>
              <h3 className="card-title">Locomotive Types</h3>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {typeCounts.slice(0, 7).map((t) => (
                <li
                  key={t.loco_type_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    fontSize: "0.875rem",
                    marginBottom: "0.65rem",
                    minWidth: 0,
                  }}
                >
                  {/* Left: icon + name */}
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
                    <ChevronRight size={13} style={{ color: "#d1d5db", flexShrink: 0 }} />
                    <span style={{
                      color: "var(--text-h)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {t.loco_type_name}
                    </span>
                  </span>

                  {/* Right: count pills — never shrink or wrap */}
                  <span style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexShrink: 0 }}>
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 700, lineHeight: 1,
                      padding: "0.2rem 0.5rem", borderRadius: "9999px",
                      background: "rgba(16,185,129,0.12)", color: "#10b981",
                      whiteSpace: "nowrap",
                    }} title="Active locos">
                      ● {t.active}
                    </span>
                    {t.despatched > 0 && (
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 700, lineHeight: 1,
                        padding: "0.2rem 0.5rem", borderRadius: "9999px",
                        background: "rgba(239,68,68,0.10)", color: "#ef4444",
                        whiteSpace: "nowrap",
                      }} title="Despatched locos">
                        ✈ {t.despatched}
                      </span>
                    )}
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 700, lineHeight: 1,
                      padding: "0.2rem 0.5rem", borderRadius: "9999px",
                      background: "var(--accent-bg)", color: "var(--accent)",
                      whiteSpace: "nowrap",
                    }} title="Total">
                      {t.total}
                    </span>
                  </span>
                </li>
              ))}
              {typeCounts.length > 7 && (
                <li style={{ fontSize: "0.75rem", color: "#9ca3af", fontStyle: "italic", paddingLeft: "1.5rem" }}>
                  & {typeCounts.length - 7} more types...
                </li>
              )}
              {typeCounts.length === 0 && (
                <p style={{ fontSize: "0.875rem", color: "#9ca3af", fontStyle: "italic" }}>
                  No types listed
                </p>
              )}
            </ul>
          </div>

          {/* Active Employees Card */}
          <div className="card">
            <div className="card-header">
              <div className="icon-bg bg-orange-50">
                <Users size={20} />
              </div>
              <h3 className="card-title">
                Active Employees
                {empStats && (
                  <span style={{
                    marginLeft: "0.6rem",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.55rem",
                    borderRadius: "9999px",
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                    verticalAlign: "middle",
                  }}>
                    {empStats.total}
                  </span>
                )}
              </h3>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {empStats?.by_designation.slice(0, 7).map((d) => (
                <li
                  key={d.designation_name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.875rem",
                    marginBottom: "0.55rem",
                  }}
                >
                  <span style={{ color: "var(--text-h)" }}>{d.designation_name}</span>
                  <span style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 700,
                      padding: "0.1rem 0.45rem", borderRadius: "9999px",
                      background: "rgba(99,102,241,0.10)", color: "#6366f1",
                    }}>
                      {d.category_name}
                    </span>
                    <span style={{
                      fontSize: "0.75rem", fontWeight: 700, minWidth: "1.5rem",
                      textAlign: "right", color: "var(--text-h)",
                    }}>
                      {d.count}
                    </span>
                  </span>
                </li>
              ))}
              {(empStats?.by_designation.length ?? 0) > 7 && (
                <li style={{ fontSize: "0.75rem", color: "#9ca3af", fontStyle: "italic", textAlign: "center", marginTop: "0.5rem" }}>
                  + {(empStats?.by_designation.length ?? 0) - 7} more designations...
                </li>
              )}
              {(!empStats || empStats.total === 0) && (
                <p style={{ fontSize: "0.875rem", color: "#9ca3af", fontStyle: "italic" }}>
                  No employees registered
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
          &copy; 2026 Loco Works Management System. Built with FastAPI &amp; React.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
