import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { UserRepository } from '../repositories/userRepository';
import { RegisterSchema, LoginSchema } from '../validators/authValidator';
import { ConflictError, UnauthorizedError, NotFoundError } from '../shared/errors';
import { AUTH_MESSAGES } from '../shared/constants';
import { config } from '../../config';
import { prisma } from '../infrastructure/database/prismaClient';

const userRepo = new UserRepository();
const refreshTokenByteLength = 64;
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

export interface RefreshSessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export class AuthService {
  public async register(payload: RegisterSchema, metadata?: RefreshSessionMetadata): Promise<AuthTokens> {
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
      role: Role.PATIENT,
    });

    return this.generateTokens(user, metadata);
  }

  public async login({ email, password }: LoginSchema, metadata?: RefreshSessionMetadata): Promise<AuthTokens> {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedError(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    return this.generateTokens(user, metadata);
  }

  public async refreshToken(token: string, metadata?: RefreshSessionMetadata): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const tokenHash = this.hashToken(token);
    const now = new Date();

    try {
      return await prisma.$transaction(async (tx) => {
        const existingSession = await tx.refreshSession.findUnique({ where: { tokenHash } });
        if (!existingSession || existingSession.revokedAt || existingSession.expiresAt <= now) {
          throw new Error('Invalid refresh token');
        }

        const updatedCount = await tx.refreshSession.updateMany({
          where: {
            id: existingSession.id,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: {
            revokedAt: now,
          },
        });

        if (updatedCount.count !== 1) {
          throw new Error('Invalid refresh token');
        }

        const user = await tx.user.findUnique({ where: { id: existingSession.userId } });
        if (!user) {
          throw new UnauthorizedError(AUTH_MESSAGES.USER_NOT_EXISTS);
        }

        const newRefreshToken = this.createRefreshToken();
        const newRefreshTokenHash = this.hashToken(newRefreshToken);

        await tx.refreshSession.create({
          data: {
            userId: user.id,
            tokenHash: newRefreshTokenHash,
            expiresAt: new Date(Date.now() + getRefreshTokenExpiresIn() * 1000),
            userAgent: metadata?.userAgent,
            ipAddress: metadata?.ipAddress,
          },
        });

        const accessToken = jwt.sign(
          { sub: user.id, email: user.email, role: user.role, tokenType: 'access' },
          config.jwtSecret,
          {
            algorithm: 'HS256',
            expiresIn: getAccessTokenExpiresIn(),
            issuer: config.jwtIssuer,
            audience: config.jwtAudience,
          }
        );

        return {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: getAccessTokenExpiresIn(),
        };
      });
    } catch (err) {
      throw new UnauthorizedError(AUTH_MESSAGES.INVALID_REFRESH_TOKEN);
    }
  }

  public async revokeRefreshToken(token: string): Promise<void> {
    if (!token) {
      return;
    }

    const tokenHash = this.hashToken(token);
    await prisma.refreshSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
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

  private createRefreshToken(): string {
    return crypto.randomBytes(refreshTokenByteLength).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private async createRefreshSession(userId: string, refreshToken: string, metadata?: RefreshSessionMetadata): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + getRefreshTokenExpiresIn() * 1000),
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
      },
    });
  }

  private async generateTokens(
    user: { id: string; email: string; name: string; role: string },
    metadata?: RefreshSessionMetadata,
  ): Promise<AuthTokens> {
    const accessTokenExpiresIn = getAccessTokenExpiresIn();
    const refreshToken = this.createRefreshToken();

    await this.createRefreshSession(user.id, refreshToken, metadata);

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, tokenType: 'access' },
      config.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: accessTokenExpiresIn,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      }
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
