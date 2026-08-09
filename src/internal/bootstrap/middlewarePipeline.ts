import express, { Express } from 'express';
import cors from 'cors';
import { requestLogger } from '../middleware/requestLogger';
import { errorHandler } from '../middleware/errorHandler';
import { config } from '../../config';

const defaultDevOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4200',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4200',
];

export function getCorsOptions(
  isProd: boolean = process.env.NODE_ENV === 'production',
  configuredOrigins: string[] = config.corsAllowedOrigins
): cors.CorsOptions {
  const allowedOrigins = isProd
    ? configuredOrigins
    : Array.from(new Set([...configuredOrigins, ...defaultDevOrigins]));

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (such as server-to-server or same-origin requests)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'Accept', 'accept'],
    credentials: false,
    optionsSuccessStatus: 204,
  };
}

export function setupPreRouteMiddleware(app: Express): void {
  app.use(cors(getCorsOptions()));
  app.use(express.json());
  app.use(requestLogger);
}

export function setupPostRouteMiddleware(app: Express): void {
  app.use(errorHandler);
}

export function setupMiddleware(app: Express): void {
  setupPreRouteMiddleware(app);
}
