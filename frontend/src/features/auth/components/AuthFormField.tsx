import React from "react";
import { type LucideIcon } from "lucide-react";

interface AuthFormFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  Icon: LucideIcon;
  required?: boolean;
  style?: React.CSSProperties;
  maxLength?: number;
}

/**
 * A labelled, icon-prefixed input field used throughout auth forms.
 * Keeps the label + input-wrapper pattern in one place.
 */
const AuthFormField: React.FC<AuthFormFieldProps> = ({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  Icon,
  required = false,
  style,
  maxLength,
}) => (
  <div className="input-group">
    <label htmlFor={id}>{label}</label>
    <div className="input-wrapper">
      <Icon size={18} className="input-icon" />
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        style={style}
        maxLength={maxLength}
      />
    </div>
  </div>
);

export default AuthFormField;
