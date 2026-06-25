import { jsPDF } from "jspdf";

export const PAGE_WIDTH = 210; // A4 size
export const PAGE_HEIGHT = 297;
export const MARGIN_LEFT = 15;
export const MARGIN_RIGHT = 15;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 180mm
export const MARGIN_BOTTOM = 15;

export const COLORS = {
  primary: [99, 102, 241],     // Brand indigo
  dark: [30, 41, 59],          // Slate 800
  muted: [100, 116, 139],      // Slate 500
  border: [226, 232, 240],     // Slate 200
  bg: [248, 250, 252],         // Slate 50
  bgSecondary: [241, 245, 249], // Slate 100
  white: [255, 255, 255],
  success: [16, 185, 129],     // Green
  warning: [245, 158, 11],     // Orange
  danger: [239, 68, 68]        // Red
};

// Ensures there is enough height left on the page; adds a page and draws the header if not.
export const ensureSpace = (
  doc: jsPDF,
  heightNeeded: number,
  currentY: number,
  onNewPage?: (newY: number) => void
): number => {
  if (currentY + heightNeeded > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage();
    const newY = 15; // Top margin on new page
    if (onNewPage) {
      onNewPage(newY);
    }
    return newY;
  }
  return currentY;
};

// Draw a stylized badge with background and border
export const drawBadge = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  status: "completed" | "in_progress" | "partially_completed" | string
): { width: number; height: number } => {
  let bgColor = [241, 245, 249];
  let textColor = [100, 116, 139];
  let borderColor = [226, 232, 240];

  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  if (normalized === "completed" || normalized === "available") {
    bgColor = [209, 250, 229]; // light green
    textColor = [16, 185, 129];
    borderColor = [167, 243, 208];
  } else if (normalized === "in_progress" || normalized === "partially_completed") {
    bgColor = [254, 243, 199]; // light orange
    textColor = [245, 158, 11];
    borderColor = [253, 230, 138];
  } else if (normalized === "incomplete" || normalized === "unavailable") {
    bgColor = [254, 226, 226]; // light red
    textColor = [239, 68, 68];
    borderColor = [254, 202, 202];
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const textWidth = doc.getTextWidth(text);
  const badgeWidth = textWidth + 6;
  const badgeHeight = 5;

  // Background
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
  doc.rect(x, y - 3.8, badgeWidth, badgeHeight, "F");

  // Border (top/bottom/sides)
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.15);
  doc.rect(x, y - 3.8, badgeWidth, badgeHeight, "D");

  // Text
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(text, x + 3, y - 0.4);

  return { width: badgeWidth, height: badgeHeight };
};

// Add standard footer with page numbers
export const addPageNumbers = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Bottom rule line
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_LEFT, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    
    // Left footer: Confidentiality
    doc.text(
      "Loco Works Management System (LWMS) - Shift Summary Report",
      MARGIN_LEFT,
      PAGE_HEIGHT - 8
    );

    // Right footer: Page x of y
    doc.text(
      `Page ${i} of ${pageCount}`,
      PAGE_WIDTH - MARGIN_RIGHT,
      PAGE_HEIGHT - 8,
      { align: "right" }
    );
  }
};
