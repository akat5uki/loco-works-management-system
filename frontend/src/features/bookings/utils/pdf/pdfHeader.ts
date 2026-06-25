import { jsPDF } from "jspdf";
import { COLORS, MARGIN_LEFT, CONTENT_WIDTH } from "./pdfStyles";

export const drawPDFHeader = (
  doc: jsPDF,
  dateStr: string,
  shift: number
): number => {
  let y = 20;

  // Title "Loco Works Management System"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text("Loco Works Management System", MARGIN_LEFT, y);

  // Subtitle
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  doc.text("SHIFT SUMMARY REPORT", MARGIN_LEFT, y);

  // Horizontal separating line
  y += 4;
  doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setLineWidth(0.8);
  doc.line(MARGIN_LEFT, y, MARGIN_LEFT + CONTENT_WIDTH, y);

  // Metadata block (Date, Shift, Generated info)
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
  
  // Date Column
  doc.setFont("helvetica", "bold");
  doc.text("Report Date:", MARGIN_LEFT, y);
  doc.setFont("helvetica", "normal");
  doc.text(dateStr, MARGIN_LEFT + 22, y);

  // Shift Column
  const shiftText = shift === 1 ? "Shift 1 (Day)" : "Shift 2 (Night)";
  doc.setFont("helvetica", "bold");
  doc.text("Shift:", MARGIN_LEFT + 75, y);
  doc.setFont("helvetica", "normal");
  doc.text(shiftText, MARGIN_LEFT + 85, y);

  // Generated time Column
  const generatedTime = new Date().toLocaleString();
  doc.setFont("helvetica", "bold");
  doc.text("Generated:", MARGIN_LEFT + 120, y);
  doc.setFont("helvetica", "normal");
  doc.text(generatedTime, MARGIN_LEFT + 140, y);

  // Horizontal boundary line
  y += 5;
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, y, MARGIN_LEFT + CONTENT_WIDTH, y);

  return y + 10; // Return next Y position
};
