import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, BadgeInfo, Home, Mail, ShieldCheck, RefreshCw } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
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
  const [captcha, setCaptcha] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const generateCaptcha = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  useEffect(() => {
    const fetchDesignations = async () => {
      try {
        const response = await api.get("/employees/designations");
        setDesignations(response.data);
      } catch (err) {
        // Failed to load designations from the API
      }
    };
    fetchDesignations();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d+$/.test(formData.ticket_number)) {
      setError("Ticket number must contain only digits.");
      return;
    }

    const emailRegex = /^[\w\.-]+@[\w\.-]+\.\w+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (captcha.trim().toUpperCase() !== captchaCode) {
      setError("Incorrect captcha code. Please try again.");
      setCaptcha("");
      generateCaptcha();
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/register", {
        ...formData,
        designation_id: parseInt(formData.designation_id),
      });
      navigate("/login");
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
    <div className="auth-container">
      <Link to="/" className="auth-home-btn" title="Home">
        <Home size={20} />
      </Link>
      <div style={{ position: "absolute", top: "1.5rem", right: "1.5rem" }}>
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <img src="/favicon.svg" alt="LWMS Logo" className="logo-box" />
          <h2>Create Account</h2>
          <p>Register as a new employee</p>
        </div>

        <form onSubmit={handleRegister} className="auth-form">
          {error && <div className="error-message">{error}</div>}

          <div className="input-group">
            <label htmlFor="ticket">Ticket Number</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input
                id="ticket"
                type="text"
                placeholder="123456"
                value={formData.ticket_number}
                onChange={(e) =>
                  setFormData({ ...formData, ticket_number: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="name">Full Name</label>
            <div className="input-wrapper">
              <BadgeInfo size={18} className="input-icon" />
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="email">Email ID</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                type="email"
                placeholder="employee@lwms.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="designation">Designation</label>
            <div className="input-wrapper">
              <select
                id="designation"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg)",
                  color: "var(--text-h)",
                }}
                value={formData.designation_id}
                onChange={(e) =>
                  setFormData({ ...formData, designation_id: e.target.value })
                }
                required
              >
                <option value="">Select Designation</option>
                {designations.map((d) => (
                  <option key={d.designation_id} value={d.designation_id}>
                    {d.designation_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="captcha">Captcha</label>
            <div className="captcha-row">
              <div className="captcha-box" style={{ fontFamily: "monospace" }}>{captchaCode}</div>
              <button type="button" className="refresh-btn" onClick={generateCaptcha} title="Refresh Captcha">
                <RefreshCw size={16} />
              </button>
              <div className="input-wrapper" style={{ flex: 1 }}>
                <ShieldCheck size={18} className="input-icon" style={{ zIndex: 1 }} />
                <input
                  id="captcha"
                  type="text"
                  placeholder="Enter Captcha"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  style={{ textTransform: "uppercase" }}
                  required
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
