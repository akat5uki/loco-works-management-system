import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../shared/services/api";

/**
 * Checks whether a valid employee session cookie already exists.
 * If a valid employee session exists, redirects to /dashboard immediately.
 */
export function useSessionRedirect() {
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
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
  }, [navigate]);

  return { checking };
}
