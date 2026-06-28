import { jsPDF } from "jspdf";
import { COLORS, MARGIN_LEFT, CONTENT_WIDTH, ensureSpace, drawBadge } from "./pdfStyles";

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

export const drawPDFLocoAssignments = (
  doc: jsPDF,
  byLoco: LocoInfo[],
  allLocoJobs: Record<string, JobInfo[]>,
  remarksState: Record<string, LocoRemarks>,
  yStart: number
): number => {
  let y = yStart;

  // Section Title
  y = ensureSpace(doc, 15, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text("2. Final Locomotive Assignment Details", MARGIN_LEFT, y);
  y += 8;

  if (byLoco.length === 0) {
    y = ensureSpace(doc, 10, y);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text("No locomotive bookings available for this shift.", MARGIN_LEFT, y);
    return y + 10;
  }

  byLoco.forEach((loco) => {
    const locoNum = loco.loco_number;
    const statusText = (loco.status || "incomplete").toUpperCase();
    const jobs = allLocoJobs[locoNum] || [];
    const remarks = remarksState[locoNum];

    // Extract unique staff list
    const uniqueStaffMap = new Map<number, StaffInfo>();
    loco.supervisors.forEach(s => {
      s.staff.forEach(st => {
        uniqueStaffMap.set(st.staff_ticket_number, st);
      });
    });
    const staffList = Array.from(uniqueStaffMap.values());

    // 1. Ensure space for card header + basic info
    y = ensureSpace(doc, 26, y);

    // Card Header Bar
    doc.setFillColor(COLORS.bgSecondary[0], COLORS.bgSecondary[1], COLORS.bgSecondary[2]);
    doc.rect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 8, "F");
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN_LEFT, y - 4, CONTENT_WIDTH, 8, "D");

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text(`Locomotive #${locoNum}`, MARGIN_LEFT + 4, y + 1.5);

    // Header Status Badge
    drawBadge(doc, statusText, MARGIN_LEFT + CONTENT_WIDTH - 2, y + 1.5, statusText, true);

    y += 10;

    // 2. Render Supervisors List
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.text("Supervisors:", MARGIN_LEFT + 4, y);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    if (loco.supervisors.length === 0) {
      doc.text("None booked", MARGIN_LEFT + 26, y);
    } else {
      const supsStr = loco.supervisors
        .map(s => `${s.supervisor_name} (${s.supervisor_designation || "Supervisor"}, #${s.supervisor_ticket_number})`)
        .join(", ");
      
      // Auto-wrap text if it is too long
      const splitSups = doc.splitTextToSize(supsStr, CONTENT_WIDTH - 32);
      doc.text(splitSups, MARGIN_LEFT + 26, y);
      y += (splitSups.length - 1) * 4;
    }
    y += 5;

    // 3. Render Staff List
    y = ensureSpace(doc, 8, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.text("Staff assigned:", MARGIN_LEFT + 4, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    if (staffList.length === 0) {
      doc.text("None booked", MARGIN_LEFT + 28, y);
    } else {
      const staffStr = staffList
        .map(st => `${st.staff_name} (${st.staff_designation || "Staff"}, #${st.staff_ticket_number})`)
        .join(", ");
      
      const splitStaff = doc.splitTextToSize(staffStr, CONTENT_WIDTH - 32);
      doc.text(splitStaff, MARGIN_LEFT + 28, y);
      y += (splitStaff.length - 1) * 4;
    }
    y += 6;

    // 4. Render Operations
    y = ensureSpace(doc, 10, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.text("Operations & Carry Forward Details:", MARGIN_LEFT + 4, y);
    y += 5;

    if (jobs.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
      doc.text("No operations booked for this locomotive.", MARGIN_LEFT + 8, y);
      y += 6;
    } else {
      jobs.forEach((job) => {
        const jobRem = remarks?.jobs[job.job_id] || { completed: false, remarks: "" };
        const jobStatusText = jobRem.completed ? "Completed" : "In Progress";
        
        y = ensureSpace(doc, 12, y);

        // Job details row
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.2);
        doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
        doc.text(`Job ${job.job_id}:`, MARGIN_LEFT + 8, y);
        
        doc.setFont("helvetica", "normal");
        const jobDescWidth = CONTENT_WIDTH - 65;
        const splitJobDesc = doc.splitTextToSize(job.job_description, jobDescWidth);
        doc.text(splitJobDesc, MARGIN_LEFT + 20, y);

        // Job Badge
        drawBadge(doc, jobStatusText, MARGIN_LEFT + CONTENT_WIDTH - 2, y, jobStatusText, true);

        const linesOffset = (splitJobDesc.length - 1) * 4;
        y += linesOffset;

        // Job Remarks
        if (jobRem.remarks) {
          y += 4;
          y = ensureSpace(doc, 6, y);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.8);
          doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
          doc.text(`Remarks: "${jobRem.remarks}"`, MARGIN_LEFT + 20, y);
        }

        y += 5;

        // Render Tasks
        job.tasks.forEach((task) => {
          const taskRem = remarks?.tasks[task.task_id] || { completed: false, remarks: "" };
          const taskStatusText = taskRem.completed ? "Completed" : "In Progress";

          y = ensureSpace(doc, 10, y);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
          
          // Bullet
          doc.text("-", MARGIN_LEFT + 15, y);
          
          const taskDescWidth = CONTENT_WIDTH - 70;
          const splitTaskDesc = doc.splitTextToSize(task.task_description, taskDescWidth);
          doc.text(splitTaskDesc, MARGIN_LEFT + 20, y);

          // Task Badge
          drawBadge(doc, taskStatusText, MARGIN_LEFT + CONTENT_WIDTH - 2, y, taskStatusText, true);

          y += (splitTaskDesc.length - 1) * 4;

          // Task Remarks
          if (taskRem.remarks) {
            y += 4;
            y = ensureSpace(doc, 6, y);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
            doc.text(`Remarks: "${taskRem.remarks}"`, MARGIN_LEFT + 20, y);
          }

          y += 5;
        });
      });
    }

    // Border separator bottom
    y = ensureSpace(doc, 6, y);
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.35);
    doc.line(MARGIN_LEFT, y, MARGIN_LEFT + CONTENT_WIDTH, y);
    y += 10;
  });

  return y;
};
