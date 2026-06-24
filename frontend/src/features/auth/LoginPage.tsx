import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const { checking } = useSessionRedirect();
  const { captcha, setCaptcha, captchaCode, refreshCaptcha, validate } =
    useCaptcha();

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
      await api.post("/auth/login", {
        ticket_number: ticketNumber,
        password,
        captcha,
      });
      navigate("/dashboard");
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
    </AuthCard>
  );
};

export default LoginPage;
