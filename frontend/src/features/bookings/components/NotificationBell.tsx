import React, { useState, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";

interface Notification {
  notification_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  notifications: Notification[];
  handleMarkAsRead: (notifId: number) => Promise<void>;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  handleMarkAsRead,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close notifications popup if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="notification-bell-wrapper" ref={containerRef}>
      <button
        className="notification-bell-container"
        onClick={() => setShowNotifications(!showNotifications)}
        type="button"
        aria-label="View notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {showNotifications && (
        <div className="notifications-popup" onClick={(e) => e.stopPropagation()}>
          <div className="notifications-popup-header">
            <h3>Notifications</h3>
            <button
              className="close-notifications-btn"
              onClick={() => setShowNotifications(false)}
              type="button"
              aria-label="Close notifications"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <p className="empty-notif-message">No notifications.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  className={`notif-item ${!n.is_read ? "unread" : ""}`}
                  onClick={() => {
                    if (!n.is_read) {
                      handleMarkAsRead(n.notification_id);
                    }
                  }}
                >
                  <p className="notif-message-text">{n.message}</p>
                  <span className="notif-time">
                    {new Date(n.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
