import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import AuthCard from "./components/AuthCard";
import AuthHeader from "./components/AuthHeader";
import AuthFormField from "./components/AuthFormField";
import AuthFooter from "./components/AuthFooter";
import "./Auth.css";

const RegisterEmailPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as {
    ticket_number: string | number;
  } | null;

  if (!state) {
    return (
      <AuthCard>
        <AuthHeader title="Access Denied" subtitle="Invalid session registration context." />
        <div style={{ textAlign: "center", margin: "2rem 0" }}>
          <p style={{ color: "var(--text-muted)" }}>Please sign in or register to set up your email.</p>
        </div>
        <AuthFooter message="" linkText="Go to Sign In" linkTo="/login" />
      </AuthCard>
    );
  }

  const handleRegisterEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register-email", {
        ticket_number: String(state.ticket_number),
        email,
      });

      // Redirect to OTP verification page
      navigate("/verify-otp", {
        state: {
          ticket_number: state.ticket_number,
          email,
          action: "email_registration",
        },
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || "Failed to register email address.");
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
        title="Email Verification Needed"
        subtitle="To continue, register an email address where you will receive secure OTP codes"
      />

      <form onSubmit={handleRegisterEmail} className="auth-form">
        {error && <div className="error-message">{error}</div>}

        <AuthFormField
          id="email"
          label="Email Address"
          type="email"
          placeholder="employee@lwms.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          Icon={Mail}
          required
        />

        <button type="submit" className="btn-auth" disabled={loading}>
          {loading ? "Registering…" : "Register & Send Code"}
        </button>
      </form>

      <AuthFooter
        message="Want to log in with a different account?"
        linkText="Sign out"
        linkTo="/login"
      />
    </AuthCard>
  );
};

export default RegisterEmailPage;
