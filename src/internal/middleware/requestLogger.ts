import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../shared/logger';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    logger.http('HTTP Request', {
      requestId,
      method,
      url: originalUrl,
      status: statusCode,
      durationMs: `${durationMs}ms`,
      ip: ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown',
    });
  });

  next();
}
