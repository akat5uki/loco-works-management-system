import React from "react";
import { Link } from "react-router-dom";

interface AuthFooterProps {
  message: string;
  linkText: string;
  linkTo: string;
}

/**
 * Footer link row shown at the bottom of auth cards —
 * e.g. "Don't have an account? Register here".
 */
const AuthFooter: React.FC<AuthFooterProps> = ({ message, linkText, linkTo }) => (
  <div className="auth-footer">
    {message} <Link to={linkTo}>{linkText}</Link>
  </div>
);

export default AuthFooter;
