import { jsPDF } from "jspdf";
import { COLORS, MARGIN_LEFT, CONTENT_WIDTH, ensureSpace, drawBadge } from "./pdfStyles";
import { groupEmployees } from "../employeeGrouper";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
}

const drawTableHeader = (doc: jsPDF, y: number): number => {
  // Background header block
  doc.setFillColor(COLORS.bgSecondary[0], COLORS.bgSecondary[1], COLORS.bgSecondary[2]);
  doc.rect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);

  doc.text("Employee Name", MARGIN_LEFT + 4, y + 1);
  doc.text("Ticket #", MARGIN_LEFT + 70, y + 1);
  doc.text("Designation", MARGIN_LEFT + 105, y + 1);
  doc.text("Status", MARGIN_LEFT + 155, y + 1);

  // Border bottom line
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_LEFT, y + 3, MARGIN_LEFT + CONTENT_WIDTH, y + 3);

  return y + 7;
};

export const drawPDFAvailability = (
  doc: jsPDF,
  available: Employee[],
  unavailable: Employee[],
  yStart: number
): number => {
  let y = yStart;

  const groupedAvailable = groupEmployees(available);
  const groupedUnavailable = groupEmployees(unavailable);

  // Header Title
  y = ensureSpace(doc, 15, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text("1. Employee Availability Summary (Current Shift)", MARGIN_LEFT, y);
  y += 7;

  // --- A. Available Employees Table ---
  y = ensureSpace(doc, 20, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
  doc.text(`Available Employees (${available.length})`, MARGIN_LEFT, y);
  y += 6;

  // Draw header
  y = drawTableHeader(doc, y);

  if (available.length === 0) {
    y = ensureSpace(doc, 8, y);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text("No employees available.", MARGIN_LEFT + 4, y);
    y += 8;
  } else {
    groupedAvailable.forEach((group) => {
      // Ensure space for group sub-header + first row
      y = ensureSpace(doc, 12, y, (newY) => {
        return drawTableHeader(doc, newY);
      });

      // Group Sub-header Row
      doc.setFillColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
      doc.rect(MARGIN_LEFT, y - 3.5, CONTENT_WIDTH, 5, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
      doc.text(`${group.categoryName.toUpperCase()} — ${group.designationName.toUpperCase()}`, MARGIN_LEFT + 4, y);
      y += 5.5;

      group.employees.forEach((emp) => {
        y = ensureSpace(doc, 7, y, (newY) => {
          return drawTableHeader(doc, newY);
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);

        // Row Text
        doc.text(emp.name, MARGIN_LEFT + 4, y);
        doc.text(emp.ticket_number.toString(), MARGIN_LEFT + 70, y);
        doc.text(emp.designation_name, MARGIN_LEFT + 105, y);
        
        // Status Badge
        drawBadge(doc, "Available", MARGIN_LEFT + CONTENT_WIDTH - 2, y, "Available", true);

        // Grid line
        doc.setDrawColor(COLORS.bgSecondary[0], COLORS.bgSecondary[1], COLORS.bgSecondary[2]);
        doc.setLineWidth(0.1);
        doc.line(MARGIN_LEFT, y + 2, MARGIN_LEFT + CONTENT_WIDTH, y + 2);

        y += 6;
      });
    });
    y += 4; // Spacing after list
  }

  // --- B. Unavailable Employees Table ---
  y = ensureSpace(doc, 20, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
  doc.text(`Unavailable Employees (${unavailable.length})`, MARGIN_LEFT, y);
  y += 6;

  // Draw header
  y = drawTableHeader(doc, y);

  if (unavailable.length === 0) {
    y = ensureSpace(doc, 8, y);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text("No employees unavailable.", MARGIN_LEFT + 4, y);
    y += 8;
  } else {
    groupedUnavailable.forEach((group) => {
      // Ensure space for group sub-header + first row
      y = ensureSpace(doc, 12, y, (newY) => {
        return drawTableHeader(doc, newY);
      });

      // Group Sub-header Row
      doc.setFillColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
      doc.rect(MARGIN_LEFT, y - 3.5, CONTENT_WIDTH, 5, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
      doc.text(`${group.categoryName.toUpperCase()} — ${group.designationName.toUpperCase()}`, MARGIN_LEFT + 4, y);
      y += 5.5;

      group.employees.forEach((emp) => {
        y = ensureSpace(doc, 7, y, (newY) => {
          return drawTableHeader(doc, newY);
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);

        // Row Text
        doc.text(emp.name, MARGIN_LEFT + 4, y);
        doc.text(emp.ticket_number.toString(), MARGIN_LEFT + 70, y);
        doc.text(emp.designation_name, MARGIN_LEFT + 105, y);
        
        // Status Badge
        drawBadge(doc, "Unavailable", MARGIN_LEFT + CONTENT_WIDTH - 2, y, "Unavailable", true);

        // Grid line
        doc.setDrawColor(COLORS.bgSecondary[0], COLORS.bgSecondary[1], COLORS.bgSecondary[2]);
        doc.setLineWidth(0.1);
        doc.line(MARGIN_LEFT, y + 2, MARGIN_LEFT + CONTENT_WIDTH, y + 2);

        y += 6;
      });
    });
    y += 4; // Spacing after list
  }

  return y;
};
