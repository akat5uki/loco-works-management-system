# Loco Works Management System (LWMS)

**Loco Works Management System (LWMS)** is a production-grade enterprise web application designed for locomotive manufacturing workshops and maintenance sheds. It coordinates labor allocation, tracks manufacturing telemetry, logs shift-wise repair jobs, manages employee scheduling, and enables real-time communications across all active supervisors — all from a single, unified platform.

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
| **Reverse Proxy** | Nginx (`nginx:stable-alpine`) | Serves frontend static assets, load-balances API requests, rate-limits auth routes |
| **Frontend** | React 19 + TypeScript + Vite | SPA with client-side routing, Vanilla CSS theming, jsPDF export |
| **Backend** | FastAPI + SQLAlchemy + asyncpg + Uvicorn | Async API server with modular feature routing |
| **Primary Database** | PostgreSQL (Bitnami) | Write target for all mutating operations |
| **Replica Database** | PostgreSQL (Bitnami, streaming replication) | Read target with lag mitigation |
| **Cache & Pub/Sub** | Redis + Redis Sentinel (3-node HA cluster) | Session store, distributed locks, Pub/Sub chat, telemetry stream |
| **Schema Migrations** | Alembic | Production-grade out-of-band database migrations |
| **SSL/TLS** | Let's Encrypt (Certbot) | Automatic certificate issuance and renewal |

### Database Routing

A custom `ContextVar`-based middleware (`db_routing_middleware`) in [app/main.py](backend/app/main.py) automatically routes all `POST`/`PUT`/`DELETE`/`PATCH` requests to the **primary** database and `GET` requests to the **replica**. A short-lived `write_window_lag` cookie ensures read-your-own-writes consistency after a mutating operation.

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
| `vite` | ≥ 8.0 | Build toolchain |
| TypeScript | ≥ 6.0 | Type-safe JavaScript |

---

## 4. Database Schema

All schema changes are managed via Alembic migrations. The current head migration is `08d71d939c4d`.

### Entity Relationship Overview

```
  ┌──────────────────┐          ┌──────────────────┐          ┌────────────────────────┐
  │ employee_category│◄─────────│   designation    │◄─────────│       employees        │
  │ category_id (PK) │          │ designation_id   │          │ ticket_number (PK)     │
  │ category_name    │          │ designation_name │          │ name                   │
  └──────────────────┘          │ category_id (FK) │          │ designation_id (FK)    │
                                └──────────────────┘          │ email (NOT NULL)       │
                                                              │ password               │
                                                              │ nonce                  │
                                                              └───────────┬────────────┘
                                                                          │
                  ┌───────────────────────────┬──────────────────────────┼───────────────────────┐
                  ▼                           ▼                          ▼                       ▼
  ┌───────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
  │  employee_availability│  │    employee_bookings     │  │employee_notifications│  │      loco_admin      │
  │ availability_id (PK)  │  │ booking_id (PK)          │  │notification_id (PK)  │  │ ticket_number (PK/FK)│
  │ date_time             │  │ loco_number (FK)         │  │ ticket_number (FK)   │  │ password             │
  │ shift                 │  │ date_time                │  │ message              │  │ nonce                │
  │ ticket_number (FK)    │  │ shift                    │  │ is_read              │  │ is_default           │
  └───────────────────────┘  │ supervisor_ticket (FK)   │  │ created_at           │  │ must_change_password │
                             │ staff_ticket (FK, NULL)  │  └──────────────────────┘  │ employee_portal_en.. │
                             │ is_forwarded             │                            └──────────────────────┘
                             └──────────────────────────┘
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
| `POST` | `/verify-otp` | Verify email OTP and complete registration |
| `POST` | `/resend-otp` | Resend OTP verification email |
| `POST` | `/forgot-password` | Request a password reset OTP |
| `POST` | `/reset-password` | Submit the new password with OTP verification |
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
| `GET` | `/me` | Get profile of the authenticated admin |
| `POST` | `/login` | Admin login with separate credentials |
| `POST` | `/logout` | Invalidate admin session |
| `POST` | `/change-password` | Update admin password |
| `POST` | `/set-employee-password` | Reset any employee's password |
| `GET` | `/registration-requests` | List all registration request submissions |
| `POST` | `/registration-requests/{reg_code}/action` | Approve or reject a registration request |
| `POST` | `/registration-requests/{reg_code}/extend-validity` | Extend registration validity window |
| `GET` | `/admins` | List all admin accounts |
| `POST` | `/add-admin` | Promote an employee to admin |
| `DELETE` | `/admins/{ticket_number}` | Revoke admin privileges |
| `GET` | `/audit-logs` | Browse paginated database audit log entries |
| `GET/POST/PUT/DELETE` | `/master-data/categories` | Manage employee category records |
| `GET/POST/PUT/DELETE` | `/master-data/designations` | Manage designation records |
| `GET/POST/PUT/DELETE` | `/master-data/employees` | Manage employee records directly |

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

### Protected Employee Routes (Requires JWT Session)

| Route | Page | Role Required |
|-------|------|--------------|
| `/dashboard` | Main Dashboard | All Employees |
| `/bookings/loco` | Loco Booking Manager | Supervisor |
| `/bookings/availability` | Staff Availability Logger | Supervisor |
| `/bookings/employees` | Staff Booking Wizard | Supervisor |
| `/bookings/carry-forward` | Job Carry Forward | Supervisor |
| `/bookings/preview` | Shift Summary & PDF Export | All Employees |
| `/crud` | Master Data Management | Supervisor |

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

### Realtime Collaboration
- **Live Telemetry Stream**: Real-time WebSocket broadcasting of workshop events through Redis Streams (`workshop_telemetry`).
- **Chat Rooms**: Two collaborative channels — `General` (all employees) and `Supervisors` (restricted). Powered by Redis Pub/Sub with configurable message history.

### Admin Portal
- **Registration Approval Workflow**: Review and approve or reject employee self-registration requests.
- **Password Management**: Reset any employee's password from the admin console.
- **Master Data CRUD**: Directly manage categories, designations, employees, and loco data.
- **Admin Management**: Promote employees to admin and revoke admin access.
- **Audit Log Viewer**: Browse a time-partitioned, trigger-generated audit trail of all mutations to operational tables.

### Reporting
- **Shift Preview**: Full shift summary with locomotive assignments, job lists, subtasks, and booking remarks.
- **Print-to-PDF Export**: Client-side jsPDF rendering for offline distribution.
- **Employee Lists**: Segregated available/unavailable employee lists sorted by designation and ticket number.

---

## 8. Security Design

LWMS implements a layered, double-guarded security architecture:

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | HTTP-only JWT cookies with cryptographic `nonce` validation — resistant to token reuse after logout or password change |
| **Dual-Cookie Shield** | `session_id_strict` (SameSite=Strict) + `session_id_embed` (SameSite=None; Partitioned) for CHIPS compliance |
| **Password Hashing** | bcrypt via `passlib` |
| **API Rate Limiting** | Nginx `limit_req_zone` (1 req/s, burst 5) on all auth endpoints |
| **DB Write Routing** | Context-aware read/write splitting via `ContextVar` middleware |
| **Audit Trail** | PostgreSQL trigger-based immutable `audit_logs` with monthly range partitioning |
| **OTP Verification** | Email-based TOTP for new employee registration, expiring in 3 minutes |
| **Admin Isolation** | Separate credential store and session namespace for admin portal access |
| **Input Validation** | Pydantic schema validation on all request bodies (backend) + client-side field checks (frontend) |

---

## 9. Getting Started (Development)

### Prerequisites

- **Docker & Docker Compose** (v2.x)
- **Node.js** (v20+) and **npm**

### Setup

**1. Clone the repository:**
```bash
git clone https://github.com/your-org/loco-works-management-system.git
cd loco-works-management-system
```

**2. Configure environment:**
```bash
cp .env.example .env
# Edit .env and populate all required values
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
docker compose exec web-1 python assets/seed_data.sql
```

The application will be available at:
- **Frontend + API**: `http://localhost:8082`
- **Admin Portal**: `http://localhost:8082/admin/login`
- **API Docs (Swagger)**: `http://localhost:8082/api/v1/openapi.json`
- **Mailpit (SMTP sink)**: `http://localhost:8025`

---

## 10. Production Deployment

For a complete production deployment guide including server hardening, SSL certificate setup, and automated backups, refer to [assets/production_deployment_guide.md](assets/production_deployment_guide.md).

### Quick Production Deploy

```bash
# 1. Generate secure credentials and populate .env
cp .env.example .env  # and fill in all secrets

# 2. Build and start production containers (no volume mounts)
docker compose -f docker-compose.prod.yml up -d --build

# 3. Run database migrations out-of-band
docker compose -f docker-compose.prod.yml exec web-1 alembic upgrade head

# 4. Verify health status
curl http://localhost/api/v1/health
```

`docker-compose.prod.yml` runs fully **immutable** container images (no source bind-mounts), includes **health checks** for all services, enforces **CPU and memory resource limits**, and excludes development-only tools (`mailpit`, `ngrok`).

---

## 11. Environment Variables

All sensitive settings are stored in a `.env` file. Copy `.env.example` to get started.

| Variable | Description |
|----------|-------------|
| `PROJECT_NAME` | Application display name |
| `API_V1_STR` | API routing prefix (default: `/api/v1`) |
| `POSTGRES_USER` | PostgreSQL database username |
| `POSTGRES_PASSWORD` | PostgreSQL database password |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_REPLICATION_USER` | Replication stream username |
| `POSTGRES_REPLICATION_PASSWORD` | Replication stream password |
| `DATABASE_PRIMARY_URL` | SQLAlchemy async URL for write database |
| `DATABASE_REPLICA_URL` | SQLAlchemy async URL for read replica |
| `REDIS_SENTINELS` | Comma-separated Sentinel host:port list |
| `REDIS_MASTER_SET` | Redis Sentinel master set name |
| `REDIS_PASSWORD` | Redis authentication password |
| `SECRET_KEY` | JWT signing key (generate with `openssl rand -hex 32`) |
| `ALGORITHM` | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiry window |
| `SESSION_EXPIRE_SECONDS` | Sliding session duration in seconds |
| `COOKIE_SECURE_STRICT` | Enable `Secure` flag on strict cookies (`True` for HTTPS) |
| `COOKIE_SECURE_EMBED` | Enable `Secure` flag on embedded cookies (required for CHIPS) |
| `ENABLE_EMAIL_OTP` | Toggle OTP email verification (1 = on, 0 = off) |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (587 for TLS, 465 for SSL) |
| `SMTP_USERNAME` | SMTP account username |
| `SMTP_PASSWORD` | SMTP account password or app token |
| `SMTP_FROM_EMAIL` | Sender address for outbound emails |
| `NGINX_HTTP_PORT` | Host port mapped to Nginx port 80 |
| `NGINX_HTTPS_PORT` | Host port mapped to Nginx port 443 |
| `DEFAULT_ADMIN_TICKET` | Ticket number for the default seeded admin account |
| `DEFAULT_ADMIN_EMAIL` | Email for the default admin account |
| `DEFAULT_ADMIN_PASSWORD` | Initial password for the default admin account |
| `LOCO_STAGES` | Comma-separated list of valid manufacturing stage numbers |
| `CHAT_MAX_HISTORY` | Maximum chat message history returned per room |

---

## 12. Project Structure

```
loco-works-management-system/
├── backend/
│   ├── app/
│   │   ├── core/                 # Shared infrastructure
│   │   │   ├── config.py         # Pydantic settings from .env
│   │   │   ├── database.py       # Async DB engines, read/write routing
│   │   │   ├── security.py       # JWT creation, password hashing
│   │   │   ├── redis.py          # Redis Sentinel client
│   │   │   ├── email.py          # SMTP OTP & notification mailer
│   │   │   ├── audit.py          # Audit log ORM model
│   │   │   └── exceptions.py     # Global HTTP exception handlers
│   │   ├── features/             # Feature-domain modules
│   │   │   ├── auth/             # Login, registration, OTP, JWT sessions
│   │   │   ├── admin/            # Admin portal, audit logs, master data CRUD
│   │   │   ├── employees/        # Employee listing and stats
│   │   │   ├── locos/            # Locomotive CRUD and production stats
│   │   │   ├── jobs/             # Repair job CRUD
│   │   │   ├── bookings/         # Loco-job shift booking engine
│   │   │   ├── employee_bookings/ # Staff availability and allocation wizard
│   │   │   ├── chat/             # Real-time chat WebSocket + history
│   │   │   └── realtime/         # Workshop telemetry stream WebSocket
│   │   └── main.py               # FastAPI app, middleware, router mounting
│   ├── alembic/
│   │   └── versions/             # All database migration scripts
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── alembic.ini
├── frontend/
│   ├── src/
│   │   ├── features/             # Page-level React components
│   │   │   ├── landing/          # Public landing page
│   │   │   ├── auth/             # Login, Register, OTP, Password reset
│   │   │   ├── dashboard/        # Main employee dashboard
│   │   │   ├── bookings/         # Loco booking, availability, wizard, preview
│   │   │   ├── crud/             # Master data management
│   │   │   ├── chat/             # Chat room components
│   │   │   └── admin/            # Admin portal login and dashboard
│   │   ├── shared/               # Reusable components and utilities
│   │   ├── App.tsx               # Router configuration
│   │   └── index.css             # Global design system (CSS variables)
│   └── package.json
├── infrastructure/
│   ├── nginx/
│   │   └── nginx.conf            # Reverse proxy, rate limiting, SSL config
│   └── database/
│       ├── init.sql              # DB init, audit trigger function
│       └── add_partitions.sql    # Partition setup for audit_logs
├── assets/                       # Deployment guides and helper scripts
├── docker-compose.yml            # Development orchestration
├── docker-compose.prod.yml       # Production orchestration (immutable, health checks)
├── .env.example                  # Environment variable template
└── LICENSE.md
```

---

## 13. License

This project is licensed under the **MIT License**. See [LICENSE.md](LICENSE.md) for full terms.

---

*Built with ❤️ using FastAPI, React, PostgreSQL, and Redis.*
