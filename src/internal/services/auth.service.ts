import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/userRepository';
import { RegisterSchema, LoginSchema } from '../validators/authValidator';
import { ConflictError, UnauthorizedError, NotFoundError } from '../shared/errors';

const userRepo = new UserRepository();

const ACCESS_TOKEN_EXPIRES_IN = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 60 * 60; // 30 days in seconds

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export class AuthService {
  public async register(payload: RegisterSchema): Promise<AuthTokens> {
    const existing = await userRepo.findByEmail(payload.email);
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(payload.password, saltRounds);

    const user = await userRepo.create({
      name: payload.name,
      email: payload.email,
      passwordHash,
      role: payload.role,
    });

    return this.generateTokens(user);
  }

  public async login({ email, password }: LoginSchema): Promise<AuthTokens> {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedError('Invalid email or password');
    }

    return this.generateTokens(user);
  }

  public async refreshToken(token: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET || 'changeme-refresh';
      const decoded = jwt.verify(token, refreshSecret) as { sub: string };

      const user = await userRepo.findById(decoded.sub);
      if (!user) {
        throw new UnauthorizedError('User no longer exists');
      }

      const accessSecret = process.env.JWT_SECRET || 'changeme';
      const accessToken = jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        accessSecret,
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
      );

      return {
        accessToken,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      };
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  public async getProfile(userId: string) {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private generateTokens(user: { id: string; email: string; name: string; role: string }): AuthTokens {
    const jwtSecret = process.env.JWT_SECRET || 'changeme';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'changeme-refresh';

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { sub: user.id },
      refreshSecret,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
