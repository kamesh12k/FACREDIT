# Credits

A production-ready web application for managing teacher leave requests, substitute assignments, and credit-based workload balancing — with full classroom, subject, room, Day Order, and Academic Calendar / Holiday management.

**Version:** 3.0.0 (Academic Calendar & Holiday Management)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Quick Start (Development)](#quick-start-development)
6. [Production Deployment](#production-deployment)
7. [Admin Guide](#admin-guide)
8. [Academic Calendar & Day Order](#academic-calendar--day-order)
9. [Factory Reset](#factory-reset)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)
12. [Credits](#credits)

---

## Project Overview

The Credits is a comprehensive web-based solution for educational institutions to manage teacher workload distribution through a credit-based leave and substitute assignment system, built around a rotating **Day Order (1–6)** schedule of **five periods per day** rather than the literal weekday. The system enforces role-based access control (Super Admin / Secondary Admin / Teacher), maintains an immutable audit trail, provides a full **Academic Calendar** (Academic Years, Semesters, Holidays, Exam Days, Special Events, Department Activity Days) that automatically excludes non-working days from every downstream calculation, and includes a factory reset capability for emergency recovery.

**Key use cases:**
- Super Admin defines Academic Years, Semesters, and marks holidays/exam days/special events on the calendar
- Day Order rotation pauses on non-working days and resumes automatically on the next working day
- Teachers apply for leave (single period, multiple periods, or whole day) with automatic conflict and holiday-exclusion checks
- Admins assign substitute teachers and track credit transactions, all Day-Order-aware
- Faculty workload and credit reports automatically exclude holidays and non-working days
- Multi-level admin system with forced first-login credential change

---

## Features

### Academic Calendar & Holiday Management (new in v3)

- **Academic Years & Semesters** — Super Admin creates date-bound Academic Years and Semesters within them, scoping the calendar.
- **Calendar Day Types** — every date can be marked: Working Day, Holiday, College Leave Day, Government Holiday, Examination Day, Special Event Day, Department Activity Day, or generic Non-Working Day.
- **Day Order Sequencing (1–6)**
  - Assign a Day Order to a working date, or let it auto-continue from the previous working day
  - Reassign / override a specific date's Day Order
  - Skip ahead in the rotation deliberately (e.g. 3 → skip 4 → 5)
  - Rotation **pauses** on any non-working day and **resumes** automatically on the next working day — e.g. 24 Aug → Day Order 3, 25 Aug → Holiday, 26 Aug → Day Order 4
- **Bulk-mark a date range** — mark a whole week as Government Holiday (etc.) in one action
- **Holiday exclusion is enforced everywhere automatically:**
  - No timetable slot can be generated for a non-working date
  - No leave request can be submitted for a non-working date (rejected at the API with a clear reason)
  - No substitute assignment or credit transaction is ever created for a non-working date
  - Faculty workload reports count only actual working-day occurrences of each Day Order
- **Calendar Dashboard views** — Monthly Calendar View (click any date to mark/edit it), Day Order View, Holiday View, Academic Year/Semester management — all in one screen (`Admin → Calendar & Day Order`)
- **Reports** (`Admin → Calendar Reports`): Working Day Report, Holiday Report, Day Order Report (occurrences per Day Order in a range), Faculty Workload Report (excluding holidays)
- **Validations enforced at both the API and database layer:**
  - A date can only have one calendar entry (UNIQUE constraint)
  - A non-working day can never carry a Day Order (CHECK constraint + application logic)
  - Leave/timetable/substitute/credit operations on a non-working date are rejected with a specific error, not silently dropped

### Admin Panel

- **Role-Based Access Control** — Super Admin (full control, factory reset, manages Secondary Admins) / Secondary Admin (up to 3 active) / Teacher, with forced credential change on bootstrap/reset
- **Teacher Management** — create accounts, view credit balances, disable without deleting
- **Subject Management** — code, name, type (theory/lab), credits, department, semester; archive/unarchive
- **Class Management** — class + section combinations, department + semester assignment
- **Room & Lab Management** — classroom/lab types, capacity, department affiliation, live availability checks
- **Timetable Management** — assign subject + class + room to a teacher for a Day Order + period (1–5); three independent UNIQUE constraints prevent double-booking (teacher / class / room); bulk upload with atomic, all-or-nothing validation
- **Leave Request Management** — bulk review (select multiple, approve/reject in one action), auto-detect free teachers (Day-Order-based), batch submission (multiple periods or whole day in one form)
- **Credit System & Reports** — real-time balance tracker, immutable transaction ledger, leaderboard, automatic ±1 credit on substitute assignment
- **Audit Logs** — admin-management actions and calendar mutations; cleared by factory reset by design
- **Settings / Factory Reset** (Super Admin only) — timestamped backup, wipes all faculty data + the entire Academic Calendar, resets Super Admin to bootstrap defaults

### Teacher Portal

- **Dashboard** — credit balance, pending/approved leave counts, recent requests
- **My Timetable** — grouped by Day Order, shows subject/class/room per period
- **Apply for Leave** — live calendar check as you pick a date (shows Day Order or holiday badge immediately, blocks submission on non-working dates); single period, multiple periods, or whole day
- **Leave History** — all past requests with Day Order, period, and status
- **My Credits** — balance + full transaction history

### System Features

- Conflict validation at both API (409 with specific message) and DB (UNIQUE constraints + trigger) layers
- Resource Availability Dashboard (Day-Order + period filtered)
- In-app notifications (leave approved/rejected, substitute assigned)
- Optional browser push notifications (VAPID)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, React Router v6, Axios |
| **Backend** | FastAPI, Python 3.11+, SQLAlchemy 2.0 |
| **Database** | PostgreSQL 14+ |
| **Authentication** | JWT (python-jose), bcrypt (direct, no passlib) |
| **Validation** | Pydantic v2, email-validator |
| **Web Server** | Uvicorn (dev), Gunicorn + Uvicorn workers (prod) |

---

## Architecture

### Database Layer

```
users (admin/teacher with RBAC + forced credential change)
├── departments
│   ├── subjects
│   ├── classes
│   └── rooms
├── academic_years
│   └── semesters
├── calendar_days (date → day_type + Day Order 1-6; the single source of
│   truth for "is this date usable" — every other table below checks here)
├── timetable_slots (subject + class + room + teacher + Day Order + period 1-5)
│   └── [conflict checks: teacher, class, room all unique per Day Order/period]
├── leave_requests (teacher + date + day_order + period + reason + status)
│   ├── alter_assignments (leave → substitute + auto-credit transfer)
│   └── credit_transactions (immutable ledger: ±1 per assignment)
│       └── teacher_credits (cached running balance)
├── notifications + push_subscriptions
└── audit_logs (admin + calendar actions, cleared by factory reset)
```

### API Structure

```
/auth        POST /login, /register
/admin       first-login setup, secondary admins, audit logs, factory-reset
/academic-calendar
             /academic-years, /semesters
             /days, /days/mark, /days/bulk-mark
             /days/day-order/assign, /days/day-order/skip
             /days/{date}/override (DELETE), /days/{date} (DELETE)
             /resolve
             /reports/working-days, /reports/holidays,
             /reports/day-orders, /reports/faculty-workload
/day-order-calendar   legacy-path-compatible wrapper over the same engine
/teachers, /subjects, /classes, /rooms
/timetable   /slot, bulk upload, by-teacher, by-class
/leaves      single + /batch, bulk-approve/reject, assign, free-teachers
/credits, /notifications, /health
```

### Frontend Routes

```
/login, /register, /first-login-setup

/admin/dashboard
/admin/academic-calendar, /admin/academic-calendar/reports
/admin/teachers, /admin/subjects, /admin/classes, /admin/rooms
/admin/timetable, /admin/resource-availability
/admin/leaves, /admin/credits
/admin/settings

/teacher/dashboard, /teacher/timetable
/teacher/leave/apply, /teacher/leaves, /teacher/credits
```

---

## Quick Start (Development)

### Prerequisites
Python 3.11+, Node.js 18+, PostgreSQL 14+, Git.

### Step 1: Database

```bash
createdb credits_db
psql -d credits_db -f database/schema.sql
psql -d credits_db -f database/seed.sql   # optional sample data
```

### Step 2: Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set DATABASE_URL and generate SECRET_KEY:
#   python3 -c "import secrets; print(secrets.token_hex(32))"
python3 preflight_check.py
uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

### Step 3: Frontend

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:5173` proxies `/api/*` to the backend.

### Step 4: First Login

1. Open `http://localhost:5173`
2. Log in: `admin` / `admin`
3. Set new credentials (forced)
4. Go to **Calendar & Day Order** and mark at least one working day with a Day Order — leave requests and timetable scheduling are rejected until the calendar has working days

---

## Production Deployment

See `DEPLOYMENT.md` for full instructions (Gunicorn + Nginx + systemd, SSL, database backups, environment checklist).

---

## Admin Guide

1. **Log in with bootstrap credentials** (`admin` / `admin`) and set new ones immediately (forced).
2. **Create Secondary Admins** if needed (max 3 active) via Settings.
3. **Configure institution data:** Departments → Subjects → Classes → Rooms.
4. **Set up the Academic Calendar** (see next section) — create an Academic Year and Semester, then mark working days with Day Orders and any known holidays/exam days.
5. **Build the timetable** — assign teacher + subject + class + room to each Day Order + period (1–5); conflicts are rejected with a specific reason.
6. **Operate:** review leave requests, assign substitutes, monitor credit balances, run calendar/workload reports.

---

## Academic Calendar & Day Order

### How the rotation works

Day Order is derived from the nearest **prior working day's** Day Order + 1 (wrapping 6 → 1). Marking a date as Holiday/Exam/etc. simply removes its Day Order; the next date you mark as `working` auto-continues the sequence from wherever it left off. Example:

```
24 Aug 2026  →  Day Order 3   (working)
25 Aug 2026  →  Holiday        (no Day Order)
26 Aug 2026  →  Day Order 4   (working — auto-continued)
```

### Manual control

- **Reassign** — pin an explicit Day Order for a date (overrides auto-sequencing); everything after it re-sequences from that value.
- **Skip** — deliberately jump the rotation (e.g. 3 → skip 4 → 5), useful when a Day Order should be omitted entirely for a cycle.
- **Clear override** — release a manual override so the date rejoins the auto-sequence based on its predecessor.
- **Bulk-mark** — mark a whole contiguous range (e.g. a week) as the same non-working type in one action.

### What gets blocked on a non-working day

Per spec, marking a date as anything other than `working` means: no timetable slot can target it, no leave request can be submitted for it (the API returns a 400 with the specific reason), no substitute assignment or credit transaction is ever created for it, and faculty workload reports skip it entirely. This is enforced in `day_order_service.assert_working_day_or_400`, called by every leave/timetable code path before it does anything date-related — there is exactly one place this rule lives.

---

## Factory Reset

Restores the system to its original deployment state — **irreversible beyond the automatic backup.**

**What it wipes:** all faculty/admin accounts (except the calling Super Admin, who is reset to bootstrap defaults), subjects/classes/rooms, the **entire Academic Calendar** (Academic Years, Semesters, Calendar Days — every holiday and Day Order assignment), all timetables, leave requests, substitute assignments, credit history, notifications, and audit logs.

**Access:** Admin Panel → Settings → Factory Reset (requires current password + typing `RESET EVERYTHING`), or the CLI recovery script `python3 scripts/factory_reset.py` if locked out entirely.

A timestamped JSON backup is written to `backend/backups/` automatically before anything is deleted; restoring from it is a manual DBA operation, not an in-app undo.

---

## Security

- JWT tokens (configurable expiry), bcrypt password hashing (12 rounds, direct bcrypt API)
- RBAC enforced at the dependency layer (`require_admin`, `require_super_admin`, `require_credentials_set`)
- First-login gate: accounts with `must_change_credentials=True` are blocked from every route except the setup endpoint
- Three-way UNIQUE constraints prevent timetable double-booking at the database layer regardless of application bugs
- `chk_calendar_day_order` CHECK constraint makes it structurally impossible for a non-working day to carry a Day Order
- Audit trail for admin actions and calendar mutations (cleared by factory reset, by design)

### Production checklist
- [ ] Unique `SECRET_KEY` (32+ chars)
- [ ] CORS `allow_origins` set to the real frontend domain
- [ ] Don't run `seed.sql` against production
- [ ] HTTPS on both frontend and backend
- [ ] Automated database backups
- [ ] At least one Academic Year + working Day Order populated before go-live

---

## Troubleshooting

**`pip install` fails on Python 3.13/3.14 (build errors mentioning a C/Rust compiler, or "newer than PyO3's maximum supported version")** — `requirements.txt` uses minimum-version pins (`>=`) rather than exact pins specifically so this doesn't happen, but if you're working from an older clone: `pip install --upgrade -r requirements.txt` to re-resolve against current releases, or `pip install -U pip` first if pip itself is old enough to be choosing stale wheels. The usual cause is an exact pin (`==`) on `psycopg2-binary`, `bcrypt`, or `pydantic` from before that package shipped wheels for your Python version, forcing pip to compile from source and fail without build tools.

**"X has no academic calendar entry" on leave/timetable submission** — the date hasn't been marked in the Academic Calendar yet. Go to Admin → Calendar & Day Order and mark it as a working day with a Day Order (or as a holiday/exam day, if that's accurate) before scheduling anything on it.

**"X is marked as holiday — no classes... can be scheduled"** — working as intended; pick a different date or, if the calendar entry is wrong, fix it from the same screen.

**Day Order sequence looks wrong after inserting a holiday** — the engine re-sequences every *non-overridden* working day after the date you just changed. If a later date was manually overridden, it keeps its pinned value and the rotation continues from there — check for an "override" badge on the calendar.

**Pre-flight check fails on "calendar_days is missing columns"** — run `database/migrations/003_academic_calendar.sql`.

**Other issues** — see `database/README.md` and `DEPLOYMENT.md` for schema/deployment-specific troubleshooting.

---

## Credits

**Developer:** Kamesh G
**Institution:** Muthayammal College of Arts and Science (Autonomous) — B.Sc. Computer Science, II Year, Section B
**Academic Guidance:** Mr. Krishnamoorthi, Assistant Professor

---

## License

Provided as-is for educational and institutional use.
