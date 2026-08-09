import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../shared/errors';
import { MIDDLEWARE_MESSAGES } from '../shared/constants';
import { config } from '../../config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tokenType?: 'access' | 'refresh';
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError(MIDDLEWARE_MESSAGES.MISSING_HEADER));
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = config.jwtSecret;
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    }) as JwtPayload;

    if (decoded.tokenType && decoded.tokenType !== 'access') {
      throw new Error('Invalid token type');
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    return next(new UnauthorizedError(MIDDLEWARE_MESSAGES.INVALID_TOKEN));
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError(MIDDLEWARE_MESSAGES.AUTH_REQUIRED));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(MIDDLEWARE_MESSAGES.ROLE_DENIED(allowedRoles.join(' or '))));
    }

    next();
  };
}
