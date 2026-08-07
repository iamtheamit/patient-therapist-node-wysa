import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors';
import { ZodError } from 'zod';
import { logger } from '../shared/logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const requestId = req.id;

  if (err instanceof AppError) {
    logger.warn(`Application Error: ${err.message}`, {
      requestId,
      statusCode: err.statusCode,
      path: req.originalUrl,
      method: req.method,
    });
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    logger.warn('Validation Error', {
      requestId,
      path: req.originalUrl,
      method: req.method,
      issues: err.errors,
    });
    res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  logger.error('Unhandled System Exception', {
    requestId,
    error: err.message || err,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
}
