import React from "react";

interface StaffMember {
  staff_ticket_number: number;
  staff_name: string;
  staff_designation: string;
}

interface SupervisorData {
  supervisor_ticket_number: number;
  supervisor_name: string;
  supervisor_designation: string;
  is_forwarded: boolean;
  staff: StaffMember[];
}

interface LocoViewData {
  loco_number: string;
  supervisors: SupervisorData[];
}

interface LocoAssignment {
  loco_number: string;
  is_forwarded: boolean;
  staff: StaffMember[];
}

interface SupervisorViewData {
  supervisor_ticket_number: number;
  supervisor_name: string;
  supervisor_designation: string;
  locos: LocoAssignment[];
}

interface StaffAssignment {
  loco_number: string;
  supervisor_ticket_number: number;
  supervisor_name: string;
  supervisor_designation: string;
}

interface StaffViewData {
  staff_ticket_number: number;
  staff_name: string;
  staff_designation: string;
  assignments: StaffAssignment[];
}

interface ViewsData {
  by_loco: LocoViewData[];
  by_supervisor: SupervisorViewData[];
  by_staff: StaffViewData[];
}

interface AssignmentsViewProps {
  viewsData: ViewsData | null;
  activeViewTab: "loco" | "supervisor" | "staff";
  setActiveViewTab: (tab: "loco" | "supervisor" | "staff") => void;
}

const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  viewsData,
  activeViewTab,
  setActiveViewTab,
}) => {
  return (
    <section className="view-content-card compiled-assignments-section">
      <div className="section-header">
        <h2>Employee Assignments View</h2>
        <p className="section-subheader">Verify and inspect saved scheduling assignments compiled for this shift.</p>
      </div>

      <div className="views-tabs" style={{ marginTop: "1rem" }}>
        <button
          className={`view-tab-btn ${activeViewTab === "loco" ? "active" : ""}`}
          onClick={() => setActiveViewTab("loco")}
          type="button"
        >
          By Loco View
        </button>
        <button
          className={`view-tab-btn ${activeViewTab === "supervisor" ? "active" : ""}`}
          onClick={() => setActiveViewTab("supervisor")}
          type="button"
        >
          By Supervisor View
        </button>
        <button
          className={`view-tab-btn ${activeViewTab === "staff" ? "active" : ""}`}
          onClick={() => setActiveViewTab("staff")}
          type="button"
        >
          By Staff View
        </button>
      </div>

      {viewsData === null ? (
        <div className="views-loading-state">
          <p>Loading views data...</p>
        </div>
      ) : (
        <div className="views-details-content">

          {/* ── BY LOCO ── */}
          {activeViewTab === "loco" && (
            <div className="views-grid-list">
              {viewsData.by_loco.length === 0 ? (
                <p className="empty-views-text">No assignments found.</p>
              ) : (
                viewsData.by_loco.map((lData) => (
                  <div key={lData.loco_number} className="view-item-box">
                    <div className="item-box-title">
                      <h3>Locomotive #{lData.loco_number}</h3>
                    </div>
                    <div className="view-details-grid">
                      {lData.supervisors.map((sup) => (
                        <div key={sup.supervisor_ticket_number} className="sub-detail-group">
                          <div className="sub-detail-title">
                            <span className="sup-indicator">{sup.supervisor_designation}</span>
                            <strong>{sup.supervisor_name}</strong>
                            <span className="sup-ticket">#{sup.supervisor_ticket_number}</span>
                            {!sup.is_forwarded && <span className="draft-badge">(Draft)</span>}
                          </div>
                          <div className="assigned-staff-list-box">
                            <span className="staff-header-text">Assigned Staff</span>
                            {sup.staff.length === 0 ? (
                              <p className="empty-staff-tag">No staff assigned.</p>
                            ) : (
                              <ul className="sub-detail-list">
                                {sup.staff.map((st) => (
                                  <li key={st.staff_ticket_number}>
                                    <span className="staff-desig-tag">{st.staff_designation}</span>
                                    {st.staff_name}{" "}
                                    <span className="ticket-lbl">#{st.staff_ticket_number}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── BY SUPERVISOR ── */}
          {activeViewTab === "supervisor" && (
            <div className="views-grid-list">
              {viewsData.by_supervisor.length === 0 ? (
                <p className="empty-views-text">No supervisor assignments found.</p>
              ) : (
                viewsData.by_supervisor.map((sData) => (
                  <div key={sData.supervisor_ticket_number} className="view-item-box">
                    <div className="item-box-title">
                      <h3>
                        <span className="title-desig-tag">{sData.supervisor_designation}</span>
                        {sData.supervisor_name}{" "}
                        <span className="title-ticket-lbl">#{sData.supervisor_ticket_number}</span>
                      </h3>
                    </div>
                    <div className="view-details-grid">
                      {sData.locos.map((l) => (
                        <div key={l.loco_number} className="sub-detail-group">
                          <div className="sub-detail-title">
                            <strong>Loco #{l.loco_number}</strong>
                            {!l.is_forwarded && <span className="draft-badge">(Draft)</span>}
                          </div>
                          <div className="assigned-staff-list-box">
                            <span className="staff-header-text">Assigned Staff</span>
                            {l.staff.length === 0 ? (
                              <p className="empty-staff-tag">No staff assigned.</p>
                            ) : (
                              <ul className="sub-detail-list">
                                {l.staff.map((st) => (
                                  <li key={st.staff_ticket_number}>
                                    <span className="staff-desig-tag">{st.staff_designation}</span>
                                    {st.staff_name}{" "}
                                    <span className="ticket-lbl">#{st.staff_ticket_number}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── BY STAFF ── */}
          {activeViewTab === "staff" && (
            <div className="views-grid-list">
              {viewsData.by_staff.length === 0 ? (
                <p className="empty-views-text">No staff assignments found.</p>
              ) : (
                viewsData.by_staff.map((stData) => (
                  <div key={stData.staff_ticket_number} className="view-item-box">
                    <div className="item-box-title">
                      <h3>
                        <span className="title-desig-tag">{stData.staff_designation}</span>
                        {stData.staff_name}{" "}
                        <span className="title-ticket-lbl">#{stData.staff_ticket_number}</span>
                      </h3>
                    </div>
                    <div className="view-details-grid">
                      {stData.assignments.map((asg, idx) => (
                        <div key={idx} className="sub-detail-group staff-assigned-group">
                          <div className="sub-detail-title">
                            <strong>Loco #{asg.loco_number}</strong>
                          </div>
                          <div className="linked-sup-info">
                            <span className="linked-sup-lbl">Supervisor:</span>
                            <span className="linked-sup-val">
                              <span className="staff-desig-tag">{asg.supervisor_designation}</span>
                              {asg.supervisor_name}{" "}
                              <span className="ticket-lbl">#{asg.supervisor_ticket_number}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      )}
    </section>
  );
};

export default AssignmentsView;
