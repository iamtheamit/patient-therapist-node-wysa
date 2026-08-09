import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import jwt from 'jsonwebtoken';
import { AppointmentStatus, BookingType, RecurrenceFrequency, PaymentStatus } from '@prisma/client';
import app from '../app';
import { prisma } from '../internal/infrastructure/database/prismaClient';
import { config } from '../config';

const port = 4118;
const baseUrl = `http://127.0.0.1:${port}`;

interface TestUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

async function createUser(role: string, email: string, name: string): Promise<TestUser> {
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash: 'test-hash',
      role: role as any,
    },
  });
}

function signToken(user: TestUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, tokenType: 'access' },
    config.jwtSecret,
    {
      expiresIn: '1h',
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    }
  );
}

function request(
  method: string,
  path: string,
  token?: string
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      `${baseUrl}${path}`,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function runTests() {
  console.log('\n==================================================');
  console.log('STARTING REAL THERAPIST STATISTICS ENDPOINT TESTS');
  console.log('==================================================\n');

  const server = app.listen(port);
  await new Promise((r) => setTimeout(r, 300));

  try {
    // Setup test users
    const therapistA = await createUser('THERAPIST', `therapist_stat_a_${Date.now()}@example.com`, 'Therapist A');
    const therapistB = await createUser('THERAPIST', `therapist_stat_b_${Date.now()}@example.com`, 'Therapist B');
    const patient1 = await createUser('PATIENT', `patient_stat_1_${Date.now()}@example.com`, 'Patient 1');
    const patient2 = await createUser('PATIENT', `patient_stat_2_${Date.now()}@example.com`, 'Patient 2');

    const tokenA = signToken(therapistA);
    const tokenB = signToken(therapistB);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 50, 0);

    // TEST 2: Therapist with no appointments today -> todaySessionsCount = 0
    console.log('TEST 2: Therapist with no appointments today...');
    const res2 = await request('GET', `/api/v1/therapists/${therapistA.id}/stats`, tokenA);
    if (
      res2.status === 200 &&
      res2.body.data.todaySessionsCount === 0 &&
      res2.body.data.pendingConfirmationsCount === 0 &&
      res2.body.data.activePatientsCount === 0
    ) {
      console.log('PASS: Correct zero counts for fresh therapist.\n');
    } else {
      throw new Error(`FAIL: Unexpected initial stats: ${JSON.stringify(res2.body)}`);
    }

    // TEST 1: Therapist with appointments today -> todaySessionsCount reflects real records
    console.log('TEST 1: Therapist with appointments today...');
    await prisma.appointment.create({
      data: {
        patientId: patient1.id,
        therapistId: therapistA.id,
        startTime: todayStart,
        endTime: todayEnd,
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    const res1 = await request('GET', `/api/v1/therapists/${therapistA.id}/stats`, tokenA);
    if (
      res1.status === 200 &&
      res1.body.data.todaySessionsCount === 1 &&
      res1.body.data.activePatientsCount === 1
    ) {
      console.log('PASS: todaySessionsCount reflects real DB record (1 session, 1 patient).\n');
    } else {
      throw new Error(`FAIL: Test 1 failed: ${JSON.stringify(res1.body)}`);
    }

    // TEST 3: Appointments belonging to another therapist -> NOT counted for Therapist A
    console.log('TEST 3: Appointments belonging to another therapist...');
    await prisma.appointment.create({
      data: {
        patientId: patient2.id,
        therapistId: therapistB.id,
        startTime: todayStart,
        endTime: todayEnd,
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    const res3A = await request('GET', `/api/v1/therapists/${therapistA.id}/stats`, tokenA);
    const res3B = await request('GET', `/api/v1/therapists/${therapistB.id}/stats`, tokenB);

    if (res3A.body.data.todaySessionsCount === 1 && res3B.body.data.todaySessionsCount === 1) {
      console.log('PASS: Appointments belonging to Therapist B do not leak into Therapist A stats.\n');
    } else {
      throw new Error(`FAIL: Test 3 failed: A=${JSON.stringify(res3A.body)} B=${JSON.stringify(res3B.body)}`);
    }

    // TEST 4: Cancelled appointment -> NOT counted in todaySessionsCount
    console.log('TEST 4: Cancelled appointment exclusion...');
    await prisma.appointment.create({
      data: {
        patientId: patient2.id,
        therapistId: therapistA.id,
        startTime: todayStart,
        endTime: todayEnd,
        appointmentStatus: AppointmentStatus.CANCELLED,
        paymentStatus: PaymentStatus.FAILED,
      },
    });

    const res4 = await request('GET', `/api/v1/therapists/${therapistA.id}/stats`, tokenA);
    if (res4.body.data.todaySessionsCount === 1) {
      console.log('PASS: Cancelled appointments are excluded from todaySessionsCount.\n');
    } else {
      throw new Error(`FAIL: Test 4 failed: ${JSON.stringify(res4.body)}`);
    }

    // TEST 5: Expired HOLD -> NOT counted in pendingConfirmationsCount
    console.log('TEST 5: Active vs Expired HOLD handling...');
    // Create an active HOLD
    await prisma.appointment.create({
      data: {
        patientId: patient1.id,
        therapistId: therapistA.id,
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 7200000),
        appointmentStatus: AppointmentStatus.HOLD,
        holdExpiresAt: new Date(Date.now() + 60000), // active hold
      },
    });

    // Create an expired HOLD
    await prisma.appointment.create({
      data: {
        patientId: patient2.id,
        therapistId: therapistA.id,
        startTime: new Date(Date.now() + 10800000),
        endTime: new Date(Date.now() + 14400000),
        appointmentStatus: AppointmentStatus.HOLD,
        holdExpiresAt: new Date(Date.now() - 60000), // expired hold
      },
    });

    const res5 = await request('GET', `/api/v1/therapists/${therapistA.id}/stats`, tokenA);
    if (res5.body.data.pendingConfirmationsCount === 1) {
      console.log('PASS: Only active unexpired HOLDs are counted in pendingConfirmationsCount.\n');
    } else {
      throw new Error(`FAIL: Test 5 failed: ${JSON.stringify(res5.body)}`);
    }

    // TEST 6: Multiple appointments with the same patient -> activePatientsCount uses DISTINCT behavior
    console.log('TEST 6: Distinct patient count verification...');
    // Add a second SCHEDULED appointment for patient1 with therapistA
    await prisma.appointment.create({
      data: {
        patientId: patient1.id,
        therapistId: therapistA.id,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: PaymentStatus.SUCCESS,
      },
    });

    const res6 = await request('GET', `/api/v1/therapists/${therapistA.id}/stats`, tokenA);
    if (res6.body.data.activePatientsCount === 1) {
      console.log('PASS: Multiple appointments for Patient 1 counted as 1 distinct active patient.\n');
    } else {
      throw new Error(`FAIL: Test 6 failed: ${JSON.stringify(res6.body)}`);
    }

    // TEST 7: Therapist A requests Therapist B's statistics -> Authorization failure (403)
    console.log('TEST 7: Ownership authorization guard...');
    const res7 = await request('GET', `/api/v1/therapists/${therapistB.id}/stats`, tokenA);
    if (res7.status === 403) {
      console.log('PASS: Therapist A access to Therapist B stats rejected with 403 Forbidden.\n');
    } else {
      throw new Error(`FAIL: Test 7 failed: expected status 403, got ${res7.status}`);
    }

    // TEST 8: Unauthenticated request -> Rejected (401)
    console.log('TEST 8: Unauthenticated request guard...');
    const res8 = await request('GET', `/api/v1/therapists/${therapistA.id}/stats`);
    if (res8.status === 401) {
      console.log('PASS: Unauthenticated stats request rejected with 401 Unauthorized.\n');
    } else {
      throw new Error(`FAIL: Test 8 failed: expected status 401, got ${res8.status}`);
    }

    console.log('==================================================');
    console.log('ALL 8 THERAPIST STATISTICS TESTS PASSED!');
    console.log('==================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
