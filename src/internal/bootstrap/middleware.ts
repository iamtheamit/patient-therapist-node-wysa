import { Express } from 'express';
import { requestLogger } from '../middleware/requestLogger';

// TODO: Register global middleware such as logging, parsing, and error handling.
export function setupMiddleware(app: Express): void {
  app.use(requestLogger);
}
