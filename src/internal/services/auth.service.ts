import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/userRepository';
import { RegisterSchema, LoginSchema } from '../validators/authValidator';
import { ConflictError, UnauthorizedError, NotFoundError } from '../shared/errors';
import { AUTH_MESSAGES } from '../shared/constants';
import { config } from '../../config';

const userRepo = new UserRepository();

const getAccessTokenExpiresIn = (): number => config.accessTokenExpiresIn;
const getRefreshTokenExpiresIn = (): number => config.refreshTokenExpiresIn;


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
      throw new ConflictError(AUTH_MESSAGES.EMAIL_EXISTS);
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
      throw new UnauthorizedError(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedError(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    return this.generateTokens(user);
  }

  public async refreshToken(token: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const refreshSecret = config.jwtRefreshSecret;
      const decoded = jwt.verify(token, refreshSecret) as { sub: string };

      const user = await userRepo.findById(decoded.sub);
      if (!user) {
        throw new UnauthorizedError(AUTH_MESSAGES.USER_NOT_EXISTS);
      }

      const accessSecret = config.jwtSecret;
      const expiresIn = getAccessTokenExpiresIn();
      const accessToken = jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        accessSecret,
        { expiresIn }
      );

      return {
        accessToken,
        expiresIn,
      };
    } catch (err) {
      throw new UnauthorizedError(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    }
  }

  public async getProfile(userId: string) {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError(AUTH_MESSAGES.USER_NOT_FOUND);
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
    const jwtSecret = config.jwtSecret;
    const refreshSecret = config.jwtRefreshSecret;
    const accessTokenExpiresIn = getAccessTokenExpiresIn();
    const refreshTokenExpiresIn = getRefreshTokenExpiresIn();

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: accessTokenExpiresIn }
    );

    const refreshToken = jwt.sign(
      { sub: user.id },
      refreshSecret,
      { expiresIn: refreshTokenExpiresIn }
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessTokenExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
