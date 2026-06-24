import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, MessageSquare, Wifi, WifiOff } from "lucide-react";
import { ROOM_LABELS } from "../chatConstants";

export interface ChatMessage {
  id: string;
  type: "message" | "system";
  room: string;
  text: string;
  timestamp: string;
  sender_ticket?: number;
  sender_name?: string;
  sender_designation?: string;
  is_supervisor?: boolean;
}

export interface ChatRoomProps {
  room: "all" | "supervisor";
  isSupervisor: boolean;
  currentTicket: number;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const ChatRoom: React.FC<ChatRoomProps> = ({ room, currentTicket }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [prevRoom, setPrevRoom] = useState(room);
  if (room !== prevRoom) {
    setPrevRoom(room);
    setMessages([]);
    setConnecting(true);
    setConnected(false);
  }

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/api/v1/chat/ws/${room}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "history") {
          setMessages(data.messages || []);
        } else if (data.type === "message" || data.type === "system") {
          setMessages((prev) => [...prev, data]);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (e) => {
      setConnected(false);
      setConnecting(false);
      if (e.code === 4003) {
        setMessages([{
          id: "access-denied",
          type: "system",
          room,
          text: "⛔ Access denied — this room is for Supervisors only.",
          timestamp: new Date().toISOString(),
        }]);
      }
    };

    ws.onerror = () => {
      setConnected(false);
      setConnecting(false);
    };

    return () => {
      ws.close();
    };
  }, [room]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", room, text }));
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Group messages by date for date separators
  const grouped: { date: string; msgs: ChatMessage[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.timestamp);
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== date) {
      grouped.push({ date, msgs: [msg] });
    } else {
      last.msgs.push(msg);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* Room header */}
      <div style={{
        padding: "0.75rem 1.25rem",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--bg-card)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: ROOM_LABELS[room].color }}>{ROOM_LABELS[room].icon}</span>
          <span style={{ fontWeight: 700, color: "var(--text-h)", fontSize: "0.95rem" }}>
            {ROOM_LABELS[room].label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem" }}>
          {connecting ? (
            <><Wifi size={13} style={{ color: "#f59e0b" }} /><span style={{ color: "#f59e0b" }}>Connecting…</span></>
          ) : connected ? (
            <><Wifi size={13} style={{ color: "#10b981" }} /><span style={{ color: "#10b981" }}>Live</span></>
          ) : (
            <><WifiOff size={13} style={{ color: "#ef4444" }} /><span style={{ color: "#ef4444" }}>Disconnected</span></>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.15rem",
        background: "var(--bg-secondary)",
      }}>
        {messages.length === 0 && !connecting && (
          <div style={{ textAlign: "center", color: "var(--text)", fontSize: "0.85rem", marginTop: "3rem", opacity: 0.6 }}>
            <MessageSquare size={32} style={{ margin: "0 auto 0.5rem", opacity: 0.4 }} />
            No messages yet. Say hello! 👋
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date separator */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              margin: "0.75rem 0 0.5rem", opacity: 0.5,
            }}>
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>{date}</span>
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
            </div>

            {msgs.map((msg) => {
              if (msg.type === "system") {
                return (
                  <div key={msg.id || msg.timestamp} style={{
                    textAlign: "center", fontSize: "0.72rem", color: "var(--text)",
                    opacity: 0.6, margin: "0.25rem 0", fontStyle: "italic",
                  }}>
                    {msg.text}
                  </div>
                );
              }

              const isOwn = msg.sender_ticket === currentTicket;

              return (
                <div
                  key={msg.id || msg.timestamp}
                  style={{
                    display: "flex",
                    flexDirection: isOwn ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    gap: "0.5rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  {/* Avatar */}
                  {!isOwn && (
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: msg.is_supervisor ? "#6366f1" : "#10b981",
                      color: "white", fontSize: "0.65rem", fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {(msg.sender_name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                    {/* Sender info */}
                    {!isOwn && (
                      <div style={{ fontSize: "0.68rem", color: "var(--text)", marginBottom: "0.15rem", display: "flex", gap: "0.3rem", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "var(--text-h)" }}>{msg.sender_name}</span>
                        <span style={{ opacity: 0.6 }}>·</span>
                        <span style={{ color: msg.is_supervisor ? "#6366f1" : "#10b981" }}>{msg.sender_designation}</span>
                        <span style={{ opacity: 0.6 }}>·</span>
                        <span style={{ opacity: 0.5 }}>#{msg.sender_ticket}</span>
                      </div>
                    )}

                    {/* Bubble */}
                    <div style={{
                      padding: "0.5rem 0.85rem",
                      borderRadius: isOwn ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                      background: isOwn ? "var(--accent)" : "var(--bg-card)",
                      color: isOwn ? "white" : "var(--text-h)",
                      fontSize: "0.875rem",
                      lineHeight: 1.5,
                      border: isOwn ? "none" : "1px solid var(--border)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                      wordBreak: "break-word",
                    }}>
                      {msg.text}
                    </div>

                    {/* Timestamp */}
                    <div style={{ fontSize: "0.65rem", color: "var(--text)", opacity: 0.5, marginTop: "0.15rem" }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "0.75rem 1rem",
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: "0.5rem",
        background: "var(--bg-card)",
        flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? "Type a message… (Enter to send)" : "Connecting…"}
          disabled={!connected}
          maxLength={1000}
          style={{
            flex: 1,
            padding: "0.6rem 0.85rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            color: "var(--text-h)",
            fontSize: "0.875rem",
            outline: "none",
            transition: "border-color 0.15s",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
          style={{
            padding: "0.6rem 0.85rem",
            borderRadius: "0.5rem",
            background: "var(--accent)",
            color: "white",
            border: "none",
            cursor: connected && input.trim() ? "pointer" : "not-allowed",
            opacity: connected && input.trim() ? 1 : 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 0.15s, transform 0.1s",
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
