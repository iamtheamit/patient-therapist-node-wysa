# Healthcare Appointment Booking Backend

Production-grade scaffold for a Node.js backend using Express, TypeScript, Prisma, PostgreSQL, and Zod.

## Architecture

- `src/config` - application configuration and environment bootstrapping
- `src/internal/api` - versioned REST transport layer with `v1` and `v2`
- `src/internal/services` - business logic layer
- `src/internal/repositories` - data access layer
- `src/internal/infrastructure` - database, cache, queue, scheduler, locking, external integrations
- `src/internal/shared` - constants, enums, errors, helpers, responses, types, utils
- `src/internal/bootstrap` - application wiring for middleware and routes

## Getting Started

1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Start in development: `npm run dev`

## Notes

- API versioning is enabled at `/api/v1`
- Business logic and repository implementation should remain separate from transport concerns
- Prisma schema is the source of truth for domain models
