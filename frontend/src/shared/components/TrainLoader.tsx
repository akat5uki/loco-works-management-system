import React from "react";

interface TrainLoaderProps {
  message?: string;
}

const TrainLoader: React.FC<TrainLoaderProps> = ({ message = "Loading data..." }) => {
  return (
    <div className="train-loader-wrapper" style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      margin: "2rem auto",
      width: "100%",
      maxWidth: "300px",
      borderRadius: "1rem",
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow)"
    }}>
      <style>{`
        .train-animate-container {
          position: relative;
          padding-bottom: 15px;
          width: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .train-animate-engine {
          font-size: 2.2rem;
          display: inline-block;
          animation: train-chug 0.35s ease-in-out infinite alternate;
        }
        .train-animate-track {
          height: 3px;
          background: linear-gradient(90deg, var(--accent) 50%, transparent 50%);
          background-size: 15px 100%;
          width: 90px;
          animation: train-track-move 0.5s linear infinite;
          border-radius: 2px;
          margin-top: -2px;
        }
        .train-animate-smoke {
          position: absolute;
          top: -8px;
          left: 65px;
          display: flex;
          gap: 5px;
        }
        .train-puff {
          width: 6px;
          height: 6px;
          background-color: var(--accent);
          opacity: 0.5;
          border-radius: 50%;
          display: inline-block;
          animation: train-smoke 1s ease-out infinite;
        }
        .train-puff-2 { animation-delay: 0.3s; }
        .train-puff-3 { animation-delay: 0.6s; }

        @keyframes train-chug {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-4px) rotate(1deg); }
        }
        @keyframes train-track-move {
          0% { background-position: 0 0; }
          100% { background-position: -15px 0; }
        }
        @keyframes train-smoke {
          0% { transform: translateY(0) scale(1); opacity: 0.6; }
          100% { transform: translateY(-15px) translateX(10px) scale(2); opacity: 0; }
        }
        .train-loader-text {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-h);
          margin-top: 10px;
          text-align: center;
          opacity: 0.85;
        }
      `}</style>
      <div className="train-animate-container">
        <div className="train-animate-smoke">
          <span className="train-puff train-puff-1"></span>
          <span className="train-puff train-puff-2"></span>
          <span className="train-puff train-puff-3"></span>
        </div>
        <div className="train-animate-engine">🚂</div>
        <div className="train-animate-track"></div>
      </div>
      <p className="train-loader-text">{message}</p>
    </div>
  );
};

export default TrainLoader;
