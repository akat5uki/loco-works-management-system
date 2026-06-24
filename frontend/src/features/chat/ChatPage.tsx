import { useState } from "react";
import ChatRoom from "./components/ChatRoom";
import { ROOM_LABELS } from "./chatConstants";

// ─── Main Chat Page ───────────────────────────────────────────────────────────

interface ChatPageProps {
  isSupervisor: boolean;
  currentTicket: number;
}

const ChatPage = ({ isSupervisor, currentTicket }: ChatPageProps) => {
  const [activeRoom, setActiveRoom] = useState<"all" | "supervisor">("all");

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      flex: 1,
      minHeight: 0,
      background: "var(--bg-secondary)",
    }}>
      {/* Page header */}
      <div style={{
        padding: "0.5rem 0.5rem 0",
        background: "var(--bg-secondary)",
        flexShrink: 0,
      }}>
        {/* Room tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: 0 }}>
          {(["all", ...(isSupervisor ? ["supervisor"] : [])] as ("all" | "supervisor")[]).map((room) => (
            <button
              key={room}
              onClick={() => setActiveRoom(room)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem 0.5rem 0 0",
                border: "1px solid var(--border)",
                borderBottom: activeRoom === room ? "1px solid var(--bg-card)" : "1px solid var(--border)",
                background: activeRoom === room ? "var(--bg-card)" : "transparent",
                color: activeRoom === room ? ROOM_LABELS[room].color : "var(--text)",
                fontWeight: activeRoom === room ? 700 : 500,
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "all 0.15s",
                marginBottom: "-1px",
                position: "relative",
                zIndex: activeRoom === room ? 1 : 0,
              }}
            >
              {ROOM_LABELS[room].icon}
              {ROOM_LABELS[room].label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat room panel */}
      <div style={{
        flex: 1,
        border: "1px solid var(--border)",
        borderRadius: "0 0.5rem 0.5rem 0.5rem",
        margin: "0 0.5rem 0.5rem",
        background: "var(--bg-card)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}>
        <ChatRoom
          key={activeRoom}
          room={activeRoom}
          isSupervisor={isSupervisor}
          currentTicket={currentTicket}
        />
      </div>
    </div>
  );
};

export default ChatPage;
