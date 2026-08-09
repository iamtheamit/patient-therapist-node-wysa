import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../app';
import { prisma } from '../internal/infrastructure/database/prismaClient';
import { config } from '../config';
import { AppointmentStatus, BookingType, RecurrenceFrequency } from '@prisma/client';

const port = 4111;
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
      passwordHash: 'test-password-hash',
      role: role as any,
    },
  });
}

function signToken(user: TestUser): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role, tokenType: 'access' }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}

function request(
  method: string,
  path: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; response: any }> {
  return new Promise((resolve, reject) => {
    const requestBody = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (requestBody) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(requestBody).toString();
    }

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
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode || 0, response: parsed });
        });
      }
    );

    req.on('error', reject);
    if (requestBody) {
      req.write(requestBody);
    }
    req.end();
  });
}

async function runTests() {
  const server = app.listen(port);
  const testUsers: TestUser[] = [];
  const seriesIds: string[] = [];
  const appointmentIds: string[] = [];

  function hoursFromNow(hours: number): Date {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  try {
    const therapistA = await createUser(
      'THERAPIST',
      `series-own-therapist-a-${Date.now()}@example.com`,
      'Therapist A'
    );
    const therapistB = await createUser(
      'THERAPIST',
      `series-own-therapist-b-${Date.now()}@example.com`,
      'Therapist B'
    );
    const patientA = await createUser(
      'PATIENT',
      `series-own-patient-a-${Date.now()}@example.com`,
      'Patient A'
    );
    const patientB = await createUser(
      'PATIENT',
      `series-own-patient-b-${Date.now()}@example.com`,
      'Patient B'
    );
    testUsers.push(therapistA, therapistB, patientA, patientB);

    const therapistAToken = signToken(therapistA);
    const therapistBToken = signToken(therapistB);
    const patientAToken = signToken(patientA);
    const patientBToken = signToken(patientB);

    const seriesA = randomUUID();
    const seriesB = randomUUID();
    const seriesTherapistA = randomUUID();
    const seriesTherapistB = randomUUID();
    seriesIds.push(seriesA, seriesB, seriesTherapistA, seriesTherapistB);

    const appointmentA1 = await prisma.appointment.create({
      data: {
        patientId: patientA.id,
        therapistId: therapistA.id,
        bookingType: BookingType.RECURRING,
        seriesId: seriesA,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceEndDate: hoursFromNow(24 * 30),
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: 'SUCCESS',
        startTime: hoursFromNow(24),
        endTime: hoursFromNow(25),
      },
    });
    const appointmentA2 = await prisma.appointment.create({
      data: {
        patientId: patientA.id,
        therapistId: therapistA.id,
        bookingType: BookingType.RECURRING,
        seriesId: seriesA,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceEndDate: hoursFromNow(24 * 30),
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: 'SUCCESS',
        startTime: hoursFromNow(24 * 7),
        endTime: hoursFromNow(24 * 7 + 1),
      },
    });
    appointmentIds.push(appointmentA1.id, appointmentA2.id);

    const appointmentB1 = await prisma.appointment.create({
      data: {
        patientId: patientB.id,
        therapistId: therapistA.id,
        bookingType: BookingType.RECURRING,
        seriesId: seriesB,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceEndDate: hoursFromNow(24 * 30),
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: 'SUCCESS',
        startTime: hoursFromNow(48),
        endTime: hoursFromNow(49),
      },
    });
    const appointmentB2 = await prisma.appointment.create({
      data: {
        patientId: patientB.id,
        therapistId: therapistA.id,
        bookingType: BookingType.RECURRING,
        seriesId: seriesB,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceEndDate: hoursFromNow(24 * 30),
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: 'SUCCESS',
        startTime: hoursFromNow(24 * 8),
        endTime: hoursFromNow(24 * 8 + 1),
      },
    });
    appointmentIds.push(appointmentB1.id, appointmentB2.id);

    const appointmentTherapistA1 = await prisma.appointment.create({
      data: {
        patientId: patientB.id,
        therapistId: therapistA.id,
        bookingType: BookingType.RECURRING,
        seriesId: seriesTherapistA,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceEndDate: hoursFromNow(24 * 30),
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: 'SUCCESS',
        startTime: hoursFromNow(24 * 3),
        endTime: hoursFromNow(24 * 3 + 1),
      },
    });
    const appointmentTherapistA2 = await prisma.appointment.create({
      data: {
        patientId: patientA.id,
        therapistId: therapistA.id,
        bookingType: BookingType.RECURRING,
        seriesId: seriesTherapistA,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceEndDate: hoursFromNow(24 * 30),
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: 'SUCCESS',
        startTime: hoursFromNow(24 * 10),
        endTime: hoursFromNow(24 * 10 + 1),
      },
    });
    appointmentIds.push(appointmentTherapistA1.id, appointmentTherapistA2.id);

    const appointmentTherapistB1 = await prisma.appointment.create({
      data: {
        patientId: patientA.id,
        therapistId: therapistB.id,
        bookingType: BookingType.RECURRING,
        seriesId: seriesTherapistB,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceEndDate: hoursFromNow(24 * 30),
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: 'SUCCESS',
        startTime: hoursFromNow(24 * 4),
        endTime: hoursFromNow(24 * 4 + 1),
      },
    });
    const appointmentTherapistB2 = await prisma.appointment.create({
      data: {
        patientId: patientB.id,
        therapistId: therapistB.id,
        bookingType: BookingType.RECURRING,
        seriesId: seriesTherapistB,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceEndDate: hoursFromNow(24 * 30),
        appointmentStatus: AppointmentStatus.SCHEDULED,
        paymentStatus: 'SUCCESS',
        startTime: hoursFromNow(24 * 11),
        endTime: hoursFromNow(24 * 11 + 1),
      },
    });
    appointmentIds.push(appointmentTherapistB1.id, appointmentTherapistB2.id);

    console.log('TEST 1: Patient A cancels own recurring series');
    const cancelOwn = await request(
      'POST',
      `/api/v1/appointments/series/${seriesA}/cancel`,
      patientAToken
    );
    if (cancelOwn.status !== 200) {
      throw new Error(`Expected 200 but received ${cancelOwn.status}: ${JSON.stringify(cancelOwn.response)}`);
    }
    console.log('PASS: Patient A can cancel own series');

    console.log('TEST 2: Patient A cannot cancel Patient B series');
    const cancelOther = await request(
      'POST',
      `/api/v1/appointments/series/${seriesB}/cancel`,
      patientAToken
    );
    if (cancelOther.status !== 404) {
      throw new Error(`Expected 404 but received ${cancelOther.status}: ${JSON.stringify(cancelOther.response)}`);
    }
    console.log('PASS: Patient A cannot cancel Patient B series');

    console.log('TEST 3: Patient A attempts cancel with Patient B patientId in body');
    const cancelOtherWithBody = await request(
      'POST',
      `/api/v1/appointments/series/${seriesB}/cancel`,
      patientAToken,
      { patientId: patientB.id }
    );
    if (cancelOtherWithBody.status !== 404) {
      throw new Error(`Expected 404 but received ${cancelOtherWithBody.status}: ${JSON.stringify(cancelOtherWithBody.response)}`);
    }
    console.log('PASS: Patient A cannot bypass ownership using body patientId');

    console.log('TEST 4: Patient A cannot confirm Patient B recurring series');
    const confirmOther = await request(
      'POST',
      `/api/v1/appointments/series/${seriesB}/pay`,
      patientAToken,
      { notes: 'Please confirm' }
    );
    if (confirmOther.status !== 404) {
      throw new Error(`Expected 404 but received ${confirmOther.status}: ${JSON.stringify(confirmOther.response)}`);
    }
    console.log('PASS: Patient A cannot confirm Patient B series');

    console.log('TEST 5: Therapist A cancels own authorized series');
    const therapistCancelOwn = await request(
      'POST',
      `/api/v1/appointments/series/${seriesTherapistA}/cancel`,
      therapistAToken
    );
    if (therapistCancelOwn.status !== 200) {
      throw new Error(`Expected 200 but received ${therapistCancelOwn.status}: ${JSON.stringify(therapistCancelOwn.response)}`);
    }
    console.log('PASS: Therapist A can cancel series assigned to Therapist A');

    console.log('TEST 6: Therapist A cannot cancel Therapist B series');
    const therapistCancelOther = await request(
      'POST',
      `/api/v1/appointments/series/${seriesTherapistB}/cancel`,
      therapistAToken
    );
    if (therapistCancelOther.status !== 404) {
      throw new Error(`Expected 404 but received ${therapistCancelOther.status}: ${JSON.stringify(therapistCancelOther.response)}`);
    }
    console.log('PASS: Therapist A cannot cancel series assigned to Therapist B');

    console.log('TEST 7: Unauthenticated user is rejected');
    const unauthenticated = await request(
      'POST',
      `/api/v1/appointments/series/${seriesA}/cancel`
    );
    if (unauthenticated.status !== 401) {
      throw new Error(`Expected 401 but received ${unauthenticated.status}: ${JSON.stringify(unauthenticated.response)}`);
    }
    console.log('PASS: Unauthenticated request receives 401');

    console.log('TEST 8: Invalid/non-existent seriesId returns not found');
    const invalidSeries = await request(
      'POST',
      `/api/v1/appointments/series/${randomUUID()}/cancel`,
      patientAToken
    );
    if (invalidSeries.status !== 404) {
      throw new Error(`Expected 404 but received ${invalidSeries.status}: ${JSON.stringify(invalidSeries.response)}`);
    }
    console.log('PASS: Invalid seriesId returns 404');

    console.log('ALL RECURRING SERIES OWNERSHIP TESTS PASSED');
  } finally {
    server.close();
    await prisma.appointment.deleteMany({
      where: {
        id: { in: appointmentIds },
      },
    });
    await prisma.appointment.deleteMany({
      where: {
        seriesId: { in: seriesIds },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: testUsers.map((user) => user.email),
        },
      },
    });
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('APPOINTMENT SERIES OWNERSHIP TEST FAILURE:', err.message || err);
  process.exit(1);
});
