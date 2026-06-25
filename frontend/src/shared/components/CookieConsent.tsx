import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { Cookie, Settings, X, Shield, BarChart3, Sliders } from "lucide-react";
import "./CookieConsent.css";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  preferences: boolean;
}

const COOKIE_STORAGE_KEY = "cookie_consent_preferences";

export const CookieConsent: React.FC = () => {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";

  const [prefs, setPrefs] = useState<CookiePreferences>(() => {
    const savedPrefs = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (savedPrefs) {
      try {
        const parsed = JSON.parse(savedPrefs) as CookiePreferences;
        return {
          necessary: true,
          analytics: !!parsed.analytics,
          preferences: !!parsed.preferences,
        };
      } catch {
        // Fall back to default
      }
    }
    return {
      necessary: true,
      analytics: false,
      preferences: false,
    };
  });

  const [showBanner, setShowBanner] = useState<boolean>(() => {
    const savedPrefs = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (!savedPrefs) return true;
    try {
      JSON.parse(savedPrefs);
      return false;
    } catch {
      return true;
    }
  });

  const [showModal, setShowModal] = useState<boolean>(false);

  React.useEffect(() => {
    const handleOpen = () => setShowModal(true);
    window.addEventListener("open-cookie-settings", handleOpen);
    return () => window.removeEventListener("open-cookie-settings", handleOpen);
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = { necessary: true, analytics: true, preferences: true };
    localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(allAccepted));
    setPrefs(allAccepted);
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    const allRejected = { necessary: true, analytics: false, preferences: false };
    localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(allRejected));
    setPrefs(allRejected);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(prefs));
    setShowModal(false);
    setShowBanner(false);
  };

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === "necessary") return; // Cannot toggle strictly necessary cookies
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <>
      {/* ── CONSENT BANNER ── */}
      {showBanner && !showModal && (
        <div className="cookie-consent-banner" role="status" aria-live="polite">
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <Cookie size={28} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h4 className="cookie-consent-title">Cookie Preferences</h4>
              <p className="cookie-consent-text">
                We use cookies to secure authentication, manage shifts, and analyze workspace performance.
                Choose your options below. Strictly necessary cookies are active by default.
              </p>
            </div>
          </div>
          <div className="cookie-consent-buttons">
            <button
              onClick={handleAcceptAll}
              className="cookie-consent-btn primary"
              type="button"
            >
              Accept All
            </button>
            <button
              onClick={handleRejectAll}
              className="cookie-consent-btn secondary"
              type="button"
            >
              Reject All
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="cookie-consent-btn link"
              type="button"
            >
              Customize settings
            </button>
          </div>
        </div>
      )}

      {/* ── CUSTOMIZATION MODAL ── */}
      {showModal && (
        <div className="cookie-consent-overlay" onClick={() => setShowModal(false)}>
          <div className="cookie-consent-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cookie-consent-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={20} style={{ color: "var(--accent)" }} />
                <h3 className="cookie-consent-modal-title">Cookie Settings</h3>
              </div>
              <button
                className="cookie-consent-modal-close"
                onClick={() => setShowModal(false)}
                type="button"
                aria-label="Close settings"
              >
                <X size={20} />
              </button>
            </div>

            <div className="cookie-consent-pref-list">
              {/* Necessary */}
              <div className="cookie-consent-pref-item">
                <div className="cookie-consent-pref-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Shield size={14} style={{ color: "var(--text)" }} />
                    <span className="cookie-consent-pref-name">Strictly Necessary (Always Active)</span>
                  </div>
                  <p className="cookie-consent-pref-desc">
                    Required for secure authentication, anti-CSRF protection, lock heartbeat synchronizers, and maintaining database replica integrity.
                  </p>
                </div>
                <label className="cookie-consent-pref-toggle">
                  <input type="checkbox" checked disabled />
                  <span className="cookie-consent-slider"></span>
                </label>
              </div>

              {/* Analytics */}
              <div className="cookie-consent-pref-item">
                <div className="cookie-consent-pref-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <BarChart3 size={14} style={{ color: "var(--text)" }} />
                    <span className="cookie-consent-pref-name">Analytics & Performance</span>
                  </div>
                  <p className="cookie-consent-pref-desc">
                    Helps us monitor websocket latency, dashboard tiles loading speed, and supervisor edit locks usage statistics.
                  </p>
                </div>
                <label className="cookie-consent-pref-toggle">
                  <input
                    type="checkbox"
                    checked={prefs.analytics}
                    onChange={() => togglePreference("analytics")}
                  />
                  <span className="cookie-consent-slider"></span>
                </label>
              </div>

              {/* Preferences */}
              <div className="cookie-consent-pref-item">
                <div className="cookie-consent-pref-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Sliders size={14} style={{ color: "var(--text)" }} />
                    <span className="cookie-consent-pref-name">Functional & Theme Preferences</span>
                  </div>
                  <p className="cookie-consent-pref-desc">
                    Remembers your UI settings, toggle filters, search parameters, and dark/light color scheme settings.
                  </p>
                </div>
                <label className="cookie-consent-pref-toggle">
                  <input
                    type="checkbox"
                    checked={prefs.preferences}
                    onChange={() => togglePreference("preferences")}
                  />
                  <span className="cookie-consent-slider"></span>
                </label>
              </div>
            </div>

            <div className="cookie-consent-modal-footer">
              <button
                className="cookie-consent-btn secondary"
                onClick={handleRejectAll}
                type="button"
                style={{ flex: "none" }}
              >
                Reject All
              </button>
              <button
                className="cookie-consent-btn primary"
                onClick={handleSavePreferences}
                type="button"
                style={{ flex: "none" }}
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PERSISTENT RE-ENTRY TRIGGER ── */}
      {isLandingPage && !showBanner && !showModal && (
        <button
          className="cookie-consent-trigger-btn"
          onClick={() => setShowModal(true)}
          type="button"
          aria-label="Manage cookie preferences"
          title="Adjust cookie preferences"
        >
          <Settings size={14} />
          Cookie Settings
        </button>
      )}
    </>
  );
};

export default CookieConsent;
