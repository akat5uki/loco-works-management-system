import React from "react";
import { jsPDF } from "jspdf";
import { Download, CheckCircle2, AlertTriangle, X } from "lucide-react";

interface RegistrationSlipModalProps {
  regCode: string;
  ticketNumber: number;
  name: string;
  email: string;
  validUntil: string;
  onClose: () => void;
}

const getBase64ImageFromUrl = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const RegistrationSlipModal: React.FC<RegistrationSlipModalProps> = ({
  regCode,
  ticketNumber,
  name,
  email,
  validUntil,
  onClose,
}) => {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    regCode
  )}`;

  const handleDownloadPDF = async () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a5",
    });

    // Outer Border
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(1);
    doc.rect(5, 5, 138, 200);

    // Header Banner
    doc.setFillColor(30, 58, 138);
    doc.rect(5, 5, 138, 25, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("LOCO WORKS MANAGEMENT SYSTEM", 74, 16, { align: "center" });
    doc.setFontSize(10);
    doc.text("Employee Registration Verification Card", 74, 23, { align: "center" });

    // 12-Character Code Highlight Box
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(209, 213, 219);
    doc.rect(15, 36, 118, 20, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("VERIFICATION CODE", 74, 42, { align: "center" });

    doc.setFontSize(15);
    doc.setTextColor(30, 58, 138);
    doc.text(regCode, 74, 51, { align: "center" });

    // Employee Details
    let y = 64;
    doc.setFontSize(9.5);
    doc.setTextColor(33, 37, 41);

    const addDetailRow = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 55, y);
      y += 7;
    };

    addDetailRow("Employee Ticket #:", `#${ticketNumber}`);
    addDetailRow("Employee Name:", name);
    addDetailRow("Registered Email:", email);
    addDetailRow("Submission Date:", new Date().toLocaleDateString());
    addDetailRow("Validity Window:", `Valid until ${new Date(validUntil).toLocaleDateString()}`);

    // Embed QR Code Image into PDF
    try {
      const qrDataUrl = await getBase64ImageFromUrl(qrImageUrl);
      doc.addImage(qrDataUrl, "PNG", 56.5, y + 2, 35, 35);
      y += 40;
    } catch (err) {
      console.error("Failed to load QR image for PDF", err);
      y += 5;
    }

    // Verification Instructions
    doc.setFillColor(254, 243, 199);
    doc.rect(15, y, 118, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text("IMPORTANT INSTRUCTIONS FOR VERIFICATION:", 18, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("1. Present this 12-character code or QR code to the Administrator.", 18, y + 12);
    doc.text("2. Admin will verify details and activate your account.", 18, y + 17);

    // Footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text("Automated System Verification Slip - Loco Works Management System", 74, 198, { align: "center" });

    doc.save(`registration_slip_${ticketNumber}.pdf`);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, padding: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="modal-content" style={{ width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto", textAlign: "center", padding: "1.25rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ margin: "0.25rem 0 0.75rem 0" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
            <CheckCircle2 size={30} />
          </div>
          <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Registration Submitted!</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            Your registration request has been staged for Administrative approval.
          </p>
        </div>

        {/* 12-Character Code Box */}
        <div style={{ background: "var(--bg-secondary)", border: "2px dashed var(--primary-color)", padding: "1rem 0.75rem", borderRadius: "10px", margin: "0.85rem 0" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "1px" }}>
            Your Verification Code
          </span>
          <div style={{ fontSize: "clamp(1.2rem, 5vw, 1.75rem)", fontWeight: 800, fontFamily: "monospace", color: "var(--primary-color)", letterSpacing: "clamp(1px, 2vw, 3px)", margin: "0.4rem 0", wordBreak: "break-all" }}>
            {regCode}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "0.65rem" }}>
            <img
              src={qrImageUrl}
              alt="Verification QR Code"
              style={{ width: "100%", maxWidth: "140px", height: "auto", aspectRatio: "1/1", borderRadius: 8, border: "1px solid var(--border-color)", background: "#ffffff", padding: "4px" }}
            />
          </div>
        </div>

        {/* Info Banner */}
        <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "0.75rem", borderRadius: "8px", textAlign: "left", fontSize: "0.8rem", color: "var(--text-primary)", marginBottom: "1.25rem" }}>
          <div style={{ fontWeight: 700, color: "#f59e0b", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
            <AlertTriangle size={15} /> Next Steps for Account Activation:
          </div>
          1. Download or save your verification code &amp; QR code.<br />
          2. A copy of this card has been sent to your registered email.<br />
          3. Present your code to the Administrator within <strong>7 days</strong>.
        </div>

        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
          <button
            onClick={handleDownloadPDF}
            className="admin-submit-btn"
            style={{ flex: "1 1 180px", padding: "0.7rem 1rem" }}
          >
            <Download size={18} /> Download PDF Card
          </button>
          <button
            onClick={onClose}
            className="config-btn"
            style={{ flex: "1 1 100px", padding: "0.7rem 1.25rem" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationSlipModal;
