import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { KeyRound, Lock, User } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import AuthCard from "./components/AuthCard";
import AuthHeader from "./components/AuthHeader";
import AuthFormField from "./components/AuthFormField";
import AuthFooter from "./components/AuthFooter";
import "./Auth.css";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { ticket_number: string | number } | null;

  const [ticketNumber, setTicketNumber] = useState(state?.ticket_number ? String(state.ticket_number) : "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d+$/.test(ticketNumber)) {
      setError("Ticket number must contain only digits.");
      return;
    }

    if (!/^\d{6}$/.test(otp)) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        ticket_number: ticketNumber,
        otp,
        new_password: newPassword,
      });

      // Navigate to login with success message
      navigate("/login", {
        state: { successMessage: "Password reset successful! You can now log in with your new password." },
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || "Failed to reset password. Please check the details.");
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
        title="Reset Password"
        subtitle="Provide the OTP sent to your registered email along with your new password"
      />

      <form onSubmit={handleResetPassword} className="auth-form">
        {error && <div className="error-message">{error}</div>}

        {!state?.ticket_number && (
          <AuthFormField
            id="ticket"
            label="Ticket Number"
            placeholder="123456"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            Icon={User}
            required
          />
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

        <AuthFormField
          id="new-password"
          label="New Password"
          type="password"
          placeholder="••••••••"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          Icon={Lock}
          required
        />

        <button type="submit" className="btn-auth" disabled={loading}>
          {loading ? "Resetting…" : "Reset Password"}
        </button>
      </form>

      <AuthFooter
        message="Want to cancel reset?"
        linkText="Sign in"
        linkTo="/login"
      />
    </AuthCard>
  );
};

export default ResetPasswordPage;
