import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft, Train } from "lucide-react";
import ThemeToggle from "../../shared/components/ThemeToggle";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="notfound-container" style={{
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
        .notfound-card {
          background: var(--bg-card);
          padding: 3rem;
          border-radius: 1rem;
          box-shadow: var(--shadow);
          border: 1px solid var(--border);
          width: 100%;
          max-width: 500px;
          text-align: center;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Train Animation Scene */
        .scene {
          position: relative;
          width: 100%;
          height: 140px;
          margin-bottom: 2rem;
          overflow: hidden;
          background: var(--bg-secondary);
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
        }

        .track {
          position: absolute;
          bottom: 25px;
          left: 0;
          width: 100%;
          height: 4px;
          background: var(--border);
        }
        .track::after {
          content: '';
          position: absolute;
          top: 4px;
          left: 0;
          width: 100%;
          height: 6px;
          background-image: repeating-linear-gradient(90deg, var(--border) 0px, var(--border) 4px, transparent 4px, transparent 16px);
        }

        .buffer-stop {
          position: absolute;
          bottom: 20px;
          right: 40px;
          width: 12px;
          height: 30px;
          background: #ef4444;
          border-radius: 2px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .buffer-stop::before {
          content: '';
          position: absolute;
          top: 5px;
          left: -8px;
          width: 8px;
          height: 8px;
          background: #b91c1c;
          border-radius: 50%;
        }

        /* The Signal Light */
        .railway-signal {
          position: absolute;
          bottom: 20px;
          right: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .signal-pole {
          width: 4px;
          height: 60px;
          background: var(--border);
        }
        .signal-head {
          width: 24px;
          height: 14px;
          background: #1e293b;
          border-radius: 6px;
          position: absolute;
          top: -14px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 0 2px;
          border: 1px solid #475569;
        }
        .signal-light {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #475569;
        }
        .signal-light.red-left {
          animation: blink-left 1s infinite alternate;
        }
        .signal-light.red-right {
          animation: blink-right 1s infinite alternate;
        }
        @keyframes blink-left {
          0%, 49% { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
          50%, 100% { background: #475569; box-shadow: none; }
        }
        @keyframes blink-right {
          0%, 49% { background: #475569; box-shadow: none; }
          50%, 100% { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
        }

        /* Locomotive styling */
        .loco-container {
          position: absolute;
          bottom: 28px;
          left: 10%;
          animation: chug 5s ease-in-out infinite;
        }

        @keyframes chug {
          0% { left: -80px; }
          40% { left: calc(100% - 160px); }
          50% { left: calc(100% - 160px); transform: translateY(0) rotate(0deg); }
          54% { transform: translateY(-6px) rotate(-4deg); }
          58% { transform: translateY(0) rotate(0deg); }
          75% { left: calc(100% - 160px); }
          100% { left: -80px; }
        }

        .loco-body {
          width: 60px;
          height: 35px;
          background: var(--accent);
          border-radius: 4px;
          position: relative;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .loco-cabin {
          width: 25px;
          height: 25px;
          background: var(--accent);
          position: absolute;
          top: -20px;
          right: 0;
          border-radius: 4px 4px 0 0;
          border-left: 2px solid rgba(255,255,255,0.15);
        }
        .loco-cabin::after {
          content: '';
          position: absolute;
          top: 5px;
          left: 5px;
          width: 10px;
          height: 10px;
          background: var(--bg-card);
          border-radius: 2px;
        }
        .loco-chimney {
          width: 8px;
          height: 18px;
          background: var(--text-h);
          position: absolute;
          top: -15px;
          left: 8px;
          border-radius: 2px 2px 0 0;
        }
        .loco-light {
          width: 6px;
          height: 6px;
          background: #fef08a;
          box-shadow: 0 0 8px #fef08a;
          position: absolute;
          top: 10px;
          left: -4px;
          border-radius: 50%;
        }

        /* Wheels */
        .wheel-back, .wheel-front {
          width: 14px;
          height: 14px;
          background: var(--text-h);
          border-radius: 50%;
          position: absolute;
          bottom: -7px;
          border: 2px dashed var(--bg-card);
          animation: spin 1.2s linear infinite;
          box-shadow: 0 0 0 1px var(--border);
        }
        .wheel-back {
          right: 6px;
        }
        .wheel-front {
          left: 6px;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        /* Smoke clouds emitting 404 */
        .smoke-puff {
          position: absolute;
          background: var(--bg-card);
          color: var(--accent);
          font-weight: 800;
          font-size: 10px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          box-shadow: var(--shadow);
          border: 1px solid var(--border);
        }
        .smoke1 {
          width: 16px;
          height: 16px;
          top: -30px;
          left: 5px;
          animation: smoke-float 5s infinite;
        }
        .smoke2 {
          width: 20px;
          height: 20px;
          top: -45px;
          left: -5px;
          animation: smoke-float 5s infinite 0.6s;
          font-size: 11px;
        }
        .smoke3 {
          width: 24px;
          height: 24px;
          top: -60px;
          left: 0px;
          animation: smoke-float 5s infinite 1.2s;
          font-size: 12px;
        }

        @keyframes smoke-float {
          0% { transform: scale(0.3) translateY(0); opacity: 0; }
          30% { transform: scale(1) translateY(-15px); opacity: 0.9; }
          60% { transform: scale(1.2) translateY(-35px); opacity: 0; }
          100% { opacity: 0; }
        }

        .notfound-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-h);
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .notfound-desc {
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

      <div className="notfound-card">
        <div className="scene">
          {/* Tracks */}
          <div className="track"></div>
          {/* Buffer stop */}
          <div className="buffer-stop"></div>
          {/* Signal Light */}
          <div className="railway-signal">
            <div className="signal-head">
              <div className="signal-light red-left"></div>
              <div className="signal-light red-right"></div>
            </div>
            <div className="signal-pole"></div>
          </div>
          {/* Locomotive */}
          <div className="loco-container">
            <div className="smoke-puff smoke1">4</div>
            <div className="smoke-puff smoke2">0</div>
            <div className="smoke-puff smoke3">4</div>
            <div className="loco-body">
              <div className="loco-chimney"></div>
              <div className="loco-cabin"></div>
              <div className="loco-light"></div>
              <div className="wheel-front"></div>
              <div className="wheel-back"></div>
            </div>
          </div>
        </div>

        <h2 className="notfound-title">
          <Train style={{ color: "var(--accent)" }} />
          Wrong Track! (404)
        </h2>
        <p className="notfound-desc">
          The line you are looking for has been decommissioned or the points were set incorrectly. Let's get you back to the main line!
        </p>

        <div className="btn-group">
          <button className="btn-action-primary" onClick={() => navigate("/")}>
            <Home size={18} /> Return to Home
          </button>
          <button className="btn-action-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Go Back Previous Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
