# TherapySync — Backend

REST API for a telehealth appointment platform. Handles therapist scheduling, patient slot booking with a hold/pay flow, recurring series management, and secure JWT authentication with refresh token rotation.

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

## Project Structure — Every File Explained

```
.
├── api/
│   └── index.ts                    # Vercel serverless entry point
├── prisma/
│   ├── schema.prisma               # Database schema — all models, enums, indexes
│   └── seed.ts                     # Seeds one therapist, one patient, and a weekly schedule
├── src/
│   ├── app.ts                      # Express app factory
│   ├── server.ts                   # Local dev entry point — calls app.listen()
│   ├── index.ts                    # Re-exports app and server for external consumers
│   ├── config/
│   │   ├── index.ts                # Zod-validated environment config object
│   │   └── swagger.ts              # Swagger/OpenAPI UI setup at /docs
│   └── internal/
│       ├── api/v1/
│       │   ├── controllers/        # One controller per domain — parse request, call service, send response
│       │   │   ├── appointmentController.ts
│       │   │   ├── authController.ts
│       │   │   ├── dashboardController.ts
│       │   │   ├── scheduleController.ts
│       │   │   ├── therapistController.ts
│       │   │   └── index.ts        # Re-exports all controllers
│       │   └── routes/             # One router per domain — attaches middleware and maps to controllers
│       │       ├── appointmentRoutes.ts
│       │       ├── authRoutes.ts
│       │       ├── dashboardRoutes.ts
│       │       ├── scheduleRoutes.ts
│       │       ├── therapistRoutes.ts
│       │       └── index.ts        # Combines all routers under /v1
│       ├── bootstrap/
│       │   ├── middlewarePipeline.ts   # Registers CORS, JSON body parser, request logger
│       │   └── routes.ts               # Mounts the /api/v1 router on the Express app
│       ├── infrastructure/
│       │   └── database/
│       │       └── prismaClient.ts     # PrismaClient singleton + runAutoMigrations()
│       ├── middleware/
│       │   ├── authMiddleware.ts       # JWT verification and role guard
│       │   ├── errorHandler.ts         # Global error handler — AppError, ZodError, generic
│       │   ├── idempotencyMiddleware.ts # Idempotency-Key deduplication
│       │   ├── requestLogger.ts        # Per-request structured Winston logging
│       │   └── index.ts
│       ├── repositories/
│       │   ├── appointmentRepository.ts  # All Prisma queries for Appointment model
│       │   ├── scheduleRepository.ts     # All Prisma queries for TherapistSchedule model
│       │   └── userRepository.ts         # All Prisma queries for User model
│       ├── services/
│       │   ├── appointmentService.ts   # Hold/pay/cancel/confirm business logic
│       │   ├── authService.ts          # Register/login/refresh/revoke token logic
│       │   ├── availabilityService.ts  # Slot availability calculation
│       │   ├── dashboardService.ts     # Role-aware dashboard aggregations
│       │   ├── scheduleService.ts      # Schedule read/write orchestration
│       │   ├── therapistService.ts     # Therapist list, stats, agenda
│       │   └── index.ts
│       ├── shared/
│       │   ├── constants/
│       │   │   └── index.ts        # HTTP status codes, error messages, domain constants
│       │   ├── errors/
│       │   │   └── index.ts        # AppError class + subclasses (NotFoundError, UnauthorizedError, etc.)
│       │   ├── helpers/
│       │   │   ├── dateHelper.ts   # Date arithmetic — slot window iteration, today bounds, date parsing
│       │   │   ├── lockHelper.ts   # SHA-256 → two i32 advisory lock key generator
│       │   │   ├── pagination.ts   # parsePaginationParams(), formatPaginatedResult()
│       │   │   └── index.ts
│       │   ├── logger/
│       │   │   └── index.ts        # Winston logger instance (console + structured JSON)
│       │   └── responses/
│       │       └── index.ts        # sendSuccess() / sendError() — standard response envelope
│       └── validators/
│           ├── appointmentValidator.ts  # Zod schemas for hold, pay, status update requests
│           ├── authValidator.ts         # Zod schemas for register and login requests
│           └── scheduleValidator.ts     # Zod schemas for schedule config PUT request
└── vercel.json                     # Vercel deployment config — routes all traffic to api/index.ts
```


---

## File-by-File Walkthrough

### Entry Points

**`api/index.ts`** — Vercel serverless entry point. Imports and exports the Express `app` without calling `app.listen()`. Vercel's `@vercel/node` runtime wraps the export as a serverless function and manages the HTTP lifecycle. Also calls `runAutoMigrations()` on cold start so the database schema stays in sync after deployments.

**`src/server.ts`** — Local development entry point. Loads `.env`, calls `runAutoMigrations()`, then calls `app.listen()` on `PORT` (default 4000). Includes fallback logic — if the port is in use it tries `PORT + 1` automatically.

**`src/app.ts`** — Express app factory. Creates the Express instance, applies middleware in order (CORS → JSON body parser → request logger), mounts Swagger at `/docs`, registers all API routes under `/api`, and registers the global error handler. Also registers `GET /` which returns a health check JSON response. Exported without calling `listen()` so both the local server and Vercel entry can import it.

**`src/index.ts`** — Re-exports `app` and `server` for any external consumers or test harnesses that import from the package root.

---

### Config

**`src/config/index.ts`** — Reads all environment variables and validates them at startup using a Zod schema. If any required variable is missing or invalid, the process exits immediately with a clear error. Exports a typed `config` object used throughout the codebase — no raw `process.env` access outside this file. Covers JWT secrets, token TTLs, cookie settings, CORS origins, slot hold duration, and the cookie `SameSite` policy.

**`src/config/swagger.ts`** — Configures `swagger-jsdoc` to scan route and controller files for JSDoc `@swagger` annotations, then mounts `swagger-ui-express` at `/docs`. Provides a browser-accessible API explorer in all environments.

---

### Bootstrap

**`src/internal/bootstrap/middlewarePipeline.ts`** — Defines and applies all pre-route and post-route middleware. `setupPreRouteMiddleware` registers CORS (with dev origins automatically added), `express.json()` body parser, and the request logger. `setupPostRouteMiddleware` registers the global error handler. CORS is configured to allow credentials (`withCredentials: true`) and exposes the `Idempotency-Key` header. In development, `localhost:3000/5173/4200` are always included alongside any configured origins.

**`src/internal/bootstrap/routes.ts`** — Mounts the versioned API router. Creates an `/api` parent router, mounts the full `v1Router` under `/v1`, then attaches it to the Express app. All routes are therefore reachable at `/api/v1/...`.

---

### Infrastructure

**`src/internal/infrastructure/database/prismaClient.ts`** — Three exports:
- `getDatabaseUrl()` — builds the connection string from `DATABASE_URL` or individual `DB_*` env vars.
- `prisma` — the singleton `PrismaClient` instance shared across all repositories.
- `runAutoMigrations()` — runs `prisma db push --skip-generate` on startup when `AUTO_MIGRATE` is not `false`. This keeps the schema in sync on Vercel cold starts and local dev restarts without needing manual migration commands.


---

### Middleware

**`src/internal/middleware/authMiddleware.ts`** — Two exports:
- `authenticateToken` — extracts the `Bearer` token from the `Authorization` header, verifies it with `jwt.verify` (HS256, checks issuer and audience), validates `tokenType === 'access'` to reject refresh tokens used as access tokens, and attaches `{ id, email, role }` to `req.user`.
- `requireRole(...roles)` — middleware factory that returns a guard checking `req.user.role` is in the allowed list. Returns 403 if the role doesn't match.

**`src/internal/middleware/errorHandler.ts`** — Global Express error handler (registered last). Handles three error categories:
- `AppError` subclasses (e.g., `NotFoundError`, `UnauthorizedError`) — logged as warnings, returned with the correct HTTP status.
- `ZodError` — logged as validation warnings, returned as 400 with a field-level `errors` array showing which fields failed and why.
- Everything else — logged as a full stack trace error, returned as 500.
All errors use the standard `{ status, message, data }` envelope via `sendError()`.

**`src/internal/middleware/idempotencyMiddleware.ts`** — Reads the `Idempotency-Key` request header. If found, looks up the key in the `IdempotencyKey` table. On a cache hit, replays the stored status code and response body immediately without executing the route handler. On a cache miss, wraps `res.json` to intercept the outgoing response and persists the key + response to the database on any 2xx. This prevents duplicate bookings when clients retry failed network requests.

**`src/internal/middleware/requestLogger.ts`** — Assigns a UUID request ID to every incoming request (reading `x-request-id` header if provided, otherwise generating one). Sets `x-request-id` on the response for tracing. Listens to the `res.finish` event to log the method, URL, status code, duration in ms, IP, and user agent using Winston at `http` level.

---

### Repositories

Repositories are the only layer that talks to Prisma. They contain no business logic — just typed query methods. Services call repositories, never Prisma directly.

**`src/internal/repositories/userRepository.ts`**
- `findByEmail(email)` — used by login to look up the user.
- `findById(id)` — used by auth `me` endpoint and token refresh to validate the user still exists.
- `findAllTherapists(params?)` — paginated list of all `THERAPIST` role users, used by the therapist listing endpoint.
- `create(data)` — creates a new user row during registration.

**`src/internal/repositories/scheduleRepository.ts`**
- `findByTherapistId(therapistId, effectiveDate?)` — returns the active schedule for each day of the week as of a given date. Deduplicates by `dayOfWeek` so only the most recent effective schedule per day is returned.
- `findByTherapistIdForDateRange(therapistId, start, end)` — returns all schedule rows overlapping a date range, used by availability calculation.
- `updateSchedules(therapistId, items, effectiveFrom?)` — replaces a therapist's schedule in a transaction. Closes the previous schedule window by setting `effectiveUntil`, then inserts new rows starting at `effectiveFrom`. This preserves history — old slots that were booked against the previous schedule aren't retroactively invalidated.

**`src/internal/repositories/appointmentRepository.ts`** — The most complex repository. Key methods:
- `acquireSlotLock(tx, therapistId, startTime, endTime)` — runs `SELECT pg_advisory_xact_lock(key1, key2)` inside the current transaction to serialize concurrent access to a slot.
- `findActiveAppointmentsInRange(...)` — returns all non-expired HOLD and SCHEDULED appointments for a therapist in a time range, used by availability calculation.
- `cleanExpiredHoldsForSlot(tx, ...)` — marks expired HOLDs for a specific slot as `HOLD_EXPIRED` inside a transaction, clearing the way for new holds.
- `expireOldHolds()` — bulk-expires all globally expired holds, called before fetching patient/therapist appointment lists to keep statuses accurate.
- `checkSlotConflict(tx, ...)` — returns true if any active or non-expired hold overlaps the given time window.
- `createHoldInTx(tx, data)` — creates a new `HOLD` appointment inside a transaction.
- `findById(id, tx?)` — fetches a single appointment with patient and therapist names included. Accepts an optional transaction client.
- `updateStatus(id, status, paymentStatus?, tx?, notes?)` — updates appointment status and optionally payment status and notes. Used for confirming payment, cancelling, marking expired.
- `updateSeriesStatus(seriesId, status, filters?)` — bulk-updates all appointments in a series, optionally filtered by patient or therapist.
- `findByTherapist / findByPatient` — paginated, filterable appointment lists. Patient variant supports status aliases (`upcoming`, `past`, `holds`, `failed`) as well as direct enum values, date range filtering, and therapist name search.
- Dashboard-specific query methods: `findTodayAppointments`, `findUpcomingForPatient/Therapist`, `findActiveHoldsForPatient`, `findRecentForPatient/Therapist`, `countPendingHoldsForTherapist`, `countTodayAppointmentsForTherapist`, `countDistinctPatients/Therapists` — all run directly without going through the service layer.


---

### Services

Services contain all business logic. They coordinate between repositories, enforce domain rules, and manage transactions. Controllers call services; services never call controllers.

**`src/internal/services/authService.ts`**

- `register(payload, metadata?)` — checks email uniqueness, bcrypt-hashes the password (10 salt rounds), creates the user with role forced to `PATIENT`, then calls `generateTokens`.
- `login(credentials, metadata?)` — finds user by email, runs `bcrypt.compare`, throws `UnauthorizedError` on mismatch, then calls `generateTokens`.
- `generateTokens(user, metadata?)` — creates a `RefreshSession` row storing only the SHA-256 hash of a newly generated random token. Signs a short-lived JWT access token (`{ sub, email, role, tokenType: 'access' }`, HS256). Returns both tokens.
- `refreshToken(rawToken, metadata?)` — hashes the raw token, finds the matching session, checks it isn't revoked or expired. Atomically revokes the old session using `updateMany` with a WHERE that includes `revokedAt: null` — if two requests race on the same token, only one will find `updatedCount === 1`. Creates a new session and issues a new token pair.
- `revokeRefreshToken(rawToken)` — used by logout. Sets `revokedAt` on the session. Silently succeeds if the token is already revoked or doesn't exist.
- `getProfile(userId)` — returns the user's public profile (no password hash).

**`src/internal/services/availabilityService.ts`**

- `getAvailableSlots(therapistId, startDate, endDate, pagination?)` — the core availability algorithm:
  1. Loads all schedule rows covering the date range.
  2. Loads all active (non-expired HOLD + SCHEDULED) appointments in the range.
  3. For each calendar day, for each applicable schedule row: iterates slot windows of `slotDuration + bufferDuration` minutes. Skips slots overlapping the break window, slots in the past, and slots that conflict with existing appointments.
  4. Returns a paginated, sorted list of `{ startTime, endTime }` objects.

**`src/internal/services/appointmentService.ts`** — The most complex service.

- `holdSlot(patientId, dto)` — runs in a Prisma transaction with a 15s timeout:
  1. Builds the full slot list. For `RECURRING` bookings, generates every occurrence from the start date to `recurrenceEndDate` based on frequency (daily, weekly, bi-weekly, monthly). Assigns a shared `seriesId` UUID.
  2. Sorts all slots by start time (deadlock prevention).
  3. Per slot: acquires advisory lock → cleans expired holds for that slot → checks for conflicts → inserts `HOLD` record with `holdExpiresAt = now + SLOT_HOLD_DURATION_SECONDS`.
  4. Rolls back entirely if any slot is unavailable.

- `simulatePayment(patientId, appointmentId, dto)` — runs in a transaction with 15s timeout:
  1. Acquires advisory lock for the slot.
  2. Re-fetches the appointment inside the lock for fresh state.
  3. Checks no other appointment is `SCHEDULED` for the same slot (concurrent confirm guard).
  4. Checks the hold hasn't expired.
  5. On `dto.status === 'SUCCESS'`: transitions to `SCHEDULED + PaymentStatus.SUCCESS`.
  6. On failure: transitions to `PAYMENT_FAILED`.

- `confirmSeries(patientId, seriesId, notes?)` — runs in a transaction with 30s timeout (series can have 12+ slots):
  1. Fetches all appointments in the series belonging to this patient.
  2. Acquires advisory locks for all slots (sorted to prevent deadlocks).
  3. Validates every appointment: must be `HOLD`, not expired, no slot already `SCHEDULED` by another.
  4. Atomically transitions all to `SCHEDULED + PaymentStatus.SUCCESS`.

- `cancelAppointment(userId, role, appointmentId)` — role-checks ownership (patient can only cancel their own, therapist can only cancel theirs), then marks `CANCELLED`.

- `cancelSeries(userId, role, seriesId)` — same ownership check but uses `updateSeriesStatus` to bulk-cancel all appointments in the series.

- `releaseHold(patientId, holdId)` — acquires advisory lock, transitions `HOLD → HOLD_EXPIRED`. Silently succeeds if already `HOLD_EXPIRED`.

- `updateAppointmentStatusByTherapist(therapistId, appointmentId, dto)` — ownership-checked status update for therapists (used to mark COMPLETED, NO_SHOW, etc.).

**`src/internal/services/scheduleService.ts`** — Thin orchestration layer over `ScheduleRepository`. `getTherapistSchedule` delegates to `findByTherapistId`. `updateTherapistSchedule` delegates to `updateSchedules`, passing the validated DTO items.

**`src/internal/services/therapistService.ts`** — `getTherapistList` returns paginated therapists. `getTherapistStats` runs count queries in parallel for today's sessions, pending holds, and active patients. `getTherapistAgenda` returns a date-filtered appointment list.

**`src/internal/services/dashboardService.ts`** — Role-aware dashboard. Runs all sub-queries in parallel using `Promise.all`. Patient dashboard: completed count, upcoming appointments, active holds, recent appointments, distinct therapist count. Therapist dashboard: today's schedule, upcoming/recent appointments, pending holds count, total patients, completed count.


---

### Shared Utilities

**`src/internal/shared/helpers/lockHelper.ts`** — `generateSlotLockKey(therapistId, startTime, endTime)` creates a deterministic 64-bit advisory lock key. It SHA-256 hashes the concatenated string `"therapistId|startISO|endISO"` and reads the first 8 bytes as two signed 32-bit integers (`key1`, `key2`). These are passed to `pg_advisory_xact_lock(key1, key2)`. The same therapist+slot always produces the same key pair, ensuring all transactions compete on the same lock.

**`src/internal/shared/helpers/dateHelper.ts`** — Date arithmetic utilities: `parseDateString(str, endOfDay?)` parses `YYYY-MM-DD` strings into `Date` objects. `getTodayDateBounds()` returns start and end of today in UTC. `iterateSlotWindows(schedule, date)` generates the sequence of `{ startTime, endTime }` slot pairs for a given schedule row on a given calendar day, respecting the slot and buffer durations.

**`src/internal/shared/helpers/pagination.ts`** — `parsePaginationParams(query)` extracts `page` and `limit` from query strings with safe defaults and max limits. `formatPaginatedResult(items, total, page, limit)` wraps results in `{ data, pagination: { page, limit, total, totalPages } }`.

**`src/internal/shared/errors/index.ts`** — `AppError` base class with `statusCode` and `message`. Subclasses: `NotFoundError` (404), `UnauthorizedError` (401), `ForbiddenError` (403), `BadRequestError` (400), `ConflictError` (409). The error handler checks `instanceof AppError` to distinguish these from unexpected system errors.

**`src/internal/shared/responses/index.ts`** — `sendSuccess(res, data, message, statusCode)` and `sendError(res, message, statusCode, details?)` produce the standard envelope: `{ status: true/false, message, data }`. All controllers use these — no raw `res.json()` calls in route handlers.

**`src/internal/shared/constants/index.ts`** — Named constants for all HTTP status codes, all user-facing error and success messages (grouped by domain: `AUTH_MESSAGES`, `APPOINTMENT_MESSAGES`, `MIDDLEWARE_MESSAGES`), and domain constants like `DEFAULT_BUFFER_DURATION_MINUTES`, `REFRESH_TOKEN_BYTE_LENGTH`, `PASSWORD_SALT_ROUNDS`.

**`src/internal/shared/logger/index.ts`** — Winston logger configured with `console` transport, structured JSON format in production, pretty-print in development. Log levels: `error`, `warn`, `info`, `http`, `debug`. All middleware, services, and the error handler use this logger — no `console.log` in production code.

---

### Validators

**`src/internal/validators/authValidator.ts`** — Zod schemas `registerSchema` (name, email, password min 8 chars with complexity rules) and `loginSchema` (email, password). Inferred TypeScript types exported as `RegisterSchema` and `LoginSchema`.

**`src/internal/validators/appointmentValidator.ts`** — Schemas for `holdSlotSchema` (therapistId UUID, startTime/endTime ISO dates, bookingType, optional recurrence fields), `simulatePaymentSchema` (status enum: `SUCCESS | FAILED`, optional notes), `updateAppointmentStatusSchema` (status enum), and `getAvailabilityQuerySchema` (therapistId, startDate, endDate strings).

**`src/internal/validators/scheduleValidator.ts`** — `scheduleItemSchema` (dayOfWeek 0–6, startTime/endTime HH:mm, slotDuration, bufferDuration, optional break times, isActive) and `updateScheduleSchema` (array of schedule items). Inferred `ScheduleItemDto` type used by the repository.

---

### Prisma Schema

**`prisma/schema.prisma`** — Five models:

**`User`** — Single table for both patients and therapists. `role` enum distinguishes them. `passwordHash` stores bcrypt output. Relations: `TherapistSchedule[]`, two `Appointment[]` relations (as patient and as therapist), `RefreshSession[]`.

**`TherapistSchedule`** — Represents one day's working hours for a therapist. `dayOfWeek` is 0 (Sunday) through 6 (Saturday). `startTime`/`endTime`/`breakStartTime`/`breakEndTime` are stored as `"HH:mm"` strings. `slotDuration` and `bufferDuration` are in minutes. `effectiveFrom`/`effectiveUntil` enable versioned schedule history — updating a schedule closes the old rows and creates new ones rather than mutating in place. Indexed on `(therapistId, dayOfWeek)` and `(therapistId, isActive, effectiveFrom)`.

**`Appointment`** — Core booking record. `seriesId` groups recurring appointments — all occurrences in a series share the same UUID. `holdExpiresAt` is set when status is `HOLD`; null for confirmed appointments. `notes` stores the patient's session focus or therapist's clinical notes. Indexed on `(therapistId, startTime, endTime)` for fast conflict checks, and on `patientId` and `seriesId` separately.

**`RefreshSession`** — One row per issued refresh token. `tokenHash` is the SHA-256 of the raw token (never stored raw). `revokedAt` is set when the token is used or logged out. `replacedBySessionId` links to the successor session, creating a rotation audit trail. Indexed on `tokenHash` for O(1) lookup on refresh, and on `(expiresAt, revokedAt)` for cleanup queries.

**`IdempotencyKey`** — Keyed by the client-supplied `Idempotency-Key` string. `response` stores the full JSON response body as a string. `statusCode` stores the HTTP status. Used by the idempotency middleware to replay responses for duplicate requests.

**`prisma/seed.ts`** — Creates one `THERAPIST` user and one `PATIENT` user (credentials from env vars). Creates a `TherapistSchedule` for Monday through Friday with the configured start time, end time, and slot duration. Safe to re-run — uses `upsert` on email to avoid duplicate key errors.


---

## Database Schema — Enums

| Enum | Values | Used For |
|---|---|---|
| `Role` | `PATIENT`, `THERAPIST` | User table role, JWT claims, route guards |
| `AppointmentStatus` | `HOLD`, `HOLD_EXPIRED`, `PAYMENT_FAILED`, `SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` | Full appointment lifecycle |
| `PaymentStatus` | `PENDING`, `SUCCESS`, `FAILED`, `NOT_REQUIRED` | Payment outcome on each appointment |
| `BookingType` | `ONE_TIME`, `RECURRING` | Distinguishes single vs series bookings |
| `RecurrenceFrequency` | `NONE`, `DAILY`, `WEEKLY`, `BI_WEEKLY`, `MONTHLY` | Interval between recurring occurrences |
| `AppointmentCategory` | `FOLLOW_UP`, `CONSULTATION_CBT`, `INITIAL_INTAKE`, `GENERAL_COUNSELING` | Session type (stored on appointment, not yet enforced at API level) |

---

## API Reference

Base path: `/api/v1`

### Auth — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new patient. Returns `accessToken` in body, sets `refresh_token` httpOnly cookie |
| `POST` | `/auth/login` | Public | Login. Returns `accessToken` in body, sets `refresh_token` httpOnly cookie |
| `POST` | `/auth/refresh` | Cookie | Rotate refresh token. Atomically revokes old session, issues new token pair |
| `POST` | `/auth/logout` | Cookie | Revoke refresh session and clear cookie |
| `GET` | `/auth/me` | JWT | Return authenticated user's profile |

### Appointments — `/api/v1/appointments`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/appointments/availability` | Public | Paginated available slots for a therapist in a date range |
| `POST` | `/appointments/hold` | PATIENT | Atomically hold one slot or a full recurring series. Requires `Idempotency-Key` |
| `POST` | `/appointments/holds/:holdId/release` | PATIENT | Explicitly release a hold before expiry |
| `POST` | `/appointments/:id/pay` | PATIENT | Confirm payment for a single held appointment. Requires `Idempotency-Key` |
| `POST` | `/appointments/series/:seriesId/pay` | PATIENT | Atomically confirm all holds in a recurring series. Requires `Idempotency-Key` |
| `GET` | `/appointments/patient` | PATIENT | Patient's appointments (paginated, filterable) |
| `GET` | `/appointments/therapist` | THERAPIST | Therapist's appointments (paginated, filterable) |
| `PATCH` | `/appointments/:id/status` | THERAPIST | Update status (e.g., `COMPLETED`, `NO_SHOW`) |
| `POST` | `/appointments/:id/cancel` | PATIENT or THERAPIST | Cancel a single appointment |
| `POST` | `/appointments/series/:seriesId/cancel` | PATIENT or THERAPIST | Cancel all appointments in a series |

### Therapists — `/api/v1/therapists`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/therapists` | JWT | Paginated list of all therapists |
| `GET` | `/therapists/:id/stats` | JWT | Today's session count, pending holds, active patients |
| `GET` | `/therapists/:id/schedule-config` | THERAPIST | Current weekly schedule configuration |
| `PUT` | `/therapists/:id/schedule-config` | THERAPIST | Replace weekly schedule configuration |
| `GET` | `/therapists/:id/agenda` | THERAPIST | Date-filtered appointment agenda |

### Dashboard — `/api/v1/dashboard`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/dashboard` | JWT | Role-aware stats. Returns patient or therapist data based on JWT role claim |

### Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Public | Returns `{ status: true, message: "TherapySync API is healthy and running." }` |


---

## How the Booking Flow Works End to End

### Step 1 — Patient checks availability

```
GET /api/v1/appointments/availability?therapistId=<id>&startDate=2026-08-10&endDate=2026-08-10
```

`availabilityService` loads the therapist's `TherapistSchedule` rows for that date range and all existing active appointments. It walks the slot windows for each day, skipping booked, expired, and past slots. Returns a list of `{ startTime, endTime }` pairs the patient can choose from.

### Step 2 — Patient holds a slot

```
POST /api/v1/appointments/hold
Idempotency-Key: <uuid>

{ "therapistId": "...", "startTime": "...", "endTime": "...", "bookingType": "ONE_TIME" }
```

Inside a Prisma transaction: advisory lock acquired → expired holds for the slot cleaned → conflict check runs → if clear, `Appointment` row created with status `HOLD` and a TTL. The patient now has (default) 60 seconds to complete payment. For `RECURRING`, all occurrences are locked and inserted atomically in one transaction.

### Step 3 — Patient pays

```
POST /api/v1/appointments/<holdId>/pay
Idempotency-Key: <uuid>

{ "status": "SUCCESS" }
```

Inside a transaction: advisory lock re-acquired → appointment re-fetched for freshness → concurrent conflict check (another patient may have confirmed the same slot) → expiry check → on success, status transitions to `SCHEDULED`. For a series: `POST /appointments/series/:seriesId/pay` confirms all holds atomically.

### Step 4 — Therapist marks the session complete

```
PATCH /api/v1/appointments/<id>/status

{ "status": "COMPLETED" }
```

Ownership verified (therapist can only update their own appointments), status updated.

---

## Authentication Flow

```
Client                                Server
  |                                      |
  |-- POST /auth/login ----------------->|
  |                                      |-- bcrypt.compare(password, hash)
  |                                      |-- create RefreshSession (SHA-256 hash only)
  |                                      |-- jwt.sign({ sub, email, role, tokenType:'access' })
  |<-- { accessToken } (body) -----------|
  |<-- Set-Cookie: refresh_token --------|  httpOnly, path=/api/v1/auth, SameSite per config
  |                                      |
  |-- GET /api/v1/* (Bearer token) ----->|  access token expires in 15 min
  |                                      |
  |-- POST /auth/refresh (cookie) ------>|
  |                                      |-- hash(rawToken) → look up RefreshSession
  |                                      |-- updateMany WHERE revokedAt=null → count must be 1
  |                                      |-- create new RefreshSession
  |                                      |-- set replacedBySessionId on old session
  |                                      |-- jwt.sign(new access token)
  |<-- { accessToken } (body) -----------|
  |<-- Set-Cookie (new refresh token) ---|
  |                                      |
  |-- POST /auth/logout (cookie) ------->|
  |                                      |-- set revokedAt on session
  |                                      |-- clearCookie
  |<-- { success } ---------------------|
```

---

## Error Response Format

All errors follow this envelope:

```json
{
  "status": false,
  "message": "Human-readable description",
  "data": null
}
```

Validation errors (400) include a field-level breakdown:

```json
{
  "status": false,
  "message": "Validation Error",
  "data": [
    { "field": "email", "message": "Invalid email" },
    { "field": "password", "message": "String must contain at least 8 character(s)" }
  ]
}
```

---

## Environment Variables

Create a `.env` file from `.env.example`:

```env
PORT=4000
NODE_ENV=development
AUTO_MIGRATE=true               # Set false to skip prisma db push on startup

DATABASE_URL=postgresql://user:password@localhost:5432/therapysync

JWT_SECRET=                     # Min 32 chars — signs access tokens
JWT_REFRESH_SECRET=             # Min 32 chars — used by auth service
JWT_ISSUER=therapysync-api      # Checked on every JWT verify
JWT_AUDIENCE=therapysync-app    # Checked on every JWT verify

ACCESS_TOKEN_EXPIRES_IN=900     # 15 minutes (seconds)
REFRESH_TOKEN_EXPIRES_IN=2592000  # 30 days (seconds)
REFRESH_TOKEN_COOKIE_NAME=refresh_token

SLOT_HOLD_DURATION_SECONDS=60   # How long a HOLD is valid before auto-expiry

CORS_ALLOWED_ORIGINS=http://localhost:5173  # Comma-separated

# SameSite cookie policy
# lax    — local dev (same-site, default)
# none   — cross-origin HTTPS (Vercel frontend + Railway backend, DevTunnel etc.)
#          secure=true is set automatically when none is used
# strict — same-site strict
COOKIE_SAME_SITE=lax

# Seed data (used by prisma db seed)
SEED_THERAPIST_NAME="Dr. Sarah Jenkins"
SEED_THERAPIST_EMAIL="therapist@example.com"
SEED_THERAPIST_PASSWORD="YourSecurePassword!"
SEED_PATIENT_NAME="John Doe"
SEED_PATIENT_EMAIL="patient@example.com"
SEED_PATIENT_PASSWORD="YourSecurePassword!"
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
# Fill in DATABASE_URL, JWT secrets, and CORS origins

# Push schema to database and seed
npx prisma db push
npx prisma db seed

# Start development server (hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Open API explorer
# http://localhost:4000/docs
```

---

## Deployment on Vercel

The `api/index.ts` entry exports the Express app for Vercel's `@vercel/node` serverless runtime. `vercel.json` routes all incoming requests to that file.

**Required environment variables on Vercel:**
- All variables from `.env.example` except `PORT` (Vercel manages the port).
- Set `COOKIE_SAME_SITE=none` since the frontend and backend are on different domains.
- Set `AUTO_MIGRATE=true` to run `prisma db push` on cold starts.
- Set `NODE_ENV=production`.

`prisma generate` runs automatically via the `postinstall` npm script, so Vercel's dependency cache never serves a stale Prisma client.

---

## Design Decisions

**Why PostgreSQL advisory locks instead of row-level locks?**
A new appointment row doesn't exist yet when we check for conflicts. Row-level locks only work on existing rows. Advisory locks let us lock on the *concept* of a therapist+timeslot before any row is written, eliminating the race window that would allow two patients to hold the same slot.

**Why sort slots before locking?**
If Transaction A locks Slot 1 then Slot 2, while Transaction B locks Slot 2 then Slot 1, they deadlock waiting for each other. Sorting ensures every transaction acquires locks in the same order, making deadlock impossible regardless of concurrency.

**Why store only the refresh token hash?**
If the database is compromised, the attacker gets only hashes — they cannot derive the raw tokens. The raw token exists only in the HTTP response and the browser's httpOnly cookie, never in logs or the database.

**Why use `updateMany` with a WHERE on `revokedAt: null` for token rotation?**
If two concurrent refresh requests arrive with the same token, only one will find a matching row where `revokedAt` is still null. The other will get `updatedCount === 0` and be rejected. This prevents token replay without needing a separate locking mechanism.

**Why idempotency keys in PostgreSQL instead of Redis?**
No additional infrastructure required. Idempotency keys are append-only and can be cleaned up with a scheduled job. For the current scale, a database lookup is fast enough and keeps the system simple.

**Why `COOKIE_SAME_SITE=none` for cross-origin deployments?**
`SameSite=lax` prevents browsers from sending cookies on cross-origin POST requests. When the frontend (Vercel) and backend (separate domain) are on different origins, the refresh cookie would never be sent. `SameSite=none` allows it, but the browser then requires `Secure=true` (HTTPS only). The code sets `secure: true` automatically whenever `COOKIE_SAME_SITE=none` is configured.

**Why a 30-second transaction timeout on `confirmSeries`?**
A recurring weekly series over 3 months creates 12+ appointments. The confirmation transaction acquires one advisory lock per slot and runs one update per slot sequentially. Prisma's default 5-second interactive transaction timeout is too short. A 30-second timeout covers all practical series sizes.

**Why versioned `TherapistSchedule` instead of in-place updates?**
When a therapist changes their working hours, existing booked appointments were made under the old schedule. Closing the old rows with `effectiveUntil` and inserting new rows preserves the history, so availability calculation for past dates still returns the correct schedule, and no existing bookings are invalidated.
