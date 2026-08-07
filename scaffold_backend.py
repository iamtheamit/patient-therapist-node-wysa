from pathlib import Path

base = Path('backend')
files = {
    'src/config/index.ts': """// TODO: Load and expose application configuration values.
// Use environment-aware defaults and validate startup config here.

export const config = {
  // TODO: add config values like database URLs, API metadata, and feature flags.
};
""",
    'src/internal/api/v1/controllers/index.ts': """// TODO: Export API version 1 controllers.
// Keep controllers thin: map requests to services and handle transport concerns.

export * from './appointmentController';
""",
    'src/internal/api/v1/controllers/appointmentController.ts': """import { Request, Response, NextFunction } from 'express';

// TODO: Implement appointment-related endpoint handlers for v1.
export class AppointmentController {
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    // TODO: delegate to service layer and send a response.
    next();
  }
}
""",
    'src/internal/api/v1/routes/index.ts': """import { Router } from 'express';

// TODO: Register v1 API routes and wire controllers to route handlers.
export const v1Router = Router();

// Example placeholder route registration
// v1Router.post('/appointments', appointmentController.create.bind(appointmentController));
""",
    'src/internal/api/v1/dto/index.ts': """// TODO: Define request and response DTO types for API version 1.
export * from './appointment.dto';
""",
    'src/internal/api/v1/dto/appointment.dto.ts': """// TODO: Define DTOs for appointment payloads and API contracts.
export interface CreateAppointmentDto {
  // TODO: define appointment payload shape.
}
""",
    'src/internal/api/v1/responses/index.ts': """// TODO: Export response payload shapes for API version 1.
export * from './appointment.response';
""",
    'src/internal/api/v1/responses/appointment.response.ts': """// TODO: Define API response shapes for appointment resources.
export interface AppointmentResponse {
  // TODO: define response fields.
}
""",
    'src/internal/api/v1/index.ts': """export * from './controllers';
export * from './routes';
export * from './dto';
export * from './responses';
""",
    'src/internal/api/v2/index.ts': """// TODO: Add API version 2 exports when the next API contract is available.
export {};
""",
    'src/internal/api/v2/controllers/.gitkeep': '',
    'src/internal/api/v2/routes/.gitkeep': '',
    'src/internal/api/v2/dto/.gitkeep': '',
    'src/internal/api/v2/responses/.gitkeep': '',
    'src/internal/services/index.ts': """export * from './appointmentService';
""",
    'src/internal/services/appointmentService.ts': """// TODO: Implement appointment booking and scheduling business rules here.
export class AppointmentService {
  public async bookAppointment(): Promise<void> {
    // TODO: authorize, validate, and coordinate repository calls.
  }
}
""",
    'src/internal/repositories/index.ts': """export * from './appointmentRepository';
""",
    'src/internal/repositories/appointmentRepository.ts': """// TODO: Keep data access logic encapsulated in repositories.
export class AppointmentRepository {
  public async create(): Promise<void> {
    // TODO: use Prisma client to persist appointment data.
  }
}
""",
    'src/internal/validators/index.ts': """export * from './appointmentValidator';
""",
    'src/internal/validators/appointmentValidator.ts': """import { z } from 'zod';

// TODO: Define validation schemas using Zod for input contracts.
export const appointmentSchema = z.object({
  // TODO: add appointment fields and validations.
});
""",
    'src/internal/middleware/index.ts': """export * from './requestLogger';
""",
    'src/internal/middleware/requestLogger.ts': """import { Request, Response, NextFunction } from 'express';

// TODO: Add telemetry-friendly request logging and structured context.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  next();
}
""",
    'src/internal/infrastructure/database/prismaClient.ts': """// TODO: Initialize and export Prisma client for database access.
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
""",
    'src/internal/infrastructure/cache/cacheClient.ts': """// TODO: Add cache client initialization (e.g. Redis) for fast reads.
export class CacheClient {
  public async connect(): Promise<void> {
    // TODO: implement cache client connection logic.
  }
}
""",
    'src/internal/infrastructure/queue/queueClient.ts': """// TODO: Add queue infrastructure for async processing.
export class QueueClient {
  public async enqueue(): Promise<void> {
    // TODO: implement queue enqueue logic.
  }
}
""",
    'src/internal/infrastructure/scheduler/scheduler.ts': """// TODO: Add scheduler abstractions for cron and background jobs.
export class Scheduler {
  public start(): void {
    // TODO: wire recurring tasks and monitoring.
  }
}
""",
    'src/internal/infrastructure/locking/lockManager.ts': """// TODO: Implement distributed locking abstractions.
export class LockManager {
  public async acquire(): Promise<void> {
    // TODO: secure critical sections across processes.
  }
}
""",
    'src/internal/infrastructure/external/insuranceProviderClient.ts': """// TODO: Add an external integration client for partner services.
export class InsuranceProviderClient {
  public async verifyCoverage(): Promise<void> {
    // TODO: implement external API call stubs.
  }
}
""",
    'src/internal/shared/constants/index.ts': """// TODO: Define application-wide constant values.
export const APP_NAME = 'healthcare-appointment-backend';
""",
    'src/internal/shared/enums/index.ts': """// TODO: Define shared enums for domain and transport models.
export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}
""",
    'src/internal/shared/errors/index.ts': """// TODO: Define error types used across the backend.
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}
""",
    'src/internal/shared/helpers/index.ts': """// TODO: Add helper functions shared across services and transport layers.
export const noop = (): void => {
  // Intentionally empty helper.
};
""",
    'src/internal/shared/responses/index.ts': """// TODO: Standardize API response payloads and success wrappers.
export interface ApiResponse<T> {
  data: T;
  message?: string;
}
""",
    'src/internal/shared/types/index.ts': """// TODO: Add shared domain and transport type aliases.
export type Nullable<T> = T | null;
""",
    'src/internal/shared/utils/index.ts': """// TODO: Add utility functions for common tasks such as mapping and formatting.
export const identity = <T>(value: T): T => value;
""",
    'src/internal/bootstrap/routes.ts': """import { Express, Router } from 'express';
import { v1Router } from '../api/v1/routes';

// TODO: Register versioned API routes and any global route prefixes.
export function registerRoutes(app: Express): void {
  const apiRouter = Router();
  apiRouter.use('/v1', v1Router);
  app.use('/api', apiRouter);
}
""",
    'src/internal/bootstrap/middleware.ts': """import { Express } from 'express';
import { requestLogger } from '../middleware/requestLogger';

// TODO: Register global middleware such as logging, parsing, and error handling.
export function setupMiddleware(app: Express): void {
  app.use(requestLogger);
}
""",
    'src/app.ts': """import express from 'express';
import { setupMiddleware } from './internal/bootstrap/middleware';
import { registerRoutes } from './internal/bootstrap/routes';

// TODO: Configure the Express application and bootstrap core middleware and routes.
const app = express();

setupMiddleware(app);
registerRoutes(app);

export default app;
""",
    'src/server.ts': """import app from './app';

const port = process.env.PORT ?? 4000;

// TODO: Start the HTTP server and expose health monitoring endpoints if needed.
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
""",
    'src/index.ts': """// TODO: Export the application entry points for local testing and serverless adaptors.
export { default as app } from './app';
export { default as server } from './server';
""",
    'prisma/schema.prisma': """generator client {
  provider = 'prisma-client-js'
}

datasource db {
  provider = 'postgresql'
  url      = env('DATABASE_URL')
}

// TODO: Define Prisma models for appointments, patients, providers, and other healthcare domain entities.
""",
    'prisma/seed.ts': """// TODO: Seed the database with initial data required for local development.
export async function seed(): Promise<void> {
  // TODO: implement seed logic using Prisma client.
}
""",
    'tests/unit/.gitkeep': '',
    'tests/integration/.gitkeep': '',
    'tests/e2e/.gitkeep': '',
    'docs/.gitkeep': '',
    '.env.example': """# TODO: Replace placeholder values with real environment variables.
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/healthcare
NODE_ENV=development
""",
    'package.json': """{
  \"name\": \"healthcare-appointment-backend\",
  \"version\": \"0.1.0\",
  \"private\": true,
  \"main\": \"dist/server.js\",
  \"scripts\": {
    \"dev\": \"ts-node-dev --respawn --transpile-only src/server.ts\",
    \"build\": \"tsc -p tsconfig.json\",
    \"start\": \"node dist/server.js\",
    \"prisma:generate\": \"prisma generate\",
    \"prisma:migrate\": \"prisma migrate dev\"
  },
  \"dependencies\": {
    \"@prisma/client\": \"^5.0.0\",
    \"cors\": \"^2.8.5\",
    \"dotenv\": \"^16.3.1\",
    \"express\": \"^4.18.2\",
    \"zod\": \"^3.23.2\"
  },
  \"devDependencies\": {
    \"@types/cors\": \"^2.8.17\",
    \"@types/express\": \"^4.17.18\",
    \"@types/node\": \"^20.14.2\",
    \"prisma\": \"^5.10.0\",
    \"ts-node-dev\": \"^2.0.0\",
    \"typescript\": \"^5.5.0\"
  }
}
""",
    'tsconfig.json': """{
  \"compilerOptions\": {
    \"target\": \"ES2022\",
    \"module\": \"commonjs\",
    \"rootDir\": \"src\",
    \"outDir\": \"dist\",
    \"strict\": true,
    \"esModuleInterop\": true,
    \"forceConsistentCasingInFileNames\": true,
    \"skipLibCheck\": true,
    \"moduleResolution\": \"node\",
    \"resolveJsonModule\": true,
    \"noImplicitAny\": true,
    \"sourceMap\": true
  },
  \"include\": [\"src/**/*.ts\"],
  \"exclude\": [\"node_modules\", \"dist\"]
}
""",
    'README.md': """# Healthcare Appointment Booking Backend

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
"""
}

for relative_path, content in files.items():
    target = base / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')

print(f'Scaffold created at {base.resolve()}')
