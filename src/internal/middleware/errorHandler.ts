import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors';
import { ZodError } from 'zod';
import { logger } from '../shared/logger';
import { sendError } from '../shared/responses';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const requestId = req.id;

  if (err instanceof AppError) {
    logger.warn(`Application Error: ${err.message}`, {
      requestId,
      statusCode: err.statusCode,
      path: req.originalUrl,
      method: req.method,
    });
    sendError(res, err.message, err.statusCode, null);
    return;
  }

  if (err instanceof ZodError) {
    logger.warn('Validation Error', {
      requestId,
      path: req.originalUrl,
      method: req.method,
      issues: err.errors,
    });
    const details = err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
    sendError(res, 'Validation Error', 400, details);
    return;
  }

  logger.error('Unhandled System Exception', {
    requestId,
    error: err.message || err,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.status || err.statusCode || 500;
  sendError(res, err.message || 'Internal Server Error', statusCode, null);
}

