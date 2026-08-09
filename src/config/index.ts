import dotenv from 'dotenv';
dotenv.config();
import { z } from 'zod';

export * from './swagger';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'staging', 'test']).default('development'),
  PORT: z
    .string()
    .optional()
    .transform((value) => (value ? parseInt(value, 10) : 4000))
    .refine((value) => Number.isInteger(value) && value > 0, {
      message: 'PORT must be a positive integer',
    }),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET is required and must be at least 32 characters long'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET is required and must be at least 32 characters long'),
  JWT_ISSUER: z.string().min(1, 'JWT_ISSUER is required'),
  JWT_AUDIENCE: z.string().min(1, 'JWT_AUDIENCE is required'),
  ACCESS_TOKEN_EXPIRES_IN: z
    .string()
    .optional()
    .transform((value) => (value ? parseInt(value, 10) : 15 * 60))
    .refine((value) => Number.isInteger(value) && value > 0, {
      message: 'ACCESS_TOKEN_EXPIRES_IN must be a positive integer',
    }),
  REFRESH_TOKEN_EXPIRES_IN: z
    .string()
    .optional()
    .transform((value) => (value ? parseInt(value, 10) : 30 * 24 * 60 * 60))
    .refine((value) => Number.isInteger(value) && value > 0, {
      message: 'REFRESH_TOKEN_EXPIRES_IN must be a positive integer',
    }),
  REFRESH_TOKEN_COOKIE_NAME: z
    .string()
    .optional()
    .transform((value) => (value ? value : 'refresh_token'))
    .refine((value) => value.length > 0, {
      message: 'REFRESH_TOKEN_COOKIE_NAME must be a non-empty string',
    }),
  SLOT_HOLD_DURATION_SECONDS: z
    .string()
    .optional()
    .transform((value) => (value ? parseInt(value, 10) : 60))
    .refine((value) => Number.isInteger(value) && value > 0, {
      message: 'SLOT_HOLD_DURATION_SECONDS must be a positive integer',
    }),
  CORS_ALLOWED_ORIGINS: z.string().optional().default(''),
  COOKIE_SAME_SITE: z
    .enum(['lax', 'none', 'strict'])
    .optional()
    .default('lax'),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error('Invalid environment configuration:');
  console.error(parsedEnv.error.format());
  throw new Error('Environment configuration invalid. See logs for details.');
}

const env = parsedEnv.data;

export const config = {
  appName: 'healthcare-appointment-backend',
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  jwtIssuer: env.JWT_ISSUER,
  jwtAudience: env.JWT_AUDIENCE,
  accessTokenExpiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
  refreshTokenExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
  refreshTokenCookieName: env.REFRESH_TOKEN_COOKIE_NAME,
  holdDurationSeconds: env.SLOT_HOLD_DURATION_SECONDS,
  cookieSameSite: env.COOKIE_SAME_SITE as 'lax' | 'none' | 'strict',
  corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS
    ? env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [],
};

