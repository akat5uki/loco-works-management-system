# Loco Works Management System (LWMS)

Loco Works Management System (LWMS) is a state-of-the-art enterprise web application designed for locomotive manufacturing workshops and maintenance sheds. It coordinates labor allocation, logs shift-wise jobs, tracks manufacturing telemetry, and simplifies complex scheduling assignments in real time.

---

## 1. Intent & Purpose

Locomotive assembly and repair workshops are highly complex environments that require strict organization. Hundreds of technicians (Staff) and team leads (Supervisors) coordinate over multiple shifts to perform precision repairs and installations. 

LWMS was built to:
* **Enforce Data and Labor Integrity**: Ensure that technicians are only assigned to jobs matching their specific designation and are not double-booked across different locomotives on the same shift.
* **Enable Real-Time Telemetry and Event Broadcasting**: Monitor locomotive repair stages and push instant notifications and updates across all active supervisors via WebSocket connections.
* **Coordinate Safe Concurrent Editing**: Use distributed lock windows so that multiple supervisors do not conflict when assigning staff to the same shift.
* **Simplify Reporting**: Provide clean print previews and shift summary reports for managers and administrative leads.

---

## 2. System Design Architecture

LWMS utilizes a modern, resilient microservices architecture orchestrated via Docker Compose:

```
                  ┌────────────────────────────────────────┐
                  │                 Nginx                  │
                  │             (Load Balancer)            │
                  └─────────┬────────────────────┬─────────┘
                            │                    │
             ┌──────────────▼──────┐      ┌──────▼─────────────┐
             │    React Frontend   │      │   FastAPI Web App  │
             │   (Static Assets)   │      │ (App Servers 1-3)  │
             └─────────────────────┘      └──────┬──────────┬──┘
                                                 │          │
                     ┌───────────────────────────┘          │
                     │ (SQL Queries)                        │ (Redis Commands)
                     ▼                                      ▼
        ┌────────────────────────┐              ┌────────────────────────┐
        │  PostgreSQL Database   │              │   Redis Cache & Pub    │
        │    (Master/Replica)    │              │   (Sentinel Cluster)   │
        └────────────────────────┘              └────────────────────────┘
```

### Components
1. **Nginx Load Balancer**: Serves as the reverse proxy. It serves the statically compiled React production build and load-balances API requests across three instances of the FastAPI backend.
2. **React Frontend (Vite + TypeScript)**: Built using clean, responsive Vanilla CSS with dynamic CSS variables for custom light/dark theme toggling. Replaces bulky frameworks with clean, custom-crafted micro-animations and layouts.
3. **FastAPI Backend (FastAPI + SQLAlchemy + asyncpg)**: An asynchronous Python API designed for high-performance requests, structured with modular feature domains.
4. **PostgreSQL Primary/Replica**: Operational data is stored in a master-replica database cluster. Mutating write requests are automatically routed to the Primary instance, while reads are load-balanced to the Replica instance, utilizing a custom lag-mitigation cookie to enforce read-your-own-writes consistency.
5. **Redis Sentinel Cluster**: High-availability Redis nodes (1 master, 2 replicas, monitored by 3 Sentinel services) provide:
   * **Locking**: Session window locks preventing concurrent shift editing.
   * **Telemetry**: Redis Stream (`workshop_telemetry`) for broadcasting real-time events.
   * **Messaging**: Redis Pub/Sub (`chat:*`) channels for supervisor and general chat rooms.

---

## 3. Database Schema

Operational tables are defined in PostgreSQL. The relationships are structured as follows:

### Schema Diagram (Entity-Relationship)

```
  ┌──────────────────┐          ┌───────────────┐          ┌──────────────┐
  │employee_category │◄─────────┤  designation  │◄─────────┤  employees   │
  │                  │          │               │          │              │
  │ category_id (PK) │          │desig_id (PK)  │          │ticket_no (PK)│
  │ category_name    │          │desig_name     │          │name          │
  └──────────────────┘          │category_id(FK)│          │password      │
                                └───────────────┘          │nonce         │
                                                           └──────┬───────┘
                                                                  │
                                      ┌───────────────────────────┼───────────────────────────┐
                                      ▼                           ▼                           ▼
                           ┌─────────────────────┐    ┌───────────────────────┐    ┌─────────────────────┐
                           │employee_availability│    │   employee_bookings   │    │employee_notification│
                           │                     │    │                       │    │                     │
                           │ availability_id (PK)│    │ booking_id (PK)       │    │ notification_id (PK)│
                           │ date_time           │    │ date_time             │    │ ticket_number (FK)  │
                           │ shift               │    │ shift                 │    │ message             │
                           │ ticket_number (FK)  │    │ loco_number (FK)      │    │ is_read             │
                           └─────────────────────┘    │ supervisor_ticket (FK)│    │ created_at          │
                                                      │ staff_ticket (FK, opt)│    └─────────────────────┘
                                                      │ is_forwarded          │
                                                      └───────────────────────┘
```

### Table Definitions

#### `employee_category`
Stores the high-level role classifications.
* `category_id` (PK, Integer, Serial)
* `category_name` (String, Unique, Not Null) - e.g., `"Supervisor"`, `"Staff"`

#### `designation`
Stores specific professional titles and links them to categories.
* `designation_id` (PK, Integer, Serial)
* `designation_name` (String, Not Null) - e.g., `"JE"`, `"SSE"`, `"Tech-I"`, `"Helper"`
* `category_id` (FK to `employee_category.category_id`, Integer, Not Null)

#### `employees`
Stores user authentication details and associations.
* `ticket_number` (PK, Integer) - Unique employee identifier.
* `name` (String, Not Null)
* `designation_id` (FK to `designation.designation_id`, Integer, Not Null)
* `password` (String, Not Null) - Bcrypt hashed password.
* `nonce` (String, Not Null) - Secure cryptographic salt.

#### `loco_type`
Locomotive models.
* `loco_type_id` (PK, Integer) - e.g., `1`, `2`, `3`
* `loco_type_name` (String, Unique, Not Null) - e.g., `"WAG-9"`, `"EF12K"`, `"WAP-5"`

#### `loco`
Locomotives registered in the shed.
* `loco_number` (PK, Integer)
* `loco_type_id` (FK to `loco_type.loco_type_id`, Integer, Not Null)
* `stage` (Integer, Not Null) - Manufacturing stage integer (e.g. `1` to `5`).
* `despatched` (Boolean, Default `False`) - Tracks whether the locomotive has left the shed.

#### `jobs`
Repair/assembly jobs associated with manufacturing stages.
* `job_id` (PK, Integer) - e.g., `501`, `502`
* `job_description` (String, Not Null)
* `stage` (Integer, Not Null) - Target stage this job addresses.

#### `tasks`
Reference list of individual subtasks.
* `task_id` (PK, BigInteger)
* `task_description` (Text, Not Null)

#### `loco_bookings`
Represents the mapping of jobs to locomotives, assigned by supervisor for a specific date & shift.
* Composite PK: `(loco_number, date_time, job_id)`
* `loco_number` (FK to `loco.loco_number`, CASCADE delete)
* `date_time` (DateTime with timezone, Not Null)
* `job_id` (FK to `jobs.job_id`, Not Null)
* `ticket_number` (FK to `employees.ticket_number`, Not Null) - Supervisor who booked the loco.
* `designation_id` (FK to `designation.designation_id`, Not Null)
* `shift` (Integer, Not Null)

#### `booking_tasks`
Detailed subtasks logged under a locomotive booking.
* `task_id` (PK, BigInteger, Autoincrement)
* Composite FK: `(loco_number, date_time, job_id)` referencing `loco_bookings` (CASCADE delete)
* `task_description` (Text, Not Null)

#### `employee_availability`
Logs employees marked as present for a specific date & shift.
* `availability_id` (PK, Integer, Autoincrement)
* `date_time` (DateTime with timezone, Not Null)
* `shift` (Integer, Not Null)
* `ticket_number` (FK to `employees.ticket_number`, CASCADE delete)
* Unique Constraint: `(date_time, shift, ticket_number)`

#### `employee_bookings`
Allocates staff to locomotives and supervisors for a shift.
* `booking_id` (PK, Integer, Autoincrement)
* `loco_number` (FK to `loco.loco_number`, CASCADE delete)
* `date_time` (DateTime with timezone, Not Null)
* `shift` (Integer, Not Null)
* `supervisor_ticket_number` (FK to `employees.ticket_number`, CASCADE delete) - Assigning supervisor.
* `staff_ticket_number` (FK to `employees.ticket_number`, CASCADE delete, Nullable) - Assigned technician (Null represents supervisor allocated but staff not yet assigned).
* `is_forwarded` (Boolean, Default `False`) - Tracks whether bookings are submitted to administration.

#### `employee_notifications`
System logs/chat alerts.
* `notification_id` (PK, Integer, Autoincrement)
* `ticket_number` (FK to `employees.ticket_number`, CASCADE delete)
* `message` (String(500), Not Null)
* `is_read` (Boolean, Default `False`)
* `created_at` (DateTime with timezone, Default `utcnow`)

#### `loco_booking_remarks`
Shift-end progress remarks submitted by supervisors for specific locomotive jobs.
* `remarks_id` (PK, Integer, Autoincrement)
* `loco_number` (FK to `loco.loco_number`, CASCADE delete)
* `date_time` (DateTime with timezone, Not Null)
* `shift` (Integer, Not Null)
* `supervisor_ticket_number` (FK to `employees.ticket_number`, CASCADE delete)
* `job_id` (FK to `jobs.job_id`, CASCADE delete)
* `task_id` (BigInteger, Nullable)
* `remarks` (Text, Not Null)
* `completed` (Boolean, Default `False`)

#### `employee_job_ratings`
Skill competency matrix mapping employees to their job effectiveness ratings.
* Composite PK: `(ticket_number, job_id)`
* `ticket_number` (FK to `employees.ticket_number`)
* `job_id` (FK to `jobs.job_id`)
* `rating` (Integer, Not Null)

---

## 4. Key Features & Walkthrough

* **Interactive Landing Page**: Displays live aggregate locomotive numbers, category breakdown charts, and current personnel statistics.
* **Supervisor Dashboard**: Centered hub for all scheduling and auditing.
  * **Master Data Management**: High-level panel to register new locomotive models, add locomotives to active status, and modify repair jobs.
  * **Loco Booking**: Assign jobs to active locomotives, select target tasks, and establish which supervisor will coordinate the repair.
  * **Staff Availability**: Log which technicians are present on site for the upcoming day/night shift.
  * **Staff Booking Wizard**:
    * **Step 1 (Supervisor Booking)**: Claim ownership of locomotives for the shift.
    * **Step 2 (Staff Allocation)**: Allocate technicians to locomotives. Features automated skill validation (ranking ratings) and instant double-booking check alerts.
  * **My Booking (Current Assignments)**: Dedicated tab where the logged-in user can check their personal schedule and supervisor-to-staff allocations.
  * **Real-time Chat**: Collaborative messaging tool dividing communication between General (`chat:all`) and Supervisor-only (`chat:supervisor`) channels.

---

## 5. Web App Sitemap

### Public Routes
* `/` - **Landing Page**: Dashboard summary and visitor metrics.
* `/login` - **Sign In**: Login screen requiring employee ticket ID and password.
* `/register` - **Sign Up**: Account registration with designation selection.

### Protected Routes (Requires JWT Session)
* `/dashboard` - **Dashboard**: Portal containing access tiles tailored by user role.
* `/bookings/loco` - **Loco Booking**: Allocate repairs and job lists to active locomotives.
* `/bookings/availability` - **Availability Manager**: Check off personnel present on site.
* `/bookings/employees` - **Booking Wizard**: Supervisor claiming and technician assignment.
* `/bookings/preview` - **Preview & Export**: Shift summary reporting and print-to-PDF formatting.
* `/crud` - **Master Data Management**: Database CRUD controls for engines, types, and stages.
* `/session-expired` - **Expired Route**: Locks out screen upon token expiry.

---

## 6. Development Tools & Agentic Frameworks

LWMS was built utilizing pair programming workflows under **Google Antigravity**:
* **Antigravity CLI & Agents**: Facilitated codebase research, automated database verification, and live testing.
* **Specialized Subagents**: Spawning isolated `Research` and `Self` agents to handle massive file audits, compile checks, and code refactor operations.
* **Pillow Image Draw**: Utilized to compile a customized `.ico` favicon dynamically.
* **Vite + SWC**: Standard toolchain for React compilation.

---

## 7. Recent Enhancements & UX Optimizations

To improve performance, accessibility, and visual presentation on both desktop and mobile viewports, the following front-end updates were implemented:

### Shift Summary & Preview Page Refinements
* **Employee Segregation & Sorting**: Available and Unavailable employee lists are now segregated clearly by Designation and Category, and sorted numerically by ticket number, allowing managers to quickly audit personnel resource allocations.
* **Job Remarks Tree Nesting**: Job remarks have been moved from an inline style on the parent job row to a nested child leaf node (aligned with sub-tasks) inside the locomotive assignment tree. It features an amber-themed `Remarks` badge and `MessageSquare` icon.
* **Chevron Interactive Hooks**: The expand/collapse tree chevrons automatically activate and become interactive if a job possesses either sub-tasks OR remarks.

### Performance & Responsiveness Enhancements
* **Memoization & Lag Mitigation**: Key preview components—including `AvailabilitySummary`, `PreviewFilterBar`, and `LocoSummaryCard`—have been wrapped with `React.memo` to mitigate cascading render cycles. High-frequency state arrays and event handlers were stabilized via memoization to eliminate frame lag during tree node toggles.
* **Mobile Stacking Layouts**: The final locomotive assignment list automatically adapts to screen widths under `768px`. Element tags, job descriptions, and status badges stack vertically to prevent horizontal overflow and text clipping on smartphones.
* **Smooth Transitions & Clean Spacing**: 
  * Instant toggles are replaced with smooth cubic-bezier transitions for `max-height`, `opacity`, and `padding`.
  * Micro-animations for chevron icons are driven by hardware-accelerated CSS `transform` rotations.
  * Empty whitespace and padding lines below collapsed locomotive cards have been eliminated by dynamically adjusting the list flex-gaps and removing redundant inline bottom margins.

