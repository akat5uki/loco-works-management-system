import React from "react";

interface AuthHeaderProps {
  title: string;
  subtitle: string;
}

/**
 * Logo + page title + subtitle block at the top of every auth card.
 */
const AuthHeader: React.FC<AuthHeaderProps> = ({ title, subtitle }) => (
  <div className="auth-header">
    <img src="/favicon.svg" alt="LWMS Logo" className="logo-box" />
    <h2>{title}</h2>
    <p>{subtitle}</p>
  </div>
);

export default AuthHeader;
