# Loco Works Management System (LWMS)

**Loco Works Management System (LWMS)** is a production-grade enterprise web application designed for locomotive manufacturing workshops and maintenance sheds. It coordinates labor allocation, tracks manufacturing telemetry, logs shift-wise repair jobs, manages employee scheduling, enables real-time communications across all active supervisors, and provides a full competency assessment system — all from a single, unified platform.

---

## Table of Contents

1. [Intent & Purpose](#1-intent--purpose)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Web App Sitemap](#6-web-app-sitemap)
7. [Key Features](#7-key-features)
8. [Security Design](#8-security-design)
9. [Getting Started (Development)](#9-getting-started-development)
10. [Production Deployment](#10-production-deployment)
11. [Environment Variables](#11-environment-variables)
12. [Project Structure](#12-project-structure)
13. [License](#13-license)

---

## 1. Intent & Purpose

Locomotive assembly and repair workshops are highly complex environments requiring strict organizational discipline. Hundreds of technicians and team leads coordinate over multiple shifts to perform precision repairs and installations.

LWMS was built to:

- **Enforce Data & Labor Integrity** — Ensure that technicians are only assigned to jobs matching their designation and are never double-booked across different locomotives in the same shift.
- **Enable Real-Time Telemetry & Event Broadcasting** — Monitor locomotive repair stages and push instant notifications across all active supervisors via WebSocket connections.
- **Coordinate Safe Concurrent Editing** — Use distributed Redis-based lock windows so multiple supervisors cannot conflict when assigning staff to the same shift.
- **Streamline Administration** — Manage employee registration requests, system access controls, and audit trails from a dedicated admin portal.
- **Assess Workforce Competency** — Enable staff to submit self-assessments and supervisors to review, approve, reject, and directly manage job-level competency ratings.
- **Simplify Reporting** — Provide clean print-to-PDF shift summary reports for managers and administrative leads.

---

## 2. System Architecture

LWMS utilizes a modern, resilient microservices architecture orchestrated with Docker Compose:

```
                  ┌────────────────────────────────────────────┐
                  │                   Nginx                    │
                  │          (Reverse Proxy + Rate Limiting)   │
                  └──────────────┬────────────────┬────────────┘
                                 │                │
               ┌─────────────────▼──┐      ┌──────▼─────────────────┐
               │   React Frontend   │      │   FastAPI Web Backend  │
               │   (Static Assets)  │      │  (App Servers 1, 2, 3) │
               └────────────────────┘      └──────┬─────────────┬───┘
                                                  │             │
                       ┌──────────────────────────┘             │
                       │ (SQL over asyncpg)     (Redis Commands)│
                       ▼                                        ▼
          ┌────────────────────────┐              ┌───────────────────────┐
          │  PostgreSQL Database   │              │  Redis Sentinel       │
          │  (Primary + Replica)   │              │  Cluster (HA Cache)   │
          └────────────────────────┘              └───────────────────────┘
```

### Infrastructure Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Reverse Proxy** | Nginx (`nginx:stable-alpine`) | Serves frontend static assets, load-balances API requests across 3 web servers, rate-limits auth routes |
| **Frontend** | React 19 + TypeScript + Vite | SPA with client-side routing, Vanilla CSS theming, jsPDF export |
| **Backend** | FastAPI + SQLAlchemy + asyncpg + Uvicorn | Async API server (3 replicas) with modular feature routing |
| **Primary Database** | PostgreSQL (Bitnami) | Write target for all mutating operations |
| **Replica Database** | PostgreSQL (Bitnami, streaming replication) | Read target with lag mitigation |
| **Cache & Pub/Sub** | Redis + Redis Sentinel (3-node HA cluster) | Session store, distributed locks, Pub/Sub chat, telemetry stream, OTP cache |
| **Schema Migrations** | Alembic | Production-grade out-of-band database migrations |
| **SSL/TLS** | Let's Encrypt (Certbot) | Automatic certificate issuance and renewal |
| **Email (Dev)** | Mailpit | Local SMTP sink for development OTP testing |
| **Tunnel (Dev)** | ngrok | Optional public tunnel for external testing |

### Database Routing

A custom `ContextVar`-based middleware (`db_routing_middleware`) in [backend/app/main.py](backend/app/main.py) automatically routes all `POST`/`PUT`/`DELETE`/`PATCH` requests to the **primary** database and `GET` requests to the **replica**. A short-lived `write_window_lag` cookie ensures read-your-own-writes consistency after a mutating operation.

---

## 3. Technology Stack

### Backend

| Library | Version | Purpose |
|---------|---------|---------|
| `fastapi` | ≥ 0.137 | Async web framework |
| `uvicorn` | ≥ 0.49 | ASGI production server |
| `sqlalchemy[asyncio]` | ≥ 2.0 | ORM & async query engine |
| `asyncpg` | ≥ 0.31 | High-performance PostgreSQL async driver |
| `alembic` | ≥ 1.18 | Database schema migration tool |
| `redis` | ≥ 8.0 | Redis Sentinel client |
| `hiredis` | ≥ 3.4 | Accelerated Redis response parser |
| `python-jose[cryptography]` | ≥ 3.5 | JWT access token signing |
| `passlib[bcrypt]` | ≥ 1.7 | Password hashing (bcrypt) |
| `pydantic-settings` | ≥ 2.14 | Environment variable config via `.env` |
| `python-multipart` | ≥ 0.0.32 | Form data parsing |
| Python | ≥ 3.11 | Runtime |
| uv | Latest | Ultra-fast package manager & lockfile |

### Frontend

| Library | Version | Purpose |
|---------|---------|---------|
| `react` | 19.x | UI framework |
| `react-router-dom` | 7.x | SPA client-side routing |
| `axios` | ≥ 1.18 | HTTP API client |
| `lucide-react` | ≥ 1.20 | Icon library |
| `jspdf` | ≥ 4.2 | Client-side PDF export |
| `html2canvas` | Latest | DOM-to-canvas for PDF rendering |
| `dompurify` | Latest | HTML sanitization for chat messages |
| `vite` | ≥ 8.0 | Build toolchain |
| TypeScript | ≥ 6.0 | Type-safe JavaScript |

---

## 4. Database Schema

All schema changes are managed via Alembic migrations located in `backend/alembic/versions/`.

### Entity Relationship Overview

```
  ┌──────────────────┐          ┌──────────────────┐          ┌────────────────────────┐
  │ employee_category│◄─────────│   designation    │◄─────────│       employees        │
  │ category_id (PK) │          │ designation_id   │          │ ticket_number (PK)     │
  │ category_name    │          │ designation_name │          │ name                   │
  └──────────────────┘          │ category_id (FK) │          │ designation_id (FK)    │
                                └──────────────────┘          │ email (Unique)         │
                                                              │ password (hashed)      │
                                                              │ nonce                  │
                                                              └───────────┬────────────┘
                                                                          │
          ┌───────────────┬──────────────────────┬───────────────────────┼────────────────────────┐
          ▼               ▼                      ▼                       ▼                        ▼
  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
  │  loco_admin  │  │employee_avail..│  │ employee_bookings│  │employee_notif...│  │ employee_job_ratings │
  │ ticket_no PK │  │ availability_id│  │ booking_id (PK)  │  │notification_id  │  │ rating_id (PK)       │
  │ password     │  │ date_time      │  │ loco_number (FK) │  │ ticket_no (FK)  │  │ ticket_no (FK)       │
  │ is_default   │  │ shift          │  │ supervisor_ticket │  │ message         │  │ job_id (FK)          │
  └──────────────┘  └────────────────┘  └──────────────────┘  └─────────────────┘  │ rating (0–10)        │
                                                                                    └──────────────────────┘
```

### Table Definitions

#### `employee_category`
High-level role groups (e.g. `Supervisor`, `Staff`).
| Column | Type | Constraints |
|--------|------|-------------|
| `category_id` | Integer | PK |
| `category_name` | String | Unique, Not Null |

#### `designation`
Specific professional titles linked to categories.
| Column | Type | Constraints |
|--------|------|-------------|
| `designation_id` | Integer | PK |
| `designation_name` | String | Not Null |
| `category_id` | Integer | FK → `employee_category`, Not Null |

#### `employees`
Employee authentication and profile records.
| Column | Type | Constraints |
|--------|------|-------------|
| `ticket_number` | Integer | PK |
| `name` | String | Not Null |
| `designation_id` | Integer | FK → `designation`, Not Null |
| `email` | String | Unique, Not Null |
| `password` | String | Bcrypt hashed, Not Null |
| `nonce` | String | Cryptographic session salt, Not Null |

#### `loco_type`
Locomotive model classification (e.g. `WAG-9`, `WAP-5`, `EF12K`).
| Column | Type | Constraints |
|--------|------|-------------|
| `loco_type_id` | Integer | PK |
| `loco_type_name` | String | Unique, Not Null |

#### `loco`
Active locomotives registered in the workshop.
| Column | Type | Constraints |
|--------|------|-------------|
| `loco_number` | Integer | PK |
| `loco_type_id` | Integer | FK → `loco_type`, Not Null |
| `stage` | Integer | Manufacturing stage (e.g. `0`, `5`, `6`, `7`, `9`) |
| `despatched` | Boolean | Default `False` |
| `despatch_date` | DateTime (TZ) | Nullable |

#### `jobs`
Repair and assembly jobs linked to manufacturing stages.
| Column | Type | Constraints |
|--------|------|-------------|
| `job_id` | Integer | PK |
| `job_description` | String | Not Null |
| `stage` | Integer | Target stage, Not Null |

#### `employee_job_ratings`
Stores supervisor-approved competency ratings for each employee per job.
| Column | Type | Constraints |
|--------|------|-------------|
| `rating_id` | Integer | PK, Autoincrement |
| `ticket_number` | Integer | FK → `employees` (CASCADE) |
| `job_id` | Integer | FK → `jobs` (CASCADE) |
| `rating` | Integer | 0–10 competency score |
| — | — | Unique: `(ticket_number, job_id)` |

#### `loco_bookings`
Maps repair jobs to locomotives for a specific shift. Composite PK.
| Column | Type | Constraints |
|--------|------|-------------|
| `loco_number` | Integer | PK, FK → `loco` (CASCADE) |
| `date_time` | DateTime (TZ) | PK |
| `job_id` | Integer | PK, FK → `jobs` |
| `ticket_number` | Integer | FK → `employees` (assigning supervisor) |
| `designation_id` | Integer | FK → `designation` |
| `shift` | Integer | Not Null |

#### `booking_tasks`
Detailed subtask descriptions logged under a loco booking.
| Column | Type | Constraints |
|--------|------|-------------|
| `task_id` | BigInteger | PK, Autoincrement |
| `loco_number` | Integer | Composite FK → `loco_bookings` (CASCADE) |
| `date_time` | DateTime (TZ) | Composite FK |
| `job_id` | Integer | Composite FK |
| `task_description` | Text | Not Null |

#### `employee_availability`
Records which employees are present on-site for a given shift.
| Column | Type | Constraints |
|--------|------|-------------|
| `availability_id` | Integer | PK, Autoincrement |
| `date_time` | DateTime (TZ) | Not Null |
| `shift` | Integer | Not Null |
| `ticket_number` | Integer | FK → `employees` (CASCADE) |
| — | — | Unique: `(date_time, shift, ticket_number)` |

#### `employee_bookings`
Allocates supervisors and staff members to locomotives for a shift.
| Column | Type | Constraints |
|--------|------|-------------|
| `booking_id` | Integer | PK, Autoincrement |
| `loco_number` | Integer | FK → `loco` (CASCADE) |
| `date_time` | DateTime (TZ) | Not Null |
| `shift` | Integer | Not Null |
| `supervisor_ticket_number` | Integer | FK → `employees` (CASCADE) |
| `staff_ticket_number` | Integer | FK → `employees` (CASCADE), Nullable |
| `is_forwarded` | Boolean | Default `False` |

#### `employee_notifications`
In-app notification records per employee.
| Column | Type | Constraints |
|--------|------|-------------|
| `notification_id` | Integer | PK, Autoincrement |
| `ticket_number` | Integer | FK → `employees` (CASCADE) |
| `message` | String(500) | Not Null |
| `is_read` | Boolean | Default `False` |
| `created_at` | DateTime (TZ) | Default `utcnow` |

#### `loco_booking_remarks`
Shift-end progress remarks submitted by supervisors per locomotive job.
| Column | Type | Constraints |
|--------|------|-------------|
| `remarks_id` | Integer | PK, Autoincrement |
| `loco_number` | Integer | FK → `loco` (CASCADE) |
| `date_time` | DateTime (TZ) | Not Null |
| `shift` | Integer | Not Null |
| `supervisor_ticket_number` | Integer | FK → `employees` (CASCADE) |
| `job_id` | Integer | FK → `jobs` (CASCADE) |
| `task_id` | BigInteger | Nullable (references `booking_tasks`) |
| `remarks` | Text | Not Null |
| `completed` | Boolean | Default `False` |

#### `loco_admin`
Administrators granted access to the LWMS admin portal.
| Column | Type | Constraints |
|--------|------|-------------|
| `ticket_number` | Integer | PK, FK → `employees` (CASCADE) |
| `password` | String | Separate admin password hash |
| `nonce` | String | Cryptographic session salt |
| `is_default` | Boolean | Default `False` |
| `must_change_password` | Boolean | Default `False` |
| `employee_portal_enabled` | Boolean | Default `False` |
| `created_at` | DateTime (TZ) | Not Null |

#### `registration_requests`
Pending employee self-registration submissions awaiting admin approval.
| Column | Type | Constraints |
|--------|------|-------------|
| `request_id` | Integer | PK, Autoincrement |
| `reg_code` | String(12) | Unique, Indexed |
| `ticket_number` | Integer | Indexed |
| `name` | String | Not Null |
| `designation_id` | Integer | FK → `designation` |
| `email` | String | Not Null |
| `password_hash` | String | Not Null |
| `status` | String | `PENDING` / `APPROVED` / `REJECTED`, Indexed |
| `remarks` | Text | Nullable |
| `valid_until` | DateTime (TZ) | Indexed |
| `created_at` | DateTime (TZ) | Not Null |

#### `audit_logs` *(time-partitioned)*
Immutable PostgreSQL trigger-based audit trail for all operational table mutations.
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | BigInteger | PK, Autoincrement |
| `table_name` | Text | Not Null |
| `operation` | Text | `INSERT` / `UPDATE` / `DELETE` |
| `record_pk` | Text | Primary key of the affected row |
| `old_data` | JSONB | Row state before the change |
| `new_data` | JSONB | Row state after the change |
| `changed_by` | Integer | Employee ticket number |
| `changed_at` | DateTime (TZ) | PK (partition key) |

> The `audit_logs` table is partitioned by month using PostgreSQL range partitioning for long-term scalability.

---

## 5. API Reference

All endpoints are served under the `/api/v1` prefix. Interactive Swagger docs are available at `/api/v1/openapi.json`.

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/me` | Get profile of the currently authenticated employee |
| `POST` | `/login` | Authenticate using ticket number and password |
| `POST` | `/logout` | Invalidate the current session cookie |
| `POST` | `/register` | Submit a new employee registration request |
| `POST` | `/verify-otp` | Verify email OTP and complete login or registration |
| `POST` | `/resend-otp` | Resend OTP verification email |
| `POST` | `/forgot-password` | Request a password reset OTP |
| `POST` | `/reset-password` | Submit new password with OTP verification |
| `POST` | `/change-password` | Change the authenticated employee's password |

### Employees (`/api/v1/employees`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all registered employees |
| `GET` | `/designations` | List all available designations |
| `GET` | `/categories` | List all employee categories |
| `GET` | `/stats` | Retrieve workforce statistics and category breakdowns |

### Locomotives (`/api/v1/locos`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stats/production` | Get production stage distribution statistics |
| `GET` | `/types` | List all locomotive models/types |
| `POST` | `/types` | Create a new locomotive type |
| `PUT` | `/types/{loco_type_id}` | Update a locomotive type |
| `DELETE` | `/types/{loco_type_id}` | Delete a locomotive type |
| `GET` | `/` | List all active locomotives |
| `POST` | `/` | Register a new locomotive |
| `GET` | `/type-counts` | Retrieve count of locos grouped by type |
| `GET` | `/ongoing-jobs` | List locos with active in-progress bookings |
| `PUT` | `/{loco_number}` | Update locomotive details |
| `DELETE` | `/{loco_number}` | Remove a locomotive from the system |

### Jobs (`/api/v1/jobs`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all repair/assembly jobs |
| `POST` | `/` | Create a new job entry |
| `PUT` | `/{job_id}` | Update a job entry |
| `DELETE` | `/{job_id}` | Delete a job entry |

### Loco Bookings (`/api/v1/bookings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/` | Create a new loco-job booking for a shift |
| `POST` | `/tasks` | Add a sub-task to an existing booking |
| `POST` | `/jobs` | Add a new job to an existing loco booking |
| `GET` | `/` | List all loco bookings (with filters) |
| `GET` | `/loco/{loco_number}` | Get all bookings for a specific locomotive |
| `DELETE` | `/{loco_number}/{date_time}` | Remove all bookings for a loco on a date |
| `DELETE` | `/{loco_number}/{date_time}/{job_id}` | Remove a specific job booking |
| `DELETE` | `/tasks/{task_id}` | Remove a specific booking sub-task |
| `PUT` | `/tasks/{task_id}` | Update a booking sub-task description |
| `PUT` | `/{loco_number}/{date_time}/{job_id}` | Update a booking's designation |

### Employee Bookings (`/api/v1/bookings/employees`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/availabilities` | Query employee availability for a date and shift |
| `POST` | `/availabilities` | Mark employees as available for a shift |
| `GET` | `/locos` | List locos available for supervisor booking on a shift |
| `POST` | `/bookings/lock` | Acquire a distributed edit lock on a loco for a shift |
| `POST` | `/bookings/unlock` | Release a distributed edit lock |
| `POST` | `/bookings` | Create supervisor and staff allocation entries |
| `GET` | `/bookings` | Retrieve all employee booking allocations |
| `GET` | `/notifications` | Fetch in-app notifications for the current user |
| `POST` | `/notifications/{id}/read` | Mark a notification as read |
| `GET` | `/views` | Get full shift view data for all locos |
| `GET` | `/remarks` | Query loco booking remarks for a shift |
| `POST` | `/remarks` | Submit end-of-shift remarks for a booking |

### Competency Assessments (`/api/v1/assessments`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/self` | Staff submit or update their self-assessment (Redis-cached) |
| `GET` | `/self` | Staff retrieve their currently pending self-assessment |
| `GET` | `/pending` | Supervisor retrieves all pending self-assessments for review |
| `POST` | `/approve/{ticket_number}` | Supervisor approves self-assessment and saves ratings to DB |
| `POST` | `/reject/{ticket_number}` | Supervisor rejects a self-assessment with remarks |
| `GET` | `/ratings/{ticket_number}` | Get all job competency ratings for an employee |
| `POST` | `/ratings/{ticket_number}` | Supervisor directly sets competency ratings for an employee |
| `DELETE` | `/ratings/{ticket_number}` | Delete all competency ratings for an employee |
| `DELETE` | `/ratings/{ticket_number}/{job_id}` | Delete a single job rating for an employee |

### Chat (`/api/v1/chat`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/history/{room}` | Retrieve recent message history for a chat room |
| `WS` | `/ws/{room}` | Connect to a real-time chat WebSocket channel |

### Realtime (`/api/v1/realtime`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `WS` | `/ws` | WebSocket connection for live telemetry event streaming |

### Admin Portal (`/api/v1/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/me` | Get profile of the authenticated administrator |
| `POST` | `/login` | Admin login; issues OTP challenge for non-default admins |
| `POST` | `/verify-login-otp` | Verify OTP and issue admin session cookies |
| `POST` | `/logout` | Invalidate admin session |
| `POST` | `/change-password` | Update admin password |
| `POST` | `/set-employee-password` | Reset any employee's password |
| `GET` | `/registration-requests` | List all registration request submissions |
| `QUERY` | `/registration-requests` | Filtered query of registration requests |
| `POST` | `/registration-requests/{reg_code}/action` | Approve or reject a registration request |
| `POST` | `/registration-requests/{reg_code}/extend-validity` | Extend registration validity window |
| `GET` | `/admins` | List all admin accounts |
| `POST` | `/add-admin` | Promote an employee to admin; issues OTP challenge |
| `POST` | `/verify-registration-otp` | Verify OTP to finalize admin promotion |
| `DELETE` | `/admins/{ticket_number}` | Revoke admin privileges |
| `GET` | `/audit-logs` | Browse paginated database audit log entries |
| `QUERY` | `/audit-logs` | Filtered query of audit logs |
| `GET/POST/PUT/DELETE` | `/master-data/categories` | Manage employee category records |
| `GET/POST/PUT/DELETE` | `/master-data/designations` | Manage designation records |
| `GET/POST/PUT/DELETE` | `/master-data/employees` | Manage employee records directly |

> **Note on `QUERY` method:** LWMS uses the non-standard HTTP `QUERY` method (RFC-draft) for rich, body-carried filter queries on admin tables. Starlette/FastAPI natively supports this via `api_route(..., methods=["QUERY"])`.

---

## 6. Web App Sitemap

### Public Routes

| Route | Page | Access |
|-------|------|--------|
| `/` | Landing Page | Public |
| `/login` | Employees Login Portal | Public |
| `/register` | Employee Registration | Public |
| `/verify-otp` | OTP Verification | Public |
| `/forgot-password` | Forgot Password | Public |
| `/reset-password` | Password Reset | Public |
| `/admin/login` | Admin Portal Login | Public |
| `/session-expired` | Expired Session Screen | Public |
| `/*` | 404 Not Found Page | Public |

### Protected Employee Routes (Requires JWT Session)

| Route | Page | Role Required |
|-------|------|--------------|
| `/dashboard` | Main Dashboard (chat, telemetry, notifications) | All Employees |
| `/bookings/loco` | Loco Booking Manager | Supervisor only |
| `/bookings/availability` | Staff Availability Logger | Supervisor only |
| `/bookings/employees` | Staff Booking Wizard (2-step) | Supervisor only |
| `/bookings/carry-forward` | Job Carry Forward | Supervisor only |
| `/bookings/preview` | Shift Summary & PDF Export | All Employees |
| `/bookings/knowledge-base` | Job Knowledge Base | Supervisor only |
| `/bookings/staff-assessment` | Staff Competency Assessment Manager | Supervisor only |
| `/bookings/self-assessment` | Employee Self-Assessment Submission | Staff only |
| `/crud` | Master Data Management | Supervisor only |

### Protected Admin Routes

| Route | Page | Access |
|-------|------|--------|
| `/admin/dashboard` | Admin Control Panel | Admin Only |

---

## 7. Key Features

### Supervisor Dashboard
- **Loco Booking**: Assign repair jobs to active locomotives per shift, select individual subtasks, and log job descriptions.
- **Staff Availability Manager**: Mark which employees are on-site and available for an upcoming day or night shift.
- **Staff Booking Wizard (2-Step)**:
  - **Step 1 — Supervisor Booking**: Claim ownership of locomotive bookings for the shift.
  - **Step 2 — Staff Allocation**: Assign technicians to locomotives with automated designation validation and double-booking protection.
- **My Bookings**: View personal scheduling and supervisor-to-staff allocations.
- **Job Carry Forward**: Propagate incomplete bookings from a previous shift to the current one.
- **Knowledge Base**: Browse job-specific guidance linked to each repair/manufacturing stage.

### Competency Assessment System
- **Self-Assessment (Staff)**: Staff members submit job-by-job competency self-ratings (0–10 scale) stored temporarily in Redis pending supervisor review.
- **Supervisor Review Panel**: Supervisors view all pending self-assessments, can edit ratings before approving, and send approval or rejection notifications.
- **Direct Rating Management**: Supervisors can set, update, and clear job ratings for any employee directly without going through the self-assessment flow.
- **Notification Integration**: Employees receive in-app and real-time notifications when their self-assessment is approved or rejected.

### Realtime Collaboration
- **Live Telemetry Stream**: Real-time WebSocket broadcasting of workshop events through Redis Streams (`workshop_telemetry`).
- **Chat Rooms**: Two collaborative channels — `General` (all employees) and `Supervisors` (restricted). Powered by Redis Pub/Sub with configurable message history.

### Admin Portal
- **Registration Approval Workflow**: Review and approve or reject employee self-registration requests with optional remarks and validity extension.
- **Password Management**: Reset any employee's password from the admin console.
- **Master Data CRUD**: Directly manage categories, designations, employees, and loco data.
- **Admin Management**: Promote employees to admin (with OTP verification) and revoke admin access.
- **Audit Log Viewer**: Browse a time-partitioned, trigger-generated audit trail of all mutations to operational tables, with filtered `QUERY` method support.
- **Email OTP Verification**: Non-default admin logins and admin promotions require a 6-digit OTP email verification step when `ENABLE_EMAIL_OTP=1`.

### Reporting
- **Shift Preview**: Full shift summary with locomotive assignments, job lists, subtasks, and booking remarks.
- **Print-to-PDF Export**: Client-side jsPDF + html2canvas rendering for offline distribution.
- **Employee Lists**: Segregated available/unavailable employee lists sorted by designation and ticket number.

---

## 8. Security Design

LWMS implements a layered, double-guarded security architecture:

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | HTTP-only JWT cookies with cryptographic `nonce` validation — resistant to token reuse after logout or password change |
| **Admin Separation** | Admins carry a separate credential store (`loco_admin` table) and a dedicated session namespace (`session:{ticket}:admin`) |
| **Admin OTP (2FA)** | Non-default admin logins and promotions require a 6-digit OTP sent to the registered email when `ENABLE_EMAIL_OTP=1`; default admin bypasses OTP for emergency access |
| **Dual-Cookie Shield** | `session_id_strict` (SameSite=Strict) + `session_id_embed` (SameSite=None; Partitioned) for CHIPS compliance across embedded contexts |
| **Password Hashing** | bcrypt via `passlib` for all employee and admin passwords |
| **API Rate Limiting** | Nginx `limit_req_zone` (1 req/s, burst 5) on all auth endpoints |
| **DB Write Routing** | Context-aware read/write splitting via `ContextVar` middleware; short-lived `write_window_lag` cookie prevents stale reads |
| **Audit Trail** | PostgreSQL trigger-based immutable `audit_logs` with monthly range partitioning |
| **OTP Verification** | Email-based OTP (6-digit, Redis-cached) for employee registration, employee login, admin login, and admin promotion — configurable expiry |
| **Input Validation** | Pydantic schema validation on all request bodies (backend) + client-side field checks (frontend) |
| **Zero-Secrets Policy** | No credentials, keys, or secrets are hardcoded; all sensitive values are loaded from `.env` at runtime |
| **CORS** | Strict origin allowlist read from `CORS_ALLOWED_ORIGINS` environment variable |

---

## 9. Getting Started (Development)

### Prerequisites

- **Docker & Docker Compose** (v2.x)
- **Node.js** (v20+) and **npm**

### Setup

**1. Clone the repository:**
```bash
git clone https://github.com/akat5uki/loco-works-management-system.git
cd loco-works-management-system
```

**2. Configure environment:**
```bash
cp .env.example .env
# Edit .env and populate all required values
# Minimum: POSTGRES_PASSWORD, REDIS_PASSWORD, SECRET_KEY, DEFAULT_ADMIN_PASSWORD
```

**3. Build the frontend:**
```bash
cd frontend
npm install
npm run build
cd ..
```

**4. Launch the full stack:**
```bash
docker compose up -d
```

**5. Run database migrations:**
```bash
docker compose exec web-1 alembic upgrade head
```

**6. Seed initial master data** *(first run only)*:
```bash
# Seed designation categories and designations
backend/.venv/bin/python assets/scripts/seed_designations.py

# Seed standard repair jobs
backend/.venv/bin/python assets/scripts/seed_jobs.py

# (Optional) Seed sample employee data
backend/.venv/bin/python assets/scripts/populate_sample_data.py
```

The application will be available at:
- **Frontend + API**: `http://localhost:8082`
- **Admin Portal**: `http://localhost:8082/admin/login`
- **API Docs (Swagger)**: `http://localhost:8082/api/v1/openapi.json`
- **Mailpit (SMTP sink)**: `http://localhost:8025`

### Frontend Development Server

To run the frontend in hot-reload dev mode:
```bash
cd frontend
npm run dev
```

---

## 10. Production Deployment

For a complete production deployment guide including server hardening, SSL certificate setup, and automated backups, refer to [assets/docs/production_deployment_guide.md](assets/docs/production_deployment_guide.md).

### Quick Production Deploy

```bash
# 1. Generate secure credentials and populate .env
cp .env.example .env  # fill in all secrets, set COOKIE_SECURE_STRICT=True, ENABLE_EMAIL_OTP=1

# 2. Build frontend production bundle
cd frontend && npm install && npm run build && cd ..

# 3. Build and start production containers (no volume bind mounts)
docker compose -f docker-compose.prod.yml up -d --build

# 4. Run database migrations out-of-band
docker compose -f docker-compose.prod.yml exec web-1 alembic upgrade head

# 5. Verify health status
curl http://localhost/api/v1/health
```

`docker-compose.prod.yml` runs fully **immutable** container images (no source bind-mounts), includes **health checks** for all services, enforces **CPU and memory resource limits**, and excludes development-only tools (`mailpit`, `ngrok`).

---

## 11. Environment Variables

All sensitive settings are stored in a `.env` file. Copy `.env.example` to get started. **Never commit `.env` to version control.**

### Application General

| Variable | Description |
|----------|-------------|
| `PROJECT_NAME` | Application display name |
| `API_V1_STR` | API routing prefix (default: `/api/v1`) |
| `BACKEND_HOST` | Network interface binding for FastAPI (default: `0.0.0.0`) |
| `BACKEND_PORT` | FastAPI server port (default: `8000`) |
| `LOCO_STAGES` | Comma-separated list of valid manufacturing stage numbers |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |
| `PYTHONUNBUFFERED` | Enable unbuffered Python logging |

### Database & Replication

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | PostgreSQL database username |
| `POSTGRES_PASSWORD` | PostgreSQL database password |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_REPLICATION_USER` | Replication stream username |
| `POSTGRES_REPLICATION_PASSWORD` | Replication stream password |
| `DATABASE_PRIMARY_URL` | SQLAlchemy async URL for write (primary) database |
| `DATABASE_REPLICA_URL` | SQLAlchemy async URL for read (replica) database |
| `DB_POOL_SIZE` | Connection pool size per engine |
| `DB_MAX_OVERFLOW` | Max overflow connections beyond pool size |
| `DB_ECHO` | Log all SQL statements (`True`/`False`) |

### Redis Sentinel

| Variable | Description |
|----------|-------------|
| `REDIS_SENTINELS` | Comma-separated Sentinel `host:port` list |
| `REDIS_MASTER_SET` | Redis Sentinel master set name |
| `REDIS_PASSWORD` | Redis authentication password |
| `REDIS_URL` | Standalone fallback Redis URL |
| `REDIS_SOCKET_TIMEOUT` | Socket operation timeout in seconds |

### Security & Session

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key (`openssl rand -hex 32`) |
| `ALGORITHM` | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiry window |
| `SESSION_EXPIRE_SECONDS` | Sliding session duration in seconds |
| `COOKIE_SECURE_STRICT` | Enable `Secure` flag on strict cookies (`True` for HTTPS) |
| `COOKIE_SECURE_EMBED` | Enable `Secure` flag on embedded/CHIPS cookies |
| `WRITE_WINDOW_LAG_SECONDS` | Duration of write-lag cookie for read-your-own-writes |

### Email OTP Verification

| Variable | Description |
|----------|-------------|
| `ENABLE_EMAIL_OTP` | Toggle OTP email verification (`1` = on, `0` = off) |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (587 for TLS, 465 for SSL, 1025 for Mailpit) |
| `SMTP_USERNAME` | SMTP account username |
| `SMTP_PASSWORD` | SMTP account password or app token |
| `SMTP_FROM_EMAIL` | Sender address for outbound emails |
| `SMTP_USE_TLS` | Enable STARTTLS for outgoing emails |
| `SMTP_USE_SSL` | Enable direct SSL for outgoing emails |
| `OTP_EXPIRE_SECONDS` | OTP validity window in seconds (default: 180s / 3 min) |
| `REGISTRATION_SESSION_EXPIRE_SECONDS` | Temp registration cache TTL in Redis (default: 300s) |

### Nginx & External Ports

| Variable | Description |
|----------|-------------|
| `NGINX_HTTP_PORT` | Host port mapped to Nginx port 80 |
| `NGINX_HTTPS_PORT` | Host port mapped to Nginx port 443 |
| `NGROK_AUTHTOKEN` | ngrok authentication token |
| `NGROK_APIKEY` | ngrok API key |
| `NGROK_URL` | Reserved ngrok subdomain URL |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Base API URL consumed by Axios (`/api/v1`) |

### Administrator & Registration

| Variable | Description |
|----------|-------------|
| `DEFAULT_ADMIN_TICKET` | Ticket number for the seeded default admin account |
| `DEFAULT_ADMIN_EMAIL` | Email for the default admin account |
| `DEFAULT_ADMIN_PASSWORD` | Initial password for the default admin account |
| `REGISTRATION_VALIDITY_DAYS` | Employee registration request validity duration (days) |

### Chat System

| Variable | Description |
|----------|-------------|
| `CHAT_MAX_HISTORY` | Maximum chat message history returned per room |
| `CHAT_ROOM_ALL` | Identifier for the all-employees chat room |
| `CHAT_ROOM_SUPERVISOR` | Identifier for the supervisors-only chat room |

---

## 12. Project Structure

```
loco-works-management-system/
├── backend/
│   ├── app/
│   │   ├── core/                       # Shared infrastructure
│   │   │   ├── config.py               # Pydantic settings from .env
│   │   │   ├── database.py             # Async DB engines, read/write routing
│   │   │   ├── security.py             # JWT creation, password hashing
│   │   │   ├── redis.py                # Redis Sentinel client
│   │   │   ├── email.py                # SMTP OTP & notification mailer
│   │   │   ├── audit.py                # Audit log ORM model
│   │   │   └── exceptions.py           # Global HTTP exception handlers
│   │   ├── features/                   # Feature-domain modules
│   │   │   ├── auth/                   # Login, registration, OTP, JWT sessions
│   │   │   ├── admin/                  # Admin portal, OTP 2FA, audit logs, master data CRUD
│   │   │   ├── employees/              # Employee listing and workforce stats
│   │   │   ├── locos/                  # Locomotive CRUD and production stats
│   │   │   ├── jobs/                   # Repair job CRUD
│   │   │   ├── bookings/               # Loco-job shift booking engine
│   │   │   ├── employee_bookings/      # Staff availability, allocation wizard, notifications
│   │   │   ├── assessments/            # Self-assessment, approval flow, competency ratings
│   │   │   ├── chat/                   # Real-time chat WebSocket + Redis Pub/Sub history
│   │   │   └── realtime/               # Workshop telemetry stream WebSocket + Redis Streams
│   │   └── main.py                     # FastAPI app, CORS, DB routing middleware, router mounts
│   ├── alembic/
│   │   └── versions/                   # All database migration scripts
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── alembic.ini
├── frontend/
│   ├── src/
│   │   ├── features/                   # Page-level React feature components
│   │   │   ├── landing/                # Public landing page
│   │   │   ├── auth/                   # Login, Register, OTP, Password reset, Session expired
│   │   │   ├── dashboard/              # Main employee dashboard
│   │   │   ├── bookings/               # Loco booking, availability, wizard, preview, carry-forward
│   │   │   │   ├── LocoBookingUI.tsx
│   │   │   │   ├── EmployeesBookingWizard.tsx
│   │   │   │   ├── EmployeeAvailability.tsx
│   │   │   │   ├── BookingPreview.tsx
│   │   │   │   ├── JobCarryForwardPage.tsx
│   │   │   │   ├── KnowledgeBaseUI.tsx
│   │   │   │   ├── StaffAssessmentUI.tsx   # Supervisor competency review panel
│   │   │   │   └── SelfAssessmentUI.tsx    # Staff self-assessment submission
│   │   │   ├── crud/                   # Master data management
│   │   │   ├── chat/                   # Chat room components
│   │   │   └── admin/                  # Admin portal login, dashboard, OTP verification
│   │   ├── shared/                     # Reusable components and utilities
│   │   │   ├── components/             # ProtectedRoute, ThemeToggle, CookieConsent, etc.
│   │   │   └── services/               # Axios API client (api.ts)
│   │   ├── App.tsx                     # Router configuration (all routes)
│   │   └── index.css                   # Global design system (CSS variables, dark mode)
│   ├── public/
│   └── package.json
├── infrastructure/
│   ├── nginx/
│   │   └── nginx.conf                  # Reverse proxy, load balancer, rate limiting, SSL config
│   └── database/
│       ├── init.sql                    # DB init, audit trigger function, trigger attachments
│       └── add_partitions.sql          # Monthly range partition setup for audit_logs
├── assets/                             # Organized deployment and reference resources
│   ├── db/                             # Seed SQL files and sample employee CSV data
│   ├── docs/                           # Production deployment guide, staging plans, audits
│   └── scripts/                        # Python seeding scripts, SSL/Certbot automation
│       ├── seed_designations.py        # Seeds employee category & designation master data
│       ├── seed_jobs.py                # Seeds repair job master data
│       └── populate_sample_data.py     # Seeds sample employee data (dev/staging only)
├── .agents/                            # AI assistant workspace (plans, scripts, audits)
│   ├── AGENTS.md                       # Workspace rules and standards for AI agents
│   ├── artifacts/                      # Markdown plans, audits, walkthrough reports
│   └── scripts/                        # AI-generated test and helper scripts
├── docker-compose.yml                  # Development orchestration (with Mailpit, ngrok, hot-reload)
├── docker-compose.prod.yml             # Production orchestration (immutable images, health checks, limits)
├── .env.example                        # Environment variable template
├── .gitignore
└── LICENSE.md
```

---

## 13. License

This project is licensed under the **MIT License**. See [LICENSE.md](LICENSE.md) for full terms.

---

*Built with ❤️ using FastAPI, React, PostgreSQL, and Redis.*
