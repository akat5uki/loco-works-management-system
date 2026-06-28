import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../services/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSupervisor?: boolean;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "admin_session";

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireSupervisor = false }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [isSupervisor, setIsSupervisor] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    api
      .get("/auth/me")
      .then((res) => {
        if (!cancelled) {
          // Server-enforced: /auth/me only succeeds for session_type="employee" JWTs.
          // If somehow an admin JWT reaches here and passes, double-check session_type.
          if (res.data?.session_type === "admin") {
            setAuthStatus("admin_session");
          } else {
            setAuthStatus("authenticated");
            setIsSupervisor(res.data.is_supervisor);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAuthStatus("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (authStatus === "loading") {
    // Avoid a flash redirect while the session check is in flight
    return null;
  }

  if (authStatus === "unauthenticated") {
    return <Navigate to="/session-expired" state={{ from: location }} replace />;
  }

  if (authStatus === "admin_session") {
    // Admin sessions must use the admin portal — redirect to admin login
    return <Navigate to="/admin/login" replace />;
  }

  if (requireSupervisor && !isSupervisor) {
    // Non-supervisors are restricted and redirected to the main dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
