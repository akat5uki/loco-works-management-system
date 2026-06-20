import { useNavigate } from "react-router-dom";
import { LogIn, Home, AlertTriangle } from "lucide-react";
import ThemeToggle from "../../shared/components/ThemeToggle";

const SessionExpiredPage = () => {
  const navigate = useNavigate();

  return (
    <div className="expired-container" style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--bg-secondary)",
      padding: "1rem",
      position: "relative",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{ position: "absolute", top: "1.5rem", right: "1.5rem" }}>
        <ThemeToggle />
      </div>

      <style>{`
        .expired-card {
          background: var(--bg-card);
          padding: 3rem;
          border-radius: 1rem;
          box-shadow: var(--shadow);
          border: 1px solid var(--border);
          width: 100%;
          max-width: 440px;
          text-align: center;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .station-clock-wrapper {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
        }
        
        .station-clock {
          width: 110px;
          height: 110px;
          border: 6px solid var(--accent);
          border-radius: 50%;
          position: relative;
          background: var(--bg-card);
          box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
        }
        
        .clock-center {
          width: 8px;
          height: 8px;
          background: var(--text-h);
          border-radius: 50%;
          position: absolute;
          top: 45px;
          left: 45px;
          z-index: 10;
        }

        .clock-hand-hour {
          width: 4px;
          height: 25px;
          background: var(--text-h);
          position: absolute;
          top: 25px;
          left: 47px;
          transform-origin: bottom center;
          animation: clock-spin 10s linear infinite;
        }

        .clock-hand-minute {
          width: 3px;
          height: 38px;
          background: var(--accent);
          position: absolute;
          top: 12px;
          left: 47.5px;
          transform-origin: bottom center;
          animation: clock-spin 1.5s linear infinite;
        }

        @keyframes clock-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .expired-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-h);
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .expired-desc {
          color: var(--text);
          font-size: 0.95rem;
          line-height: 1.5;
          margin-bottom: 2.25rem;
        }

        .btn-group {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .btn-action-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: var(--accent);
          color: white;
          padding: 0.85rem;
          border-radius: 0.5rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          transition: transform 0.15s, opacity 0.2s;
          font-size: 0.95rem;
        }

        .btn-action-primary:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .btn-action-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: var(--accent-bg);
          color: var(--accent);
          border: 1px solid var(--accent-border);
          padding: 0.85rem;
          border-radius: 0.5rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s, background 0.2s;
          font-size: 0.95rem;
        }

        .btn-action-secondary:hover {
          background: rgba(59, 130, 246, 0.15);
          transform: translateY(-1px);
        }
      `}</style>

      <div className="expired-card">
        <div className="station-clock-wrapper">
          <div className="station-clock">
            <div className="clock-center"></div>
            <div className="clock-hand-hour"></div>
            <div className="clock-hand-minute"></div>
          </div>
        </div>

        <h2 className="expired-title">
          <AlertTriangle className="text-yellow-500" style={{ color: "#f59e0b" }} />
          Ticket Expired!
        </h2>
        <p className="expired-desc">
          Your station session has expired or you've been logged out. Please check in again to board the train.
        </p>

        <div className="btn-group">
          <button className="btn-action-primary" onClick={() => navigate("/login")}>
            <LogIn size={18} /> Sign In Again
          </button>
          <button className="btn-action-secondary" onClick={() => navigate("/")}>
            <Home size={18} /> Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiredPage;
