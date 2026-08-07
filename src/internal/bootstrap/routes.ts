import { Express, Router } from 'express';
import { v1Router } from '../api/v1/routes';

// TODO: Register versioned API routes and any global route prefixes.
export function registerRoutes(app: Express): void {
  const apiRouter = Router();
  apiRouter.use('/v1', v1Router);
  app.use('/api', apiRouter);
}
