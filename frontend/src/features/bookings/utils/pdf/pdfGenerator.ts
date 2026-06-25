import { jsPDF } from "jspdf";
import { drawPDFHeader } from "./pdfHeader";
import { drawPDFAvailability } from "./pdfAvailability";
import { drawPDFLocoAssignments } from "./pdfLocos";
import { addPageNumbers } from "./pdfStyles";

interface Employee {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string;
  category_id: number;
  category_name: string;
}

interface StaffInfo {
  staff_ticket_number: number;
  staff_name: string;
  staff_designation?: string;
}

interface SupervisorInfo {
  supervisor_ticket_number: number;
  supervisor_name: string;
  supervisor_designation?: string;
  is_forwarded: boolean;
  staff: StaffInfo[];
}

interface LocoInfo {
  loco_number: string;
  status: string;
  supervisors: SupervisorInfo[];
}

interface TaskInfo {
  task_id: number;
  task_description: string;
}

interface JobInfo {
  job_id: number;
  job_description: string;
  stage: number;
  tasks: TaskInfo[];
}

interface RemarkInfo {
  completed: boolean;
  remarks: string;
}

interface LocoRemarks {
  jobs: Record<number, RemarkInfo>;
  tasks: Record<number, RemarkInfo>;
}

interface GeneratePDFOptions {
  dateStr: string;
  shift: number;
  availableEmployees: Employee[];
  unavailableEmployees: Employee[];
  byLoco: LocoInfo[];
  allLocoJobs: Record<string, JobInfo[]>;
  remarksState: Record<string, LocoRemarks>;
}

export const generateShiftSummaryPDF = (options: GeneratePDFOptions) => {
  const {
    dateStr,
    shift,
    availableEmployees,
    unavailableEmployees,
    byLoco,
    allLocoJobs,
    remarksState,
  } = options;

  // Initialize jsPDF doc
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // 1. Draw PDF header
  let y = drawPDFHeader(doc, dateStr, shift);

  // 2. Draw Employee Availability Summary
  y = drawPDFAvailability(doc, availableEmployees, unavailableEmployees, y);

  // 3. Draw Locomotive Assignment Details
  drawPDFLocoAssignments(doc, byLoco, allLocoJobs, remarksState, y);

  // 4. Add page numbers to all pages (two-pass method)
  addPageNumbers(doc);

  // 5. Trigger download file
  doc.save(`shift_summary_${dateStr}_shift_${shift}.pdf`);
};
