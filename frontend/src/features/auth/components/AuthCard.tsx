import React from "react";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import ThemeToggle from "../../../shared/components/ThemeToggle";

interface AuthCardProps {
  children: React.ReactNode;
}

/**
 * Outer shell shared by Login and Register pages.
 * Renders the full-viewport centred background, the floating Home
 * button, the ThemeToggle, and the white/dark card that wraps the form.
 */
const AuthCard: React.FC<AuthCardProps> = ({ children }) => (
  <div className="auth-container">
    <Link to="/" className="auth-home-btn" title="Home">
      <Home size={20} />
    </Link>
    <div className="auth-topbar-right">
      <ThemeToggle />
    </div>
    <div className="auth-card">{children}</div>
  </div>
);

export default AuthCard;
