import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, User, RefreshCw, Home, ShieldCheck } from "lucide-react";
import axios from "axios";
import api from "../../shared/services/api";
import ThemeToggle from "../../shared/components/ThemeToggle";
import "./Auth.css";

const LoginPage = () => {
  const [ticketNumber, setTicketNumber] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
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

  // If a valid session cookie already exists, skip the login page
  useEffect(() => {
    let cancelled = false;
    api
      .get("/auth/me")
      .then(() => {
        if (!cancelled) {
          navigate("/dashboard", { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCheckingSession(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checkingSession) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d+$/.test(ticketNumber)) {
      setError("Ticket number must contain only digits.");
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
      const response = await api.post("/auth/login", {
        ticket_number: ticketNumber, // pass string, backend validator will coerce it
        password,
        captcha,
      });
      // The server sets an HttpOnly cookie — no token storage needed
      void response; // token returned but stored server-side via cookie
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
    <div className="auth-container">
      <Link to="/" className="auth-home-btn" title="Home">
        <Home size={20} />
      </Link>
      <div style={{ position: "absolute", top: "1.5rem", right: "1.5rem" }}>
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-box">L</div>
          <h2>Sign in to Loco Works</h2>
          <p>Enter your employee details to continue</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          {error && <div className="error-message">{error}</div>}

          <div className="input-group">
            <label htmlFor="ticket">Ticket Number</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input
                id="ticket"
                type="text"
                placeholder="123456"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                required
              />
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
