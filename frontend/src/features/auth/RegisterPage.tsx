import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, BadgeInfo, Mail } from "lucide-react";
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
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    </AuthCard>
  );
};

export default RegisterPage;
