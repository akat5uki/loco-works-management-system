# Implementation Plan — Staff Self-Assessment and Supervisor Approval Workflow

This plan outlines the design and implementation for the Staff Self-Assessment feature. It enables staff members to submit their self-assessments for supervisor approval. Supervisors can view, edit, approve, or reject these assessments, and perform full CRUD operations on staff ratings.

---

## User Review Required

> [!IMPORTANT]
> - **Storage Strategy**: Pending self-assessments will be stored in Redis under the key namespace `assessment:pending:{ticket_number}` for temporary storage. Once approved, the data is removed from Redis and saved to the `employee_job_ratings` table in PostgreSQL.
> - **Job Source**: The list of available assessment tasks/skills is sourced dynamically from the existing `jobs` database table.
> - **Default Rating**: The default rating for unrated jobs will be set to `0` (representing unassessed or no capability).
> - **Double-Guarding Security**: Access control checks are applied on both the client (hiding/showing tiles and views) and the server (enforcing user category and designation permissions in FastAPI route dependencies).

---

## Proposed Changes

### Backend Component

#### [NEW] [schemas.py](file:///home/ansira-u/Documents/Development/loco-works-management-system/backend/app/features/assessments/schemas.py)
- Define validation schemas:
  - `RatingItem`: Job ID and integer rating (validated between 0 and 5, default is 0).
  - `SelfAssessmentSubmit`: List of `RatingItem` elements.
  - `SelfAssessmentRead`: Reads pending assessment details from Redis, including ticket number, employee name, list of ratings, and submission timestamp.
  - `AssessmentApproval`: Structure for supervisor approval (carrying the final approved ratings).
  - `AssessmentRejection`: Optional supervisor remarks for rejection.
  - `EmployeeRatingRead`: Structure to represent approved ratings from PostgreSQL.

#### [NEW] [router.py](file:///home/ansira-u/Documents/Development/loco-works-management-system/backend/app/features/assessments/router.py)
- Create REST endpoints:
  - `POST /self`: Submits/updates staff self-assessment. Validates current user is Staff. Saves JSON to Redis key `assessment:pending:{ticket_number}`.
  - `GET /self`: Retrieves the staff member's pending self-assessment from Redis, alongside their approved ratings from PostgreSQL.
  - `GET /pending`: Supervisor-only. Scans Redis keys `assessment:pending:*` and returns all pending assessments enriched with employee profile details.
  - `POST /approve/{ticket_number}`: Supervisor-only. Accepts final ratings, writes them to `employee_job_ratings` in PostgreSQL, deletes the Redis key, and dispatches a success notification.
  - `POST /reject/{ticket_number}`: Supervisor-only. Deletes the Redis key and dispatches a rejection notification with remarks.
  - `GET /ratings/{ticket_number}`: Supervisor-only. Retrieves PostgreSQL-approved ratings for a staff member.
  - `POST /ratings/{ticket_number}`: Supervisor-only. Direct CRUD write/update to PostgreSQL `employee_job_ratings` table.
  - `DELETE /ratings/{ticket_number}`: Supervisor-only. Removes all rating rows for a staff member.
  - `DELETE /ratings/{ticket_number}/{job_id}`: Supervisor-only. Removes a single job rating for a staff member.

#### [MODIFY] [main.py](file:///home/ansira-u/Documents/Development/loco-works-management-system/backend/app/main.py)
- Register and mount the new assessments router:
  - `app.include_router(assessments_router, prefix=f"{settings.API_V1_STR}/assessments", tags=["assessments"])`

---

### Frontend Component

#### [NEW] [SelfAssessmentUI.tsx](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/features/bookings/SelfAssessmentUI.tsx)
- Create Staff-only assessment workflow page:
  - Fetches the active job list from `/api/v1/jobs`.
  - Displays the current status (e.g., `No Submission`, `Pending Approval`, `Approved`).
  - Provides an interactive star selector for each job.
  - Displays rejection remarks and allows modified resubmission.

#### [MODIFY] [StaffAssessmentUI.tsx](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/features/bookings/StaffAssessmentUI.tsx)
- Upgrade the Supervisor competency manager:
  - Add a **Pending Approvals** tab to display self-assessments waiting in Redis.
  - Allow the supervisor to edit proposed ratings and click **Approve** or **Reject** (with modal remarks input).
  - Add a **Direct Management** tab to edit, create, or delete PostgreSQL-backed ratings.
  - Replace the temporary LocalStorage data sync with calls to the new `/api/v1/assessments/*` API endpoints.

#### [MODIFY] [DashboardTiles.tsx](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/features/dashboard/components/DashboardTiles.tsx)
- Inject the **Self Assessment** tile for Staff dashboard views (when `isSupervisor` is false).

#### [MODIFY] [App.tsx](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/App.tsx)
- Register the new client-side route:
  - `/bookings/self-assessment` (Staff-accessible protected route).

---

## Verification Plan

### Automated Tests
- Run backend verification scripts to test Redis keyspace, and verify database CRUD transactions on `employee_job_ratings`.
- Execute frontend compilation checks:
  ```bash
  npm run build
  ```

### Manual Verification
- Log in as a Staff member, submit a self-assessment, and verify it enters the pending state.
- Log in as a Supervisor, inspect the pending queue, edit the values, approve/reject, and confirm the data syncs to the PostgreSQL database table.
