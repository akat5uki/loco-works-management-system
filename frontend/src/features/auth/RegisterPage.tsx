import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, BadgeInfo, Mail, CheckCircle2, XCircle } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import { useCaptcha } from "./hooks/useCaptcha";
import AuthCard from "./components/AuthCard";
import AuthHeader from "./components/AuthHeader";
import AuthFormField from "./components/AuthFormField";
import AuthSelectField from "./components/AuthSelectField";
import CaptchaField from "./components/CaptchaField";
import AuthFooter from "./components/AuthFooter";
import "./Auth.css";

import RegistrationSlipModal from "./components/RegistrationSlipModal";

interface Designation {
  designation_id: number;
  designation_name: string;
}

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    ticket_number: "",
    name: "",
    designation_id: "",
    email: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slipData, setSlipData] = useState<{ reg_code: string; valid_until: string } | null>(null);

  const navigate = useNavigate();
  const { captcha, setCaptcha, captchaCode, refreshCaptcha, validate } =
    useCaptcha();

  useEffect(() => {
    api
      .get("/employees/designations")
      .then((res) => setDesignations(res.data))
      .catch(() => {
        // Non-critical — select will remain empty
      });
  }, []);

  const patch = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  // Password Validation Rules
  const pwdRules = {
    length: formData.password.length > 8,
    upper: /[A-Z]/.test(formData.password),
    lower: /[a-z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^a-zA-Z0-9]/.test(formData.password),
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d+$/.test(formData.ticket_number)) {
      setError("Ticket number must contain only digits.");
      return;
    }

    const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Password validations
    if (!pwdRules.length) {
      setError("Password length must be greater than 8 characters.");
      return;
    }
    if (!pwdRules.upper) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!pwdRules.lower) {
      setError("Password must contain at least one lowercase letter.");
      return;
    }
    if (!pwdRules.number) {
      setError("Password must contain at least one numeric digit.");
      return;
    }
    if (!pwdRules.special) {
      setError("Password must contain at least one special character.");
      return;
    }
    if (formData.password !== confirmPassword) {
      setError("Password and Confirm Password do not match.");
      return;
    }

    if (!validate()) {
      setError("Incorrect captcha code. Please try again.");
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        ...formData,
        designation_id: parseInt(formData.designation_id),
      });
      
      if (res.data.otp_required) {
        navigate("/verify-otp", {
          state: {
            ticket_number: formData.ticket_number,
            email: formData.email,
            action: "registration",
            expire_seconds: res.data.expire_seconds,
          },
        });
      } else if (res.data.registration_submitted) {
        setSlipData({
          reg_code: res.data.reg_code,
          valid_until: res.data.valid_until,
        });
      } else {
        navigate("/login");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || "Registration failed.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <AuthHeader title="Create Account" subtitle="Register as a new employee" />

      <form onSubmit={handleRegister} className="auth-form">
        {error && <div className="error-message">{error}</div>}

        <AuthFormField
          id="ticket"
          label="Ticket Number"
          placeholder="123456"
          value={formData.ticket_number}
          onChange={patch("ticket_number")}
          Icon={User}
          required
        />

        <AuthFormField
          id="name"
          label="Full Name"
          placeholder="John Doe"
          value={formData.name}
          onChange={patch("name")}
          Icon={BadgeInfo}
          required
        />

        <AuthFormField
          id="email"
          label="Email ID"
          type="email"
          placeholder="employee@lwms.com"
          value={formData.email}
          onChange={patch("email")}
          Icon={Mail}
          required
        />

        <AuthSelectField
          id="designation"
          label="Designation"
          value={formData.designation_id}
          onChange={patch("designation_id")}
          options={designations.map((d) => ({
            value: d.designation_id,
            label: d.designation_name,
          }))}
          placeholder="Select Designation"
          required
        />

        <AuthFormField
          id="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          value={formData.password}
          onChange={patch("password")}
          Icon={Lock}
          required
        />

        {/* Live Password Strength Requirements */}
        {formData.password.length > 0 && (
          <div
            style={{
              padding: "0.6rem 0.8rem",
              borderRadius: "6px",
              background: "var(--bg-secondary, rgba(255, 255, 255, 0.05))",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
              fontSize: "0.78rem",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.35rem 0.75rem",
              marginTop: "-0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: pwdRules.length ? "#16a34a" : "var(--text-muted)" }}>
              {pwdRules.length ? <CheckCircle2 size={13} /> : <XCircle size={13} />} Length &gt; 8 chars
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: pwdRules.upper ? "#16a34a" : "var(--text-muted)" }}>
              {pwdRules.upper ? <CheckCircle2 size={13} /> : <XCircle size={13} />} 1 Uppercase (A-Z)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: pwdRules.lower ? "#16a34a" : "var(--text-muted)" }}>
              {pwdRules.lower ? <CheckCircle2 size={13} /> : <XCircle size={13} />} 1 Lowercase (a-z)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: pwdRules.number ? "#16a34a" : "var(--text-muted)" }}>
              {pwdRules.number ? <CheckCircle2 size={13} /> : <XCircle size={13} />} 1 Numeric (0-9)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: pwdRules.special ? "#16a34a" : "var(--text-muted)", gridColumn: "span 2" }}>
              {pwdRules.special ? <CheckCircle2 size={13} /> : <XCircle size={13} />} 1 Special Character (!@#$%^&*)
            </div>
          </div>
        )}

        <AuthFormField
          id="confirm_password"
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Registering…" : "Register"}
        </button>
      </form>

      <AuthFooter
        message="Already have an account?"
        linkText="Sign in"
        linkTo="/login"
      />

      {slipData && (
        <RegistrationSlipModal
          regCode={slipData.reg_code}
          ticketNumber={parseInt(formData.ticket_number, 10)}
          name={formData.name}
          email={formData.email}
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

export default RegisterPage;
