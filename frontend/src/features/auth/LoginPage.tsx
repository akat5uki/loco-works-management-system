import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, User } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import { useCaptcha } from "./hooks/useCaptcha";
import { useSessionRedirect } from "./hooks/useSessionRedirect";
import AuthCard from "./components/AuthCard";
import AuthHeader from "./components/AuthHeader";
import AuthFormField from "./components/AuthFormField";
import CaptchaField from "./components/CaptchaField";
import AuthFooter from "./components/AuthFooter";
import "./Auth.css";

const LoginPage = () => {
  const [ticketNumber, setTicketNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { checking } = useSessionRedirect();
  const { captcha, setCaptcha, captchaCode, refreshCaptcha, validate } =
    useCaptcha();

  const successMsg = (location.state as { successMessage?: string } | null)?.successMessage;

  if (checking) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d+$/.test(ticketNumber)) {
      setError("Ticket number must contain only digits.");
      return;
    }

    if (!validate()) {
      setError("Incorrect captcha code. Please try again.");
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", {
        ticket_number: ticketNumber,
        password,
        captcha,
      });

      if (res.data.otp_required) {
        navigate("/verify-otp", {
          state: {
            ticket_number: ticketNumber,
            email: res.data.email,
            action: "login",
            expire_seconds: res.data.expire_seconds,
          },
        });
      } else if (res.data.email_required) {
        navigate("/register-email", {
          state: {
            ticket_number: ticketNumber,
          },
        });
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.detail ||
            "Login failed. Please check your credentials.",
        );
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthHeader
        title="Sign in to Loco Works"
        subtitle="Enter your employee details to continue"
      />

      <form onSubmit={handleLogin} className="auth-form">
        {successMsg && (
          <div 
            className="success-message" 
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid #10b981",
              color: "#10b981",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              marginBottom: "1rem",
              fontSize: "0.9rem",
              textAlign: "center"
            }}
          >
            {successMsg}
          </div>
        )}
        {error && <div className="error-message">{error}</div>}

        <AuthFormField
          id="ticket"
          label="Ticket Number"
          placeholder="123456"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          Icon={User}
          required
        />

        <AuthFormField
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          Icon={Lock}
          required
        />

        <div style={{ display: "flex", justifyContent: "flex-end", margin: "-0.5rem 0 1rem 0" }}>
          <span 
            onClick={() => navigate("/forgot-password")} 
            style={{ fontSize: "0.85rem", color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
          >
            Forgot Password?
          </span>
        </div>

        <CaptchaField
          captchaCode={captchaCode}
          captcha={captcha}
          onCaptchaChange={setCaptcha}
          onRefresh={refreshCaptcha}
        />

        <button type="submit" className="btn-auth" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <AuthFooter
        message="Don't have an account?"
        linkText="Register here"
        linkTo="/register"
      />

      <div style={{ marginTop: "1.25rem", textAlign: "center", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
        <span
          onClick={() => navigate("/admin/login")}
          style={{ fontSize: "0.85rem", color: "var(--primary-color)", cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
        >
          🔒 Switch to Administrator Portal
        </span>
      </div>
    </AuthCard>
  );
};

export default LoginPage;
