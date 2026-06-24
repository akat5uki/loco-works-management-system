import React from "react";
import { AlertTriangle } from "lucide-react";

interface WizardProgressProps {
  activeStep: 1 | 2;
  setActiveStep: (step: 1 | 2) => void;
  isStep2Disabled: boolean;
  isStep1Unsaved: boolean;
}

const WizardProgress: React.FC<WizardProgressProps> = ({
  activeStep,
  setActiveStep,
  isStep2Disabled,
  isStep1Unsaved,
}) => {
  return (
    <div className="wizard-progress-wrapper">
      <div className="wizard-tabs">
        <button
          type="button"
          onClick={() => setActiveStep(1)}
          className={`wizard-tab-btn ${activeStep === 1 ? "active" : ""}`}
        >
          <span className="step-number">1</span>
          <span className="step-label">Step 1: Book Supervisors to Locos</span>
        </button>
        <button
          type="button"
          onClick={() => !isStep2Disabled && setActiveStep(2)}
          disabled={isStep2Disabled}
          className={`wizard-tab-btn ${activeStep === 2 ? "active" : ""}`}
          style={{ cursor: !isStep2Disabled ? "pointer" : "not-allowed" }}
        >
          <span className="step-number">2</span>
          <span className="step-label">Step 2: Book Staff under Supervisors</span>
        </button>
      </div>

      {isStep1Unsaved && activeStep === 1 && (
        <div className="wizard-warning-banner">
          <AlertTriangle size={16} />
          <span>You have unsaved changes in Step 1. Save assignments to enable Step 2.</span>
        </div>
      )}
    </div>
  );
};

export default WizardProgress;
