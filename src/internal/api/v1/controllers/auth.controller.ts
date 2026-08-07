import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../../services/auth.service';
import { registerSchema, loginSchema, refreshSchema } from '../../../validators/authValidator';
import { sendSuccess } from '../../../shared/responses';
import { UnauthorizedError } from '../../../shared/errors';

const service = new AuthService();

export class AuthController {
  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.parse(req.body);
      const result = await service.register(parsed);
      sendSuccess(res, result, 'User registered successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.parse(req.body);
      const result = await service.login(parsed);
      sendSuccess(res, result, 'User logged in successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = refreshSchema.parse(req.body);
      const result = await service.refreshToken(parsed.refreshToken);
      sendSuccess(res, result, 'Token refreshed successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    sendSuccess(res, null, 'Successfully logged out', 200);
  }

  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Unauthorized');
      }
      const user = await service.getProfile(req.user.id);
      sendSuccess(res, user, 'Profile retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}

