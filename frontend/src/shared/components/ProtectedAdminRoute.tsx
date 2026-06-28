import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../services/api";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    api
      .get("/admin/me")
      .then((res) => {
        if (!cancelled) {
          if (res.data?.session_type === "admin") {
            setAuthStatus("authenticated");
          } else {
            setAuthStatus("unauthenticated");
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
    return null;
  }

  if (authStatus === "unauthenticated") {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;
