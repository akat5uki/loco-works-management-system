import React from "react";

interface UserProfile {
  ticket_number: number;
  name: string;
  designation_id: number;
  designation_name: string | null;
  category_name: string | null;
  is_supervisor: boolean;
  email: string | null;
}

interface UserProfileTabProps {
  userProfile: UserProfile;
}

const UserProfileTab: React.FC<UserProfileTabProps> = ({ userProfile }) => {
  return (
    <section className="profile-container">
      <div className="profile-card">
        <div className="profile-card-header">
          <div className="profile-avatar">
            {userProfile.name
              ? userProfile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
              : "E"}
          </div>
          <div className="profile-header-meta">
            <h3>{userProfile.name}</h3>
            <div className="profile-role-badge">
              {userProfile.category_name || (userProfile.is_supervisor ? "Supervisor" : "Staff")}
            </div>
          </div>
        </div>
        <div className="profile-body">
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span className="profile-info-label">Ticket / Employee ID</span>
              <span className="profile-info-value">#{userProfile.ticket_number}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Email ID</span>
              <span className="profile-info-value">{userProfile.email || "Not Specified"}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Designation</span>
              <span className="profile-info-value">{userProfile.designation_name || "Not Specified"}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Role Category</span>
              <span className="profile-info-value">{userProfile.category_name || "Employee"}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UserProfileTab;
