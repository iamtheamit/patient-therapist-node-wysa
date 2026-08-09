export * from './swagger';

export const config = {
  appName: 'healthcare-appointment-backend',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  jwtSecret: process.env.JWT_SECRET || 'changeme',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'changeme-refresh',
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN
    ? parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN, 10)
    : 15 * 60, // Default 15 minutes (900 seconds)
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN
    ? parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN, 10)
    : 30 * 24 * 60 * 60, // Default 30 days (2592000 seconds)
  holdDurationSeconds: process.env.SLOT_HOLD_DURATION_SECONDS
    ? parseInt(process.env.SLOT_HOLD_DURATION_SECONDS, 10)
    : 60, // Default 1 minute (60 seconds)
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [],
};

