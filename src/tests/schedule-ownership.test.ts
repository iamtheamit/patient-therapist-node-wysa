import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../app';
import { prisma } from '../internal/infrastructure/database/prismaClient';
import { config } from '../config';

const port = 4110;
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
      'Accept': 'application/json',
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
  const appointmentIds: string[] = [];

  try {
    const therapistAEmail = `schedule-test-therapist-a-${Date.now()}@example.com`;
    const therapistBEmail = `schedule-test-therapist-b-${Date.now()}@example.com`;
    const patientEmail = `schedule-test-patient-${Date.now()}@example.com`;

    const therapistA = await createUser('THERAPIST', therapistAEmail, 'Therapist A');
    const therapistB = await createUser('THERAPIST', therapistBEmail, 'Therapist B');
    const patient = await createUser('PATIENT', patientEmail, 'Patient');
    testUsers.push(therapistA, therapistB, patient);

    const therapistAToken = signToken(therapistA);
    const therapistBToken = signToken(therapistB);
    const patientToken = signToken(patient);

    const scheduleConfigPayload = {
      schedules: [
        {
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '12:00',
          slotDuration: 50,
          bufferDuration: 10,
          isActive: true,
        },
      ],
    };

    console.log('TEST 1: Therapist A accesses Therapist A schedule config');
    const getOwnSchedule = await request(
      'GET',
      `/api/v1/therapist/schedules/${therapistA.id}/schedule-config`,
      therapistAToken
    );
    if (getOwnSchedule.status !== 200) {
      throw new Error(`Expected 200 but received ${getOwnSchedule.status}: ${JSON.stringify(getOwnSchedule.response)}`);
    }
    console.log('PASS: Therapist A can access own schedule config');

    console.log('TEST 2: Therapist A modifies Therapist A schedule config');
    const updateOwnSchedule = await request(
      'PUT',
      `/api/v1/therapist/schedules/${therapistA.id}/schedule-config`,
      therapistAToken,
      scheduleConfigPayload
    );
    if (updateOwnSchedule.status !== 200) {
      throw new Error(`Expected 200 but received ${updateOwnSchedule.status}: ${JSON.stringify(updateOwnSchedule.response)}`);
    }
    if (!Array.isArray(updateOwnSchedule.response.data) || updateOwnSchedule.response.data.length !== 1) {
      throw new Error(`Expected schedule array of length 1 but received ${JSON.stringify(updateOwnSchedule.response.data)}`);
    }
    console.log('PASS: Therapist A successfully updated own schedule config');

    console.log('TEST 3: Therapist A attempts to modify Therapist B schedule config');
    const updateBByA = await request(
      'PUT',
      `/api/v1/therapist/schedules/${therapistB.id}/schedule-config`,
      therapistAToken,
      scheduleConfigPayload
    );
    if (updateBByA.status !== 403) {
      throw new Error(`Expected 403 but received ${updateBByA.status}: ${JSON.stringify(updateBByA.response)}`);
    }
    console.log('PASS: Therapist A cannot modify Therapist B schedule config');

    console.log('TEST 4: Therapist A attempts to delete Therapist B schedule config');
    const deleteBByA = await request(
      'PUT',
      `/api/v1/therapist/schedules/${therapistB.id}/schedule-config`,
      therapistAToken,
      { schedules: [] }
    );
    if (deleteBByA.status !== 403) {
      throw new Error(`Expected 403 but received ${deleteBByA.status}: ${JSON.stringify(deleteBByA.response)}`);
    }
    console.log('PASS: Therapist A cannot delete Therapist B schedule config');

    console.log('TEST 5: Patient attempts to modify Therapist A schedule config');
    const patientUpdateAttempt = await request(
      'PUT',
      `/api/v1/therapist/schedules/${therapistA.id}/schedule-config`,
      patientToken,
      scheduleConfigPayload
    );
    if (patientUpdateAttempt.status !== 403) {
      throw new Error(`Expected 403 but received ${patientUpdateAttempt.status}: ${JSON.stringify(patientUpdateAttempt.response)}`);
    }
    console.log('PASS: Patient cannot modify therapist schedule config');

    console.log('TEST 6: Unauthenticated user attempts schedule config modification');
    const unauthenticatedAttempt = await request(
      'PUT',
      `/api/v1/therapist/schedules/${therapistA.id}/schedule-config`,
      undefined,
      scheduleConfigPayload
    );
    if (unauthenticatedAttempt.status !== 401) {
      throw new Error(`Expected 401 but received ${unauthenticatedAttempt.status}: ${JSON.stringify(unauthenticatedAttempt.response)}`);
    }
    console.log('PASS: Unauthenticated request is rejected with 401');

    // Therapist agenda authorization security tests
    const appointmentA = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        therapistId: therapistA.id,
        bookingType: 'ONE_TIME',
        appointmentStatus: 'SCHEDULED',
        paymentStatus: 'SUCCESS',
        startTime: new Date(Date.now() + 1000 * 60 * 60),
        endTime: new Date(Date.now() + 1000 * 60 * 60 * 2),
      },
    });
    const appointmentB = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        therapistId: therapistB.id,
        bookingType: 'ONE_TIME',
        appointmentStatus: 'SCHEDULED',
        paymentStatus: 'SUCCESS',
        startTime: new Date(Date.now() + 1000 * 60 * 60 * 3),
        endTime: new Date(Date.now() + 1000 * 60 * 60 * 4),
      },
    });
    appointmentIds.push(appointmentA.id, appointmentB.id);

    console.log('TEST 7: Therapist A accesses own agenda');
    const ownAgenda = await request(
      'GET',
      `/api/v1/therapist/schedules/${therapistA.id}/agenda`,
      therapistAToken
    );
    if (ownAgenda.status !== 200) {
      throw new Error(`Expected 200 but received ${ownAgenda.status}: ${JSON.stringify(ownAgenda.response)}`);
    }
    const ownAgendaData = ownAgenda.response.data as any[];
    if (!Array.isArray(ownAgendaData) || ownAgendaData.length === 0) {
      throw new Error(`Expected therapist agenda items but received ${JSON.stringify(ownAgenda.response)}`);
    }
    if (ownAgendaData.some((item) => item.therapistId !== therapistA.id)) {
      throw new Error(`Expected only Therapist A appointments but received ${JSON.stringify(ownAgendaData)}`);
    }
    if (ownAgendaData.some((item) => !item.patient || !item.patient.id || !item.patient.name || !item.patient.email)) {
      throw new Error(`Expected patient summary only but received ${JSON.stringify(ownAgendaData)}`);
    }
    if (ownAgendaData.some((item) => item.patient.passwordHash !== undefined || item.patient.role !== undefined)) {
      throw new Error('Unexpected patient private fields were returned in agenda response');
    }
    console.log('PASS: Therapist A can access own agenda with minimal patient data');

    console.log('TEST 8: Therapist A attempts Therapist B agenda');
    const crossAgenda = await request(
      'GET',
      `/api/v1/therapist/schedules/${therapistB.id}/agenda`,
      therapistAToken
    );
    if (crossAgenda.status !== 403) {
      throw new Error(`Expected 403 but received ${crossAgenda.status}: ${JSON.stringify(crossAgenda.response)}`);
    }
    if (crossAgenda.response.data !== null) {
      throw new Error('Expected no agenda data on unauthorized request');
    }
    console.log('PASS: Therapist A cannot access Therapist B agenda');

    console.log('TEST 9: Patient attempts Therapist A agenda access');
    const patientAgendaAttempt = await request(
      'GET',
      `/api/v1/therapist/schedules/${therapistA.id}/agenda`,
      patientToken
    );
    if (patientAgendaAttempt.status !== 403) {
      throw new Error(`Expected 403 but received ${patientAgendaAttempt.status}: ${JSON.stringify(patientAgendaAttempt.response)}`);
    }
    console.log('PASS: Patient cannot access therapist agenda');

    console.log('TEST 10: Unauthenticated user requests therapist agenda');
    const unauthenticatedAgenda = await request(
      'GET',
      `/api/v1/therapist/schedules/${therapistA.id}/agenda`
    );
    if (unauthenticatedAgenda.status !== 401) {
      throw new Error(`Expected 401 but received ${unauthenticatedAgenda.status}: ${JSON.stringify(unauthenticatedAgenda.response)}`);
    }
    console.log('PASS: Unauthenticated request to agenda is rejected with 401');

    console.log('TEST 11: Therapist A attempts query bypass to Therapist B agenda');
    const queryBypass = await request(
      'GET',
      `/api/v1/appointments/therapist?therapistId=${therapistB.id}`,
      therapistAToken
    );
    if (queryBypass.status !== 403) {
      throw new Error(`Expected 403 but received ${queryBypass.status}: ${JSON.stringify(queryBypass.response)}`);
    }
    console.log('PASS: Query parameter cannot bypass therapist agenda ownership');

    console.log('TEST 12: Therapist A attempts body bypass to Therapist B agenda');
    const bodyBypass = await request(
      'GET',
      `/api/v1/appointments/therapist`,
      therapistAToken,
      { therapistId: therapistB.id }
    );
    if (bodyBypass.status !== 403) {
      throw new Error(`Expected 403 but received ${bodyBypass.status}: ${JSON.stringify(bodyBypass.response)}`);
    }
    console.log('PASS: Request body cannot bypass therapist agenda ownership');

    console.log('ALL SCHEDULE OWNERSHIP TESTS PASSED');
  } finally {
    server.close();
    if (appointmentIds.length > 0) {
      await prisma.appointment.deleteMany({
        where: {
          id: { in: appointmentIds },
        },
      });
    }
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
  console.error('SCHEDULE OWNERSHIP TEST FAILURE:', err.message || err);
  process.exit(1);
});
