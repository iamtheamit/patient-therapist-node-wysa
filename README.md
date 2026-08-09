# TherapySync — Backend

REST API for a telehealth appointment platform. Handles therapist scheduling, patient slot booking with hold/pay flow, recurring series management, and secure JWT authentication with refresh token rotation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript 5.5 |
| Framework | Express 4 |
| ORM | Prisma 5 + PostgreSQL |
| Auth | JWT (HS256) + bcrypt + httpOnly cookies |
| Validation | Zod |
| Logging | Winston |
| API Docs | Swagger UI at `/docs` |
| Dev server | ts-node-dev |

---

## Project Structure

```
src/
├── app.ts                          # Express app factory
├── server.ts                       # Entry point + auto-migrate
├── config/
│   ├── index.ts                    # Zod-validated environment config
│   └── swagger.ts                  # OpenAPI/Swagger setup
└── internal/
    ├── api/v1/
    │   ├── controllers/            # Request parsing → service call → response
    │   └── routes/                 # Express routers
    ├── bootstrap/
    │   ├── middlewarePipeline.ts   # CORS, JSON parser, request logger
    │   └── routes.ts               # Mounts /api/v1
    ├── infrastructure/database/
    │   └── prismaClient.ts         # PrismaClient singleton
    ├── middleware/
    │   ├── authMiddleware.ts       # JWT verification + role guard
    │   ├── idempotencyMiddleware.ts
    │   ├── errorHandler.ts
    │   └── requestLogger.ts
    ├── repositories/               # Prisma query layer (no business logic)
    ├── services/                   # All business logic lives here
    ├── shared/
    │   ├── constants/              # HTTP status codes, messages, domain constants
    │   ├── errors/                 # AppError class hierarchy
    │   ├── helpers/                # Date helpers, advisory lock key gen, pagination
    │   ├── logger/                 # Winston logger instance
    │   └── responses/              # sendSuccess / sendError envelope helpers
    └── validators/                 # Zod request body schemas
```

---

## Database Schema

### Enums

| Enum | Values |
|---|---|
| `Role` | `PATIENT`, `THERAPIST` |
| `AppointmentStatus` | `HOLD`, `HOLD_EXPIRED`, `PAYMENT_FAILED`, `SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `PaymentStatus` | `PENDING`, `SUCCESS`, `FAILED`, `NOT_REQUIRED` |
| `BookingType` | `ONE_TIME`, `RECURRING` |
| `RecurrenceFrequency` | `NONE`, `DAILY`, `WEEKLY`, `BI_WEEKLY`, `MONTHLY` |
| `AppointmentCategory` | `FOLLOW_UP`, `CONSULTATION_CBT`, `INITIAL_INTAKE`, `GENERAL_COUNSELING` |

### Models

**`User`** — Patients and therapists share the same table, distinguished by `role`.

**`TherapistSchedule`** — One row per day-of-week per therapist. Defines `startTime`, `endTime`, `slotDuration` (minutes), `bufferDuration` (minutes, default 10), optional break window, and an optional effective date range. Multiple schedule configs can exist; the one covering the requested date is used.

**`Appointment`** — Core booking record. Recurring series share the same `seriesId` UUID. Indexed on `(therapistId, startTime, endTime)` for fast conflict lookups.

**`RefreshSession`** — Tracks issued refresh tokens. Stores only the SHA-256 hash (never the raw token). Supports rotation with `replacedBySessionId` linkage.

**`IdempotencyKey`** — Stores the full HTTP response (status + body) for idempotent POST operations, keyed by the client-supplied `Idempotency-Key` header.

---

## API Reference

Base path: `/api/v1`

### Auth — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new patient. Returns `accessToken` in body, sets `refresh_token` httpOnly cookie |
| `POST` | `/auth/login` | Public | Login. Returns `accessToken` in body, sets `refresh_token` httpOnly cookie |
| `POST` | `/auth/refresh` | Cookie | Rotate refresh token. Reads cookie, atomically revokes old session, issues new access + refresh token pair |
| `POST` | `/auth/logout` | Cookie | Revoke refresh session and clear cookie |
| `GET` | `/auth/me` | JWT | Return authenticated user's profile |

### Appointments — `/api/v1/appointments`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/appointments/availability` | Public | Available slots for a therapist in a date range (paginated) |
| `POST` | `/appointments/hold` | PATIENT | Hold one or more slots. Single booking holds one slot; recurring holds the entire series atomically. Requires `Idempotency-Key` header |
| `POST` | `/appointments/holds/:holdId/release` | PATIENT | Explicitly release a hold before it expires |
| `POST` | `/appointments/:id/pay` | PATIENT | Confirm payment for a single held appointment → `SCHEDULED`. Requires `Idempotency-Key` header |
| `POST` | `/appointments/series/:seriesId/pay` | PATIENT | Atomically confirm payment for all appointments in a recurring series → all `SCHEDULED`. Requires `Idempotency-Key` header |
| `GET` | `/appointments/patient` | PATIENT | Patient's appointments (paginated, filterable by status/date/search) |
| `GET` | `/appointments/therapist` | THERAPIST | Therapist's appointments (paginated, filterable) |
| `PATCH` | `/appointments/:id/status` | THERAPIST | Update appointment status (e.g., `COMPLETED`, `NO_SHOW`) |
| `POST` | `/appointments/:id/cancel` | PATIENT or THERAPIST | Cancel a single appointment |
| `POST` | `/appointments/series/:seriesId/cancel` | PATIENT or THERAPIST | Cancel all appointments in a recurring series |

### Therapists — `/api/v1/therapists`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/therapists` | JWT | List all therapists (paginated) |
| `GET` | `/therapists/:id/stats` | JWT | Stats: today's session count, pending holds, active patients |
| `GET` | `/therapists/:id/schedule-config` | THERAPIST | Fetch weekly schedule configuration |
| `PUT` | `/therapists/:id/schedule-config` | THERAPIST | Replace weekly schedule configuration |
| `GET` | `/therapists/:id/agenda` | THERAPIST | Appointment agenda (date-filterable) |

### Dashboard — `/api/v1/dashboard`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/dashboard` | JWT | Role-aware dashboard data. Returns patient or therapist stats based on `req.user.role` |

---

## Core Features

### Slot Booking — Hold / Pay Flow

Booking is a two-step process to prevent double-booking under concurrent load:

**Step 1 — Hold**

`POST /appointments/hold` atomically reserves slots inside a Prisma transaction:

1. Builds the full candidate slot list (single slot or every occurrence for a recurring series up to `recurrenceEndDate`).
2. Sorts slots chronologically — ensures all concurrent transactions acquire locks in the same order, preventing deadlocks.
3. For each slot: acquires a PostgreSQL advisory lock (`pg_advisory_xact_lock`), cleans any existing expired holds for that slot, checks for conflicts (no active HOLD or SCHEDULED record for the same therapist + time window).
4. Inserts all `Appointment` rows in `HOLD` status with a TTL (`holdExpiresAt = now + SLOT_HOLD_DURATION_SECONDS`).
5. If any slot is unavailable the entire transaction rolls back — no partial holds.

**Step 2 — Pay (Single)**

`POST /appointments/:id/pay` inside a transaction:

1. Acquires advisory lock for the slot.
2. Re-fetches the appointment for freshness (inside the lock).
3. Checks for concurrent `SCHEDULED` conflicts from another transaction.
4. Checks hold hasn't expired.
5. Transitions to `SCHEDULED + PaymentStatus.SUCCESS` (or `PAYMENT_FAILED` on failure).

**Step 2 — Pay (Series)**

`POST /appointments/series/:seriesId/pay` inside a 30-second transaction:

1. Fetches all appointments in the series.
2. Acquires advisory locks for all slots (sorted to prevent deadlocks).
3. Validates every appointment: must be `HOLD`, not expired, no slot conflict.
4. If all valid: transitions all to `SCHEDULED` atomically.

### Advisory Locking

PostgreSQL advisory locks (`pg_advisory_xact_lock`) are used to serialize concurrent operations on the same therapist slot without holding long row-level locks.

A deterministic 64-bit key is generated per slot:

```
SHA-256(therapistId + "|" + startTime.toISOString() + "|" + endTime.toISOString())
→ first 8 bytes split into two signed 32-bit integers → (key1, key2)
```

Locks are transaction-scoped and released automatically on commit or rollback.

### Authentication & Token Security

- **Access token**: Short-lived JWT (default 15 min), signed with HS256, carries `sub`, `email`, `role`, `tokenType: 'access'`, `iss`, `aud`.
- **Refresh token**: Cryptographically random bytes (hex), stored only as SHA-256 hash in `RefreshSession`. The raw token is sent once via httpOnly cookie and never logged.
- **Token rotation**: Each refresh call atomically revokes the old session and creates a new one using `updateMany` with a WHERE condition — a second concurrent refresh on the same token will find `updatedCount = 0` and be rejected.
- **Replay protection**: Once a session is revoked, its hash will never match a valid active session again.

### Idempotency

POST endpoints that mutate state (hold, pay) accept an `Idempotency-Key` header. On the first request the full response is persisted to `IdempotencyKey` table. Subsequent requests with the same key receive the cached response without re-executing the business logic. This prevents duplicate bookings from network retries.

### Availability Calculation

`GET /appointments/availability`:

1. Loads `TherapistSchedule` rows covering the requested date range.
2. Loads all `HOLD` (non-expired) and `SCHEDULED` appointments for the therapist in range.
3. For each calendar day, for each active schedule: walks slot windows (`slotDuration + bufferDuration`), skips the break window, skips slots in the past, skips slots that overlap with existing bookings.
4. Returns a paginated, sorted list of available `{ startTime, endTime }` objects.

---

## Authentication Flow

```
Client                          Server
  |                               |
  |-- POST /auth/login ---------->|
  |                               |-- bcrypt verify password
  |                               |-- create RefreshSession (hash only)
  |                               |-- sign JWT access token
  |<-- accessToken (body) --------|
  |<-- Set-Cookie: refresh_token -|  (httpOnly, path=/api/v1/auth)
  |                               |
  |-- GET /api/v1/* (Bearer) ---->|  (access token, 15 min TTL)
  |                               |
  |-- POST /auth/refresh (cookie)->|
  |                               |-- hash raw token, look up session
  |                               |-- atomically revoke old session
  |                               |-- create new RefreshSession
  |                               |-- sign new JWT
  |<-- new accessToken (body) ----|
  |<-- Set-Cookie (new cookie) ---|
```

---

## Error Handling

All errors follow a consistent envelope:

```json
{
  "status": false,
  "message": "Human-readable description",
  "data": null
}
```

Validation errors (Zod) additionally include a field-level `errors` map. The `errorHandler` middleware classifies errors by type and logs them with Winston.

---

## Environment Variables

Create a `.env` file from `.env.example`:

```env
PORT=4000
NODE_ENV=development

DATABASE_URL=postgresql://user:password@localhost:5432/therapysync

JWT_SECRET=                        # Min 32 chars
JWT_REFRESH_SECRET=                # Min 32 chars
JWT_ISSUER=therapysync-api
JWT_AUDIENCE=therapysync-app

ACCESS_TOKEN_EXPIRES_IN=900        # 15 minutes (seconds)
REFRESH_TOKEN_EXPIRES_IN=2592000   # 30 days (seconds)
REFRESH_TOKEN_COOKIE_NAME=refresh_token

SLOT_HOLD_DURATION_SECONDS=60      # Hold TTL

CORS_ALLOWED_ORIGINS=http://localhost:5173

# Cookie SameSite policy
# lax    — local development (same-site)
# none   — cross-origin HTTPS (DevTunnel, Vercel + Railway, etc.) — also sets secure=true automatically
# strict — same-site strict
COOKIE_SAME_SITE=lax

# Database seed
SEED_THERAPIST_NAME="Dr. Sarah Jenkins"
SEED_THERAPIST_EMAIL="therapist@example.com"
SEED_THERAPIST_PASSWORD="YourPassword!"
SEED_PATIENT_NAME="John Doe"
SEED_PATIENT_EMAIL="patient@example.com"
SEED_PATIENT_PASSWORD="YourPassword!"
SEED_SCHEDULE_START_TIME="09:00"
SEED_SCHEDULE_END_TIME="17:00"
SEED_SCHEDULE_SLOT_DURATION="30"
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in DATABASE_URL, JWT secrets, etc.

# Run database migrations and seed
npx prisma migrate dev
npx prisma db seed

# Start development server
npm run dev

# Build for production
npm run build
npm start

# View API docs
open http://localhost:4000/docs
```

---

## Design Decisions

**Why PostgreSQL advisory locks instead of row-level locks?**
Row-level locks on `Appointment` rows don't help when the conflict is a *new* row that doesn't exist yet. Advisory locks let us lock on the *concept* of a therapist+slot before any row is inserted, preventing the TOCTOU race that would allow two patients to hold the same slot simultaneously.

**Why sort slots before locking?**
If Transaction A tries to lock Slot 1 then Slot 2, and Transaction B tries Slot 2 then Slot 1, they deadlock. Sorting ensures all transactions acquire locks in the same order, making deadlock impossible.

**Why store only the refresh token hash?**
If the database is compromised, an attacker cannot impersonate users using the stored hash alone — the raw token was only ever in the HTTP response and the cookie. This follows the same principle as password hashing.

**Why idempotency keys in PostgreSQL instead of Redis?**
Keeps the infrastructure simple — no additional service to manage. Idempotency keys have a natural TTL that can be enforced with a scheduled cleanup. For the current scale, database storage is sufficient.

**Why `COOKIE_SAME_SITE=none` for cross-origin deployments?**
When the frontend (e.g., Vercel) and backend (e.g., Railway) are on different domains, `SameSite=lax` prevents the browser from sending the refresh cookie on cross-origin POST requests. `SameSite=none` allows it, but requires `Secure=true` (HTTPS), which the code enforces automatically when `COOKIE_SAME_SITE=none` is set.

**Why a 30-second transaction timeout on `confirmSeries`?**
A recurring series (e.g., weekly for 3 months) can contain 12+ appointments. The series confirmation transaction acquires advisory locks, runs conflict checks, and updates each appointment row sequentially — this can take several seconds on a busy database. Prisma's default interactive transaction timeout is 5 seconds, which is too short for series operations.
