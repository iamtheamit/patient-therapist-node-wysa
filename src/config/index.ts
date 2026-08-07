export * from './swagger';

export const config = {
  appName: 'healthcare-appointment-backend',
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'changeme',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'changeme-refresh',
};
