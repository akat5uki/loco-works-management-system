# Comprehensive Implementation Plan - Admin Access Role & Employee Registration Approval Workflow

This plan outlines the end-to-end architecture and implementation for introducing an **Admin Access Role**, a **Master Data Management CRUD Wizard**, and an **Employee Registration Approval Workflow** with unique 12-character QR verification cards and email notifications.

---

## User Review Required

> [!IMPORTANT]
> **Default Admin Account Generation**: On initial setup, a default Admin account (`ticket_number: 9999`, initial password: `AdminPassword123!`) will be automatically seeded into the database. Upon first login, the system will strictly enforce a mandatory password change before granting access to the Admin Dashboard.

> [!NOTE]
> **Database Staging for Pending Registrations**: Pending registrations will be staged in a dedicated `registration_requests` database table with a 7-day TTL window (`valid_until`). Admin approval will insert the record into the primary `employees` table, allowing login.

---

## Proposed Changes

### 1. Backend Architecture & Database Layer

#### [NEW] [admin models](file:///home/ansira-u/Documents/Development/loco-works-management-system/backend/app/features/admin/models.py)
* Define SQLAlchemy models:
  * `LocoAdmin`: Maps to `loco_admin` table (`ticket_number`, `is_default`, `must_change_password`, `created_at`).
  * `RegistrationRequest`: Maps to `registration_requests` table (`request_id`, `reg_code` [VARCHAR(12), unique=True, index=True], `ticket_number`, `name`, `designation_id`, `email`, `password_hash`, `status`, `remarks`, `valid_until`, `created_at`).

#### [NEW] [admin alembic migration](file:///home/ansira-u/Documents/Development/loco-works-management-system/backend/alembic/versions/add_loco_admin_and_registration_requests.py)
* Create Alembic migration script to create `loco_admin` and `registration_requests` tables with unique constraint on `reg_code` and proper indexes (on `reg_code`, `ticket_number`, `status`, `valid_until`).

#### [MODIFY] [init.sql](file:///home/ansira-u/Documents/Development/loco-works-management-system/infrastructure/database/init.sql) & [postgres.txt](file:///home/ansira-u/Documents/Development/loco-works-management-system/assets/postgres.txt)
* Update database initialization script and documentation with `loco_admin` and `registration_requests` definitions (enforcing `UNIQUE` on `reg_code`), foreign keys, and audit log triggers.

#### [NEW] [admin schemas](file:///home/ansira-u/Documents/Development/loco-works-management-system/backend/app/features/admin/schemas.py)
* Define Pydantic models for admin authentication (`AdminLoginRequest`, `AdminChangePasswordRequest`), employee registration request review (`RegistrationActionRequest`, `ExtendValidityRequest`), and admin management (`AddAdminRequest`).

#### [NEW] [admin router](file:///home/ansira-u/Documents/Development/loco-works-management-system/backend/app/features/admin/router.py)
* Implement endpoints:
  * `POST /api/v1/admin/login`: Distinct Admin login route.
  * `POST /api/v1/admin/change-password`: Force password update for default admin.
  * `GET /api/v1/admin/registration-requests`: Fetch pending/processed registration requests with search & status filters.
  * `POST /api/v1/admin/registration-requests/{reg_code}/action`: Process approval, rejection (with reason), or pending status (with remarks).
  * `POST /api/v1/admin/registration-requests/{reg_code}/extend-validity`: Extend validity period for pending requests.
  * `POST /api/v1/admin/add-admin`: Restrict to existing admins to promote an employee to admin role.
  * `GET /api/v1/admin/crud/{table_name}` & `POST/PUT/DELETE`: Generic Master Data CRUD wizard API for all tables (except `audit_log`, which is strictly read-only).

#### [MODIFY] [auth router](file:///home/ansira-u/Documents/Development/loco-works-management-system/backend/app/features/auth/router.py)
* Update employee `/register` endpoint to create a `RegistrationRequest` instead of directly inserting into `employees`.
* Generate unique 12-character uppercase alphanumeric `reg_code`.
* Trigger background tasks for PDF slip generation and email dispatch.
* Block unapproved employee login attempts with clear status messaging.

#### [MODIFY] [email core](file:///home/ansira-u/Documents/Development/loco-works-management-system/backend/app/core/email.py)
* Add HTML templates for registration verification card emails (with unique 12-char code & PDF attachment) and decision update emails (Approved, Rejected, Remarks/Pending).

---

### 2. Frontend Web Application Layer

#### [NEW] [admin auth page](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/features/admin/AdminLoginPage.tsx) & [password change modal](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/features/admin/AdminChangePasswordModal.tsx)
* Create dedicated Admin Login view and forced first-time password reset dialog.

#### [NEW] [admin dashboard](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/features/admin/AdminDashboardPage.tsx)
* Build responsive modern dashboard layout containing:
  * **Registration Requests Manager**: Search bar (12-char code search), status filter badges, detail verification modal, action buttons (Approve, Reject with reason, Pending with remarks, Extend Validity).
  * **Master Data CRUD Wizard**: Tabbed interface for managing categories, designations, locos, jobs, tasks, and admins, with strict read-only access for Audit Logs.
  * **Admin Staff Management**: Tool to grant admin privileges to existing employees.

#### [MODIFY] [registration page](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/features/auth/RegisterPage.tsx) & [verification slip modal](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/features/auth/components/RegistrationSlipModal.tsx)
* Display completion dialog featuring the unique 12-character verification code, rendered QR code, and a "Download PDF Verification Card" button upon successful registration submission.

#### [MODIFY] [login page](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/features/auth/LoginPage.tsx) & [App router](file:///home/ansira-u/Documents/Development/loco-works-management-system/frontend/src/App.tsx)
* Add "Admin Portal Login" toggle link on standard login page.
* Add protected routes for `/admin/login` and `/admin/dashboard`.

---

## Verification Plan

### Automated Tests & Linting
- Compile Python backend code and run Ruff linter:
  ```bash
  .venv/bin/python -c "import glob; [compile(open(f).read(), f, 'exec') for f in glob.glob('app/**/*.py', recursive=True)]" && .venv/bin/ruff check .
  ```
- Run Vite build and ESLint check on frontend:
  ```bash
  npm run build && npm run lint
  ```

### Manual Verification Flow
1. **Default Admin Setup & Password Reset**: Launch backend, log into `/admin/login` as default admin (`9999`), verify mandatory password change popup.
2. **Registration Submission & PDF Card**: Submit new employee registration, verify unique 12-char code generation, QR code rendering, PDF card download, and email dispatch in Mailpit (`http://localhost:8025`).
3. **Admin Verification & Approval**: Log into Admin Dashboard, search 12-char code, test "Pending with Remarks" and "Extend Validity", test "Approve", verify employee can now log in.
4. **Master Data CRUD & Audit Read-Only**: Test CRUD wizard across master tables and verify audit table is strictly read-only.
