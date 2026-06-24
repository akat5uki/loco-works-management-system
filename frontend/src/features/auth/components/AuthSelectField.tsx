import React from "react";

interface SelectOption {
  value: number | string;
  label: string;
}

interface AuthSelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
}

/**
 * Labelled select/dropdown field for auth forms (e.g. Designation).
 * Uses the `.auth-select` CSS class instead of inline styles.
 */
const AuthSelectField: React.FC<AuthSelectFieldProps> = ({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  required = false,
}) => (
  <div className="input-group">
    <label htmlFor={id}>{label}</label>
    <div className="input-wrapper">
      <select
        id={id}
        className="auth-select"
        value={value}
        onChange={onChange}
        required={required}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  </div>
);

export default AuthSelectField;
