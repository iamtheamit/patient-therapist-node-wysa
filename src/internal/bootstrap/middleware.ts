import express, { Express } from 'express';
import cors from 'cors';
import { requestLogger } from '../middleware/requestLogger';
import { errorHandler } from '../middleware/errorHandler';

export function setupPreRouteMiddleware(app: Express): void {
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'accept'],
    })
  );
  app.use(express.json());
  app.use(requestLogger);
}

export function setupPostRouteMiddleware(app: Express): void {
  app.use(errorHandler);
}

export function setupMiddleware(app: Express): void {
  setupPreRouteMiddleware(app);
}
