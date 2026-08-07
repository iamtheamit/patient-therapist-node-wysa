import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../../services/auth.service';
import { registerSchema, loginSchema, refreshSchema } from '../../../validators/authValidator';

const service = new AuthService();

export class AuthController {
  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.parse(req.body);
      const result = await service.register(parsed);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.parse(req.body);
      const result = await service.login(parsed);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = refreshSchema.parse(req.body);
      const result = await service.refreshToken(parsed.refreshToken);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    res.status(200).json({ message: 'Successfully logged out' });
  }

  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const user = await service.getProfile(req.user.id);
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  }
}
