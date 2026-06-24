import React from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

interface CaptchaFieldProps {
  captchaCode: string;
  captcha: string;
  onCaptchaChange: (val: string) => void;
  onRefresh: () => void;
}

/**
 * Captcha row: displays the generated code, a refresh button, and the
 * user-entry input. On narrow screens the row wraps gracefully.
 */
const CaptchaField: React.FC<CaptchaFieldProps> = ({
  captchaCode,
  captcha,
  onCaptchaChange,
  onRefresh,
}) => (
  <div className="input-group">
    <label htmlFor="captcha">Captcha</label>
    <div className="captcha-row">
      <div className="captcha-box">{captchaCode}</div>
      <button
        type="button"
        className="refresh-btn"
        onClick={onRefresh}
        title="Refresh Captcha"
      >
        <RefreshCw size={16} />
      </button>
      <div className="input-wrapper captcha-input-wrapper">
        <ShieldCheck size={18} className="input-icon" />
        <input
          id="captcha"
          type="text"
          placeholder="Enter Captcha"
          value={captcha}
          onChange={(e) => onCaptchaChange(e.target.value)}
          style={{ textTransform: "uppercase" }}
          required
        />
      </div>
    </div>
  </div>
);

export default CaptchaField;
