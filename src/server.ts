import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { runAutoMigrations } from './internal/bootstrap/database';
import { logger } from './internal/shared/logger';

// Run database auto-migration on server startup
runAutoMigrations();

const initialPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

function startServer(portToTry: number) {
  const server = app.listen(portToTry, () => {
    logger.info(`Server initialized successfully`, {
      port: portToTry,
      environment: process.env.NODE_ENV || 'development',
      swaggerDocs: `http://localhost:${portToTry}/docs`,
    });
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${portToTry} is in use, attempting fallback to port ${portToTry + 1}`);
      startServer(portToTry + 1);
    } else {
      logger.error('Fatal server startup error', { error: err.message, stack: err.stack });
    }
  });

  return server;
}

const server = startServer(initialPort);

export default server;
