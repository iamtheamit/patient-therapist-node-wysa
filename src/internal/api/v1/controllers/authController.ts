import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../../services/authService';

import { registerSchema, loginSchema } from '../../../validators/authValidator';
import { sendSuccess } from '../../../shared/responses';
import { UnauthorizedError } from '../../../shared/errors';
import { AUTH_MESSAGES, HttpStatus } from '../../../shared/constants';
import { config } from '../../../../config';


const service = new AuthService();

function parseCookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }

  const cookiePair = header
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));

  if (!cookiePair) {
    return undefined;
  }

  return decodeURIComponent(cookiePair.split('=')[1] || '');
}

function getRefreshTokenFromRequest(req: Request): string | undefined {
  return parseCookieValue(req.headers.cookie, config.refreshTokenCookieName);
}

function getRefreshCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = config.cookieSameSite;

  return {
    httpOnly: true,
    // secure must be true when sameSite is 'none' (browser requirement)
    secure: isProd || sameSite === 'none',
    sameSite,
    path: '/api/v1/auth',
    maxAge: config.refreshTokenExpiresIn * 1000,
  };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(config.refreshTokenCookieName, refreshToken, getRefreshCookieOptions());
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(config.refreshTokenCookieName, {
    ...getRefreshCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

export class AuthController {
  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.parse(req.body);
      const metadata = {
        userAgent: req.headers['user-agent'] as string | undefined,
        ipAddress: req.ip,
      };
      const result = await service.register(parsed, metadata);
      setRefreshCookie(res, result.refreshToken);
      sendSuccess(
        res,
        {
          accessToken: result.accessToken,
          tokenType: result.tokenType,
          expiresIn: result.expiresIn,
          user: result.user,
        },
        AUTH_MESSAGES.REGISTER_SUCCESS,
        HttpStatus.CREATED,
      );
    } catch (err) {
      next(err);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.parse(req.body);
      const metadata = {
        userAgent: req.headers['user-agent'] as string | undefined,
        ipAddress: req.ip,
      };
      const result = await service.login(parsed, metadata);
      setRefreshCookie(res, result.refreshToken);
      sendSuccess(
        res,
        {
          accessToken: result.accessToken,
          tokenType: result.tokenType,
          expiresIn: result.expiresIn,
          user: result.user,
        },
        AUTH_MESSAGES.LOGIN_SUCCESS,
        HttpStatus.OK,
      );
    } catch (err) {
      next(err);
    }
  }

  public async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      if (!refreshToken) {
        throw new UnauthorizedError(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
      }

      const metadata = {
        userAgent: req.headers['user-agent'] as string | undefined,
        ipAddress: req.ip,
      };
      const result = await service.refreshToken(refreshToken, metadata);
      setRefreshCookie(res, result.refreshToken);
      sendSuccess(
        res,
        {
          accessToken: result.accessToken,
          tokenType: 'Bearer',
          expiresIn: result.expiresIn,
        },
        AUTH_MESSAGES.REFRESH_SUCCESS,
        HttpStatus.OK,
      );
    } catch (err) {
      next(err);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      await service.revokeRefreshToken(refreshToken || '');
      clearRefreshCookie(res);
      sendSuccess(res, null, AUTH_MESSAGES.LOGOUT_SUCCESS, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  }

  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError(AUTH_MESSAGES.UNAUTHORIZED);
      }
      const user = await service.getProfile(req.user.id);
      sendSuccess(res, user, AUTH_MESSAGES.PROFILE_SUCCESS, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  }
}

