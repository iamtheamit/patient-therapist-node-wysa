import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = 'test-jwt-secret-abcdefghijklmnopqrstuvwxyz1234';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-abcdefghijklmnopqrstuvwxyz5678';
process.env.JWT_ISSUER = 'wysa-backend';
process.env.JWT_AUDIENCE = 'wysa-app';
process.env.ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '900';
process.env.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '2592000';

import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AuthService } from '../internal/services/auth.service';
import { authenticateToken } from '../internal/middleware/authMiddleware';
import { config } from '../config';
import { UnauthorizedError } from '../internal/shared/errors';
import { prisma } from '../internal/infrastructure/database/prismaClient';

const authService = new AuthService();

function createAccessToken(overrides: Partial<jwt.SignOptions & { payload?: Record<string, unknown> }> = {}) {
  const payload = { sub: 'test-user', email: 'test@example.com', role: 'PATIENT', tokenType: 'access', ...(overrides.payload || {}) };
  return jwt.sign(payload, config.jwtSecret, {
    algorithm: 'HS256',
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn: '1h',
    ...(overrides as jwt.SignOptions),
  });
}

function createRefreshToken(overrides: Partial<jwt.SignOptions & { payload?: Record<string, unknown> }> = {}) {
  const payload = { sub: 'test-user', tokenType: 'refresh', ...(overrides.payload || {}) };
  return jwt.sign(payload, config.jwtRefreshSecret, {
    algorithm: 'HS256',
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn: '1h',
    ...(overrides as jwt.SignOptions),
  });
}

function runAuthMiddleware(token: string) {
  const req = { headers: { authorization: `Bearer ${token}` } } as any;
  let middlewareError: unknown;

  authenticateToken(req, {} as any, (err?: unknown) => {
    middlewareError = err;
  });

  return { middlewareError, req };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertConfigFails(requiredKey: 'JWT_SECRET' | 'JWT_REFRESH_SECRET') {
  const originalEnv = { ...process.env };
  const configPath = require.resolve('../config');
  delete require.cache[configPath];

  try {
    process.env.NODE_ENV = 'production';
    delete process.env[requiredKey];
    try {
      require('../config');
      throw new Error(`Expected missing ${requiredKey} to fail config loading`);
    } catch (err) {
      assert(err instanceof Error, `Expected Error when ${requiredKey} is missing`);
    }
  } finally {
    Object.assign(process.env, originalEnv);
    delete require.cache[configPath];
  }
}

async function runJwtValidationTests() {
  console.log('STARTING JWT VALIDATION SECURITY TESTS');

  // Test 1: Valid access token
  const validAccessToken = createAccessToken();
  const validResult = runAuthMiddleware(validAccessToken);
  assert(!validResult.middlewareError, 'Valid access token should be accepted');
  assert(validResult.req.user?.id === 'test-user', 'Valid access token should populate req.user');

  console.log('PASS: Valid access token accepted');

  // Test 2: Expired access token
  const expiredToken = createAccessToken({ expiresIn: '1ms' });
  await new Promise((resolve) => setTimeout(resolve, 10));
  const expiredResult = runAuthMiddleware(expiredToken);
  assert(Boolean(expiredResult.middlewareError), 'Expired token should be rejected');

  console.log('PASS: Expired access token rejected');

  // Test 3: Wrong signature
  const wrongSignatureToken = jwt.sign(
    { sub: 'test-user', email: 'test@example.com', role: 'PATIENT', tokenType: 'access' },
    'incorrect-secret-00000000000000000000000000',
    {
      algorithm: 'HS256',
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: '1h',
    }
  );
  const wrongSignatureResult = runAuthMiddleware(wrongSignatureToken);
  assert(Boolean(wrongSignatureResult.middlewareError), 'Token signed with wrong secret should be rejected');

  console.log('PASS: Wrong-signature access token rejected');

  // Test 4: Wrong algorithm
  const wrongAlgToken = jwt.sign(
    { sub: 'test-user', email: 'test@example.com', role: 'PATIENT', tokenType: 'access' },
    config.jwtSecret,
    {
      algorithm: 'HS512',
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: '1h',
    }
  );
  const wrongAlgResult = runAuthMiddleware(wrongAlgToken);
  assert(Boolean(wrongAlgResult.middlewareError), 'Token signed with wrong algorithm should be rejected');

  console.log('PASS: Wrong-algorithm access token rejected');

  // Test 5: Wrong issuer
  const wrongIssuerToken = jwt.sign(
    { sub: 'test-user', email: 'test@example.com', role: 'PATIENT', tokenType: 'access' },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      issuer: 'wrong-issuer',
      audience: config.jwtAudience,
      expiresIn: '1h',
    }
  );
  const wrongIssuerResult = runAuthMiddleware(wrongIssuerToken);
  assert(Boolean(wrongIssuerResult.middlewareError), 'Token with wrong issuer should be rejected');

  console.log('PASS: Wrong-issuer access token rejected');

  // Test 6: Wrong audience
  const wrongAudienceToken = jwt.sign(
    { sub: 'test-user', email: 'test@example.com', role: 'PATIENT', tokenType: 'access' },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      issuer: config.jwtIssuer,
      audience: 'wrong-audience',
      expiresIn: '1h',
    }
  );
  const wrongAudienceResult = runAuthMiddleware(wrongAudienceToken);
  assert(Boolean(wrongAudienceResult.middlewareError), 'Token with wrong audience should be rejected');

  console.log('PASS: Wrong-audience access token rejected');

  // Test 7: Valid refresh token
  const registerResult = await authService.register({
    name: 'JWT Validation User',
    email: `jwt-validation-${Date.now()}@example.com`,
    password: 'Password123!',
  });

  const validRefreshToken = jwt.sign(
    { sub: registerResult.user.id, tokenType: 'refresh' },
    config.jwtRefreshSecret,
    {
      algorithm: 'HS256',
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: '1h',
    }
  );

  const refreshResult = await authService.refreshToken(validRefreshToken);
  assert(typeof refreshResult.accessToken === 'string' && refreshResult.accessToken.length > 0, 'Valid refresh token should return a new access token');

  console.log('PASS: Valid refresh token accepted');

  await prisma.user.deleteMany({ where: { id: registerResult.user.id } });

  // Test 8: Access token supplied to refresh endpoint
  try {
    await authService.refreshToken(validAccessToken);
    throw new Error('Access token should not be accepted by refresh endpoint');
  } catch (err) {
    assert(err instanceof UnauthorizedError, 'Access token to refresh endpoint should be rejected with UnauthorizedError');
  }

  console.log('PASS: Access token rejected by refresh endpoint');

  // Test 9: Refresh token signed using access-token secret
  const badRefreshToken = jwt.sign(
    { sub: 'test-user', tokenType: 'refresh' },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: '1h',
    }
  );
  try {
    await authService.refreshToken(badRefreshToken);
    throw new Error('Refresh token signed with access secret should be rejected');
  } catch (err) {
    assert(err instanceof UnauthorizedError, 'Refresh token signed with access secret should be rejected');
  }

  console.log('PASS: Refresh token signed with access-secret rejected');

  // Test 10: Access token signed using refresh-token secret
  const badAccessToken = jwt.sign(
    { sub: 'test-user', email: 'test@example.com', role: 'PATIENT', tokenType: 'access' },
    config.jwtRefreshSecret,
    {
      algorithm: 'HS256',
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: '1h',
    }
  );
  const badAccessResult = runAuthMiddleware(badAccessToken);
  assert(Boolean(badAccessResult.middlewareError), 'Access token signed with refresh secret should be rejected');

  console.log('PASS: Access token signed with refresh-secret rejected');

  // Test 11: Production configuration without JWT_SECRET
  await assertConfigFails('JWT_SECRET');
  console.log('PASS: production config without JWT_SECRET fails startup');

  // Test 12: Production configuration without JWT_REFRESH_SECRET
  await assertConfigFails('JWT_REFRESH_SECRET');
  console.log('PASS: production config without JWT_REFRESH_SECRET fails startup');

  console.log('ALL JWT VALIDATION SECURITY TESTS PASSED');
}

runJwtValidationTests().catch((err) => {
  console.error('JWT VALIDATION SECURITY TEST FAILURE:', err.message || err);
  process.exit(1);
});
