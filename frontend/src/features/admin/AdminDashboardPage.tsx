import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Users, Layers, ShieldCheck, UserPlus, LogOut } from "lucide-react";
import ThemeToggle from "../../shared/components/ThemeToggle";
import RegistrationRequestsManager from "./components/RegistrationRequestsManager";
import MasterDataCrudWizard from "./components/MasterDataCrudWizard";
import AuditLogsViewer from "./components/AuditLogsViewer";
import AdminStaffManager from "./components/AdminStaffManager";
import api from "../../shared/services/api";
import "./AdminDashboard.css";

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<"requests" | "crud" | "audit" | "admins">("requests");

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      console.error(e);
    }
    navigate("/admin/login");
  };

  return (
    <div className="employees-booking-workspace">
      {/* Workspace Header */}
      <header className="workspace-header">
        <div className="header-actions">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="admin-icon-badge" style={{ width: 40, height: 40, marginBottom: 0 }}>
              <ShieldAlert size={22} color="var(--primary-color)" />
            </div>
            <div>
              <h1 style={{ fontSize: "1.2rem", margin: 0 }}>Administrator Control Center</h1>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 }}>Loco Works Management System</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="action-btn-danger"
              style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem", borderRadius: "6px" }}
            >
              <LogOut size={16} /> Admin Logout
            </button>
          </div>
        </div>
      </header>

      {/* Admin Primary Navigation Bar */}
      <nav className="workspace-nav" style={{ padding: "0.75rem 1.5rem", background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)", display: "flex", gap: "0.5rem", overflowX: "auto" }}>
        <button
          className={`nav-tab-btn ${activeView === "requests" ? "active" : ""}`}
          onClick={() => setActiveView("requests")}
        >
          <Users size={18} /> Registration Verification Requests
        </button>
        <button
          className={`nav-tab-btn ${activeView === "crud" ? "active" : ""}`}
          onClick={() => setActiveView("crud")}
        >
          <Layers size={18} /> Master Data CRUD Wizard
        </button>
        <button
          className={`nav-tab-btn ${activeView === "audit" ? "active" : ""}`}
          onClick={() => setActiveView("audit")}
        >
          <ShieldCheck size={18} /> System Audit Logs (Read-Only)
        </button>
        <button
          className={`nav-tab-btn ${activeView === "admins" ? "active" : ""}`}
          onClick={() => setActiveView("admins")}
        >
          <UserPlus size={18} /> Admin Personnel Management
        </button>
      </nav>

      {/* Main Workspace Body */}
      <main className="workspace-body" style={{ padding: "1.5rem" }}>
        {activeView === "requests" && <RegistrationRequestsManager />}
        {activeView === "crud" && <MasterDataCrudWizard />}
        {activeView === "audit" && <AuditLogsViewer />}
        {activeView === "admins" && <AdminStaffManager />}
      </main>
    </div>
  );
};

export default AdminDashboardPage;
