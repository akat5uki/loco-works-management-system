import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../shared/services/api";

/**
 * Checks whether a valid session cookie already exists.
 * If it does, redirects to /dashboard immediately.
 * Returns `checking` = true while the request is in-flight so the
 * caller can avoid rendering the page until the check is done.
 */
export function useSessionRedirect() {
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .get("/auth/me")
      .then(() => {
        if (!cancelled) navigate("/dashboard", { replace: true });
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
