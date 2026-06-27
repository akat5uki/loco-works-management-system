import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { KeyRound } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import AuthCard from "./components/AuthCard";
import AuthHeader from "./components/AuthHeader";
import AuthFormField from "./components/AuthFormField";
import AuthFooter from "./components/AuthFooter";
import "./Auth.css";

const VerifyOtpPage = () => {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as {
    ticket_number: string | number;
    email: string;
    action: "registration" | "login" | "email_registration";
  } | null;

  if (!state) {
    // If accessed directly without action state, redirect back to login
    return (
      <AuthCard>
        <AuthHeader title="Access Denied" subtitle="Invalid session verification context." />
        <div style={{ textAlign: "center", margin: "2rem 0" }}>
          <p style={{ color: "var(--text-muted)" }}>Please sign in or register to initiate OTP verification.</p>
        </div>
        <AuthFooter message="" linkText="Go to Sign In" linkTo="/login" />
      </AuthCard>
    );
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Verification code must be exactly 6 digits.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/verify-otp", {
        ticket_number: String(state.ticket_number),
        otp,
        type: state.action,
      });

      if (state.action === "registration") {
        // Redirect to login with success message
        navigate("/login", {
          state: { successMessage: "Account verified and registered successfully! You can now sign in." },
        });
      } else {
        // Successful login / email registration -> navigate to dashboard
        navigate("/dashboard");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || "OTP verification failed. Please try again.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getSubtitle = () => {
    switch (state.action) {
      case "registration":
        return `Enter the code sent to ${state.email} to verify your account`;
      case "email_registration":
        return `Enter the code sent to ${state.email} to register your email`;
      case "login":
      default:
        return `Security check: Enter the code sent to ${state.email}`;
    }
  };

  return (
    <AuthCard>
      <AuthHeader
        title="Verify Code"
        subtitle={getSubtitle()}
      />

      <form onSubmit={handleVerify} className="auth-form">
        {error && <div className="error-message">{error}</div>}

        <AuthFormField
          id="otp"
          label="6-Digit OTP Code"
          placeholder="123456"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          Icon={KeyRound}
          required
          maxLength={6}
        />

        <button type="submit" className="btn-auth" disabled={loading}>
          {loading ? "Verifying…" : "Confirm Code"}
        </button>
      </form>

      <AuthFooter
        message="Did you enter the wrong information?"
        linkText="Start over"
        linkTo={state.action === "registration" ? "/register" : "/login"}
      />
    </AuthCard>
  );
};

export default VerifyOtpPage;
