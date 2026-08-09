import express from 'express';
import http from 'http';
import cors from 'cors';
import { getCorsOptions } from '../internal/bootstrap/middlewarePipeline';

function createTestServer(
  isProd: boolean,
  configuredOrigins: string[]
): Promise<{ server: http.Server; port: number }> {
  const app = express();
  app.use(cors(getCorsOptions(isProd, configuredOrigins)));
  app.use(express.json());

  app.get('/api/v1/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/api/v1/appointments', (_req, res) => {
    res.status(201).json({ status: 'created' });
  });

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      resolve({ server, port: address.port });
    });
  });
}

function sendRequest(
  port: number,
  method: string,
  path: string,
  headers: Record<string, string>
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:${port}${path}`,
      { method, headers },
      (res) => {
        resolve({ statusCode: res.statusCode || 0, headers: res.headers });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runCorsTests() {
  console.log('\n==================================================');
  console.log('STARTING SECURE CORS SECURITY TESTS');
  console.log('==================================================\n');

  let prodServerObj: { server: http.Server; port: number } | null = null;
  let devServerObj: { server: http.Server; port: number } | null = null;

  try {
    prodServerObj = await createTestServer(true, ['https://app.example.com', 'https://admin.example.com']);
    devServerObj = await createTestServer(false, []);

    // TEST 1: Allowed production origin
    console.log('TEST 1: Allowed production origin...');
    const res1 = await sendRequest(prodServerObj.port, 'GET', '/api/v1/health', {
      Origin: 'https://app.example.com',
    });
    if (res1.headers['access-control-allow-origin'] !== 'https://app.example.com') {
      throw new Error(
        `Expected Access-Control-Allow-Origin: https://app.example.com, got: ${res1.headers['access-control-allow-origin']}`
      );
    }
    console.log('PASS: Production origin https://app.example.com accepted.\n');

    // TEST 2: Unknown origin
    console.log('TEST 2: Unknown origin in production...');
    const res2 = await sendRequest(prodServerObj.port, 'GET', '/api/v1/health', {
      Origin: 'https://attacker.com',
    });
    if (res2.headers['access-control-allow-origin'] === 'https://attacker.com') {
      throw new Error('Expected unknown origin https://attacker.com to be rejected, but it was allowed!');
    }
    console.log('PASS: Unknown origin https://attacker.com rejected.\n');

    // TEST 3: Allowed development origin
    console.log('TEST 3: Allowed development origin...');
    const devOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4200'];
    for (const devOrigin of devOrigins) {
      const res3 = await sendRequest(devServerObj.port, 'GET', '/api/v1/health', {
        Origin: devOrigin,
      });
      if (res3.headers['access-control-allow-origin'] !== devOrigin) {
        throw new Error(
          `Expected Access-Control-Allow-Origin: ${devOrigin} in dev mode, got: ${res3.headers['access-control-allow-origin']}`
        );
      }
    }
    console.log('PASS: Development origins (localhost:5173, 3000, 4200) allowed in dev environment.\n');

    // TEST 4: Wildcard origin in production
    console.log('TEST 4: Wildcard origin in production...');
    const res4 = await sendRequest(prodServerObj.port, 'GET', '/api/v1/health', {
      Origin: 'https://random-untrusted-site.com',
    });
    if (res4.headers['access-control-allow-origin'] === '*') {
      throw new Error('Security Violation: Production server returned wildcard Access-Control-Allow-Origin: *');
    }
    console.log('PASS: Wildcard origin * is not allowed in production.\n');

    // TEST 5: OPTIONS preflight
    console.log('TEST 5: OPTIONS preflight request...');
    const res5 = await sendRequest(prodServerObj.port, 'OPTIONS', '/api/v1/appointments', {
      Origin: 'https://app.example.com',
      'Access-Control-Request-Method': 'POST',
    });
    if (res5.statusCode !== 204 && res5.statusCode !== 200) {
      throw new Error(`Expected OPTIONS preflight status 204 or 200, got: ${res5.statusCode}`);
    }
    if (res5.headers['access-control-allow-origin'] !== 'https://app.example.com') {
      throw new Error(
        `Expected Access-Control-Allow-Origin: https://app.example.com on preflight, got: ${res5.headers['access-control-allow-origin']}`
      );
    }
    const allowedMethods = String(res5.headers['access-control-allow-methods'] || '');
    if (!allowedMethods.includes('POST')) {
      throw new Error(`Expected Access-Control-Allow-Methods to include POST, got: ${allowedMethods}`);
    }
    console.log('PASS: OPTIONS preflight succeeds with appropriate headers.\n');

    // TEST 6: Authorization header
    console.log('TEST 6: Authorization header in preflight...');
    const res6 = await sendRequest(prodServerObj.port, 'OPTIONS', '/api/v1/appointments', {
      Origin: 'https://app.example.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Authorization',
    });
    const allowedHeaders6 = String(res6.headers['access-control-allow-headers'] || '').toLowerCase();
    if (!allowedHeaders6.includes('authorization')) {
      throw new Error(`Expected Access-Control-Allow-Headers to include Authorization, got: ${allowedHeaders6}`);
    }
    console.log('PASS: Authorization header allowed in CORS preflight.\n');

    // TEST 7: Idempotency-Key header
    console.log('TEST 7: Idempotency-Key header in preflight...');
    const res7 = await sendRequest(prodServerObj.port, 'OPTIONS', '/api/v1/appointments', {
      Origin: 'https://app.example.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Idempotency-Key',
    });
    const allowedHeaders7 = String(res7.headers['access-control-allow-headers'] || '').toLowerCase();
    if (!allowedHeaders7.includes('idempotency-key')) {
      throw new Error(`Expected Access-Control-Allow-Headers to include Idempotency-Key, got: ${allowedHeaders7}`);
    }
    console.log('PASS: Idempotency-Key header allowed in CORS preflight.\n');

    console.log('==================================================');
    console.log('ALL SECURE CORS TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
  } finally {
    if (prodServerObj) {
      prodServerObj.server.close();
    }
    if (devServerObj) {
      devServerObj.server.close();
    }
  }
}

runCorsTests().catch((err) => {
  console.error('\n❌ CORS SECURITY TEST FAILURE:', err.message || err);
  process.exit(1);
});
