import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { KeyRound } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import AuthCard from "./components/AuthCard";
import AuthHeader from "./components/AuthHeader";
import AuthFormField from "./components/AuthFormField";
import AuthFooter from "./components/AuthFooter";
import RegistrationSlipModal from "./components/RegistrationSlipModal";
import "./Auth.css";

const VerifyOtpPage = () => {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [resendSuccess, setResendSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [slipData, setSlipData] = useState<{ reg_code: string; name?: string; valid_until: string } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as {
    ticket_number: string | number;
    name?: string;
    email: string;
    action: "registration" | "login" | "email_registration";
    expire_seconds?: number;
  } | null;

  const [timeLeft, setTimeLeft] = useState(state?.expire_seconds || 180);

  useEffect(() => {
    if (!state) return;
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, state]);

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
    setResendSuccess("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Verification code must be exactly 6 digits.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", {
        ticket_number: String(state.ticket_number),
        otp,
        type: state.action,
      });

      if (state.action === "registration" && res.data.registration_submitted) {
        setSlipData({
          reg_code: res.data.reg_code,
          name: res.data.name || state.name,
          valid_until: res.data.valid_until,
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

  const handleResendOtp = async () => {
    setError("");
    setResendSuccess("");
    setResending(true);

    try {
      const res = await api.post("/auth/resend-otp", {
        ticket_number: String(state.ticket_number),
        type: state.action,
      });
      setResendSuccess("Verification code resent successfully!");
      setTimeLeft(res.data.expire_seconds || 180);
      setOtp(""); // Clear previous OTP input
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || "Failed to resend verification code.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
        {resendSuccess && (
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
            {resendSuccess}
          </div>
        )}

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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "-0.5rem 0 1.25rem 0", fontSize: "0.875rem" }}>
          {timeLeft > 0 ? (
            <span style={{ color: "var(--text-muted)" }}>
              Code expires in: <strong style={{ color: "var(--accent)" }}>{formatTime(timeLeft)}</strong>
            </span>
          ) : (
            <span style={{ color: "#ef4444", fontWeight: "600" }}>Code expired</span>
          )}

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={timeLeft > 0 || resending}
            style={{
              background: "none",
              border: "none",
              color: timeLeft > 0 ? "var(--text-muted)" : "var(--accent)",
              cursor: timeLeft > 0 ? "not-allowed" : "pointer",
              textDecoration: timeLeft > 0 ? "none" : "underline",
              padding: 0,
              fontSize: "0.875rem",
              fontWeight: timeLeft > 0 ? "normal" : "600"
            }}
          >
            {resending ? "Sending..." : "Resend OTP"}
          </button>
        </div>

        <button type="submit" className="btn-auth" disabled={loading}>
          {loading ? "Verifying…" : "Confirm Code"}
        </button>
      </form>

      <AuthFooter
        message="Did you enter the wrong information?"
        linkText="Start over"
        linkTo={state.action === "registration" ? "/register" : "/login"}
      />

      {slipData && state && (
        <RegistrationSlipModal
          regCode={slipData.reg_code}
          ticketNumber={typeof state.ticket_number === "number" ? state.ticket_number : parseInt(state.ticket_number, 10)}
          name={slipData.name || state.name || "Employee"}
          email={state.email}
          validUntil={slipData.valid_until}
          onClose={() => {
            setSlipData(null);
            navigate("/login");
          }}
        />
      )}
    </AuthCard>
  );
};

export default VerifyOtpPage;
