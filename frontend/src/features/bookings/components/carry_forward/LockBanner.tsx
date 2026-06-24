import React from "react";
import { Lock, AlertTriangle } from "lucide-react";

interface LockOwner {
  name: string;
  ticket_number: number;
}

interface LockBannerProps {
  lockOwner: LockOwner | null;
  isCurrentOrNextShift: boolean;
}

const LockBanner: React.FC<LockBannerProps> = ({ lockOwner, isCurrentOrNextShift }) => {
  return (
    <>
      {/* Lock Warn Overlay */}
      {lockOwner && (
        <div className="lock-banner">
          <Lock size={18} />
          <span>
            Locked: {lockOwner.name} (Ticket #{lockOwner.ticket_number}) is currently editing. You are in VIEW-ONLY mode.
          </span>
        </div>
      )}

      {/* Shift Edit Restriction Warning Overlay */}
      {!isCurrentOrNextShift && (
        <div className="lock-banner" style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid #f59e0b", color: "#f59e0b" }}>
          <AlertTriangle size={18} />
          <span>
            Warning: You are viewing/editing comments for a shift other than the current or next shift.
          </span>
        </div>
      )}
    </>
  );
};

export default LockBanner;
