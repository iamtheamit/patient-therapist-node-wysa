import { Request, Response, NextFunction } from 'express';
import { prisma } from '../infrastructure/database/prismaClient';
import { logger } from '../shared/logger';

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.headers['idempotency-key'] as string;
  if (!key) {
    return next();
  }

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      res.status(existing.statusCode).json(JSON.parse(existing.response));
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: any): Response => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        prisma.idempotencyKey
          .create({
            data: {
              key,
              statusCode: res.statusCode,
              response: JSON.stringify(body),
            },
          })
          .catch((err) =>
            logger.error('Failed to persist idempotency key', { key, error: err.message })
          );
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    next(err);
  }
}
