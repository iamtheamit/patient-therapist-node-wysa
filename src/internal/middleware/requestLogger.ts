import { Request, Response, NextFunction } from 'express';

// TODO: Add telemetry-friendly request logging and structured context.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  next();
}
