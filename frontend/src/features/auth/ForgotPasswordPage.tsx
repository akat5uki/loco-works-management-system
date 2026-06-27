import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import AuthCard from "./components/AuthCard";
import AuthHeader from "./components/AuthHeader";
import AuthFormField from "./components/AuthFormField";
import AuthFooter from "./components/AuthFooter";
import "./Auth.css";

const ForgotPasswordPage = () => {
  const [ticketNumber, setTicketNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d+$/.test(ticketNumber)) {
      setError("Ticket number must contain only digits.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password", {
        ticket_number: ticketNumber,
      });

      // Redirect to reset password page
      navigate("/reset-password", {
        state: {
          ticket_number: ticketNumber,
        },
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.detail ||
            "Unable to request password reset. Make sure the ticket number is correct.",
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
        title="Forgot Password"
        subtitle="Enter your ticket number to verify your identity and receive a reset OTP code"
      />

      <form onSubmit={handleForgotPassword} className="auth-form">
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

        <button type="submit" className="btn-auth" disabled={loading}>
          {loading ? "Sending OTP…" : "Request Reset OTP"}
        </button>
      </form>

      <AuthFooter
        message="Remember your credentials?"
        linkText="Sign in"
        linkTo="/login"
      />
    </AuthCard>
  );
};

export default ForgotPasswordPage;
