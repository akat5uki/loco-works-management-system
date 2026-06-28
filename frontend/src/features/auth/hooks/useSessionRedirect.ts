import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../../shared/services/api";

/**
 * Checks whether a valid session cookie already exists.
 * If a standard employee session exists, redirects to /dashboard immediately.
 * Does NOT auto-redirect if session is an Admin session or skipRedirect is true.
 */
export function useSessionRedirect() {
  const location = useLocation();
  const shouldSkip = (location.state as { skipRedirect?: boolean } | null)?.skipRedirect;
  const [checking, setChecking] = useState(() => !shouldSkip);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    if (shouldSkip) return;

    api
      .get("/auth/me")
      .then((res) => {
        if (!cancelled) {
          if (res.data?.is_admin) {
            // Do not force-redirect admins to employee dashboard
            setChecking(false);
          } else {
            navigate("/dashboard", { replace: true });
          }
        }
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, shouldSkip]);

  return { checking };
}
