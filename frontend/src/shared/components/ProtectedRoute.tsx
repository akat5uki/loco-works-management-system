import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../services/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    api
      .get("/auth/me")
      .then(() => {
        if (!cancelled) setAuthStatus("authenticated");
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

  return <>{children}</>;
};

export default ProtectedRoute;
