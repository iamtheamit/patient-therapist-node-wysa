import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { logger } from '../../shared/logger';

export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('${')) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD ? encodeURIComponent(process.env.DB_PASSWORD) : '';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const dbName = process.env.DB_NAME || 'healthcare';

  return `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

export function runAutoMigrations(): void {
  const autoMigrate = process.env.AUTO_MIGRATE !== 'false';
  if (!autoMigrate) return;

  try {
    logger.info('Verifying database schema auto-migrations...');
    execSync('npx prisma db push --skip-generate', {
      stdio: 'pipe',
      env: process.env,
    });
    logger.info('Database schema is synchronized and up-to-date.');
  } catch (err: any) {
    logger.warn('Database auto-migration notice', {
      error: err.stderr?.toString() || err.message,
    });
  }
}

