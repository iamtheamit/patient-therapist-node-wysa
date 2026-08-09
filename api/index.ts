/**
 * Vercel serverless entry point.
 * Exports the Express app directly — Vercel's @vercel/node runtime wraps it
 * in a serverless function. `app.listen()` is NOT called here; Vercel manages
 * the HTTP lifecycle.
 */
import dotenv from 'dotenv';
dotenv.config();

import app from '../src/app';
import { runAutoMigrations } from '../src/internal/infrastructure/database/prismaClient';

// Run migrations on cold start (safe to call repeatedly — Prisma is idempotent)
try {
  runAutoMigrations();
} catch (err) {
  console.error('Auto-migration failed on cold start:', err);
}

export default app;
