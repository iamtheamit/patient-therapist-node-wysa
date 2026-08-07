import { execSync } from 'child_process';
import { logger } from '../shared/logger';

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
