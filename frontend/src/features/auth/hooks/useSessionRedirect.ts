import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../../shared/services/api";

/**
 * Checks whether a valid employee session cookie already exists.
 * If a valid employee session exists, redirects to /dashboard immediately.
 * Does NOT auto-redirect if skipRedirect state is true.
 */
export function useSessionRedirect() {
  const location = useLocation();
  const shouldSkip = (location.state as { skipRedirect?: boolean } | null)?.skipRedirect;
  const [checking, setChecking] = useState(() => !shouldSkip);
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldSkip) {
      return;
    }
    let cancelled = false;

    api
      .get("/auth/me")
      .then((res) => {
        if (!cancelled) {
          if (res.data?.session_type === "employee" || res.data?.ticket_number) {
            navigate("/dashboard", { replace: true });
          } else {
            setChecking(false);
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
