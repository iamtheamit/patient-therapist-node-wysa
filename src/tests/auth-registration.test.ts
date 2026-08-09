import dotenv from 'dotenv';
dotenv.config();

import { Role } from '@prisma/client';
import { prisma } from '../internal/infrastructure/database/prismaClient';
import { AuthService } from '../internal/services/auth.service';
import { registerSchema } from '../internal/validators/authValidator';

const authService = new AuthService();
const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const testEmails: string[] = [];

async function registerWithBody(body: Record<string, unknown>) {
  testEmails.push(body.email as string);
  const parsed = registerSchema.parse(body);
  return authService.register(parsed);
}

function assertPatientRole(result: Awaited<ReturnType<typeof registerWithBody>>) {
  if (result.user.role !== Role.PATIENT) {
    throw new Error(`Expected registered user role to be PATIENT, received ${result.user.role}`);
  }
}

function assertNoPasswordFields(result: Awaited<ReturnType<typeof registerWithBody>>) {
  const serialized = JSON.stringify(result);
  if (serialized.includes('passwordHash') || serialized.includes('Password123!')) {
    throw new Error('Registration response exposed password data');
  }
}

async function expectRegisteredPatient(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Expected registered user ${email} to exist`);
  }
  if (user.role !== Role.PATIENT) {
    throw new Error(`Expected persisted role for ${email} to be PATIENT, received ${user.role}`);
  }
}

async function runAuthRegistrationTests() {
  console.log('STARTING AUTH REGISTRATION SECURITY TESTS');

  try {
    const normalEmail = `auth-normal-${runId}@example.com`;
    const normal = await registerWithBody({
      name: 'Normal Patient',
      email: normalEmail,
      password: 'Password123!',
    });
    assertPatientRole(normal);
    assertNoPasswordFields(normal);
    await expectRegisteredPatient(normalEmail);
    console.log('PASS: normal registration creates PATIENT');

    const therapistAttemptEmail = `auth-therapist-${runId}@example.com`;
    const therapistAttempt = await registerWithBody({
      name: 'Therapist Attempt',
      email: therapistAttemptEmail,
      password: 'Password123!',
      role: 'THERAPIST',
    });
    assertPatientRole(therapistAttempt);
    await expectRegisteredPatient(therapistAttemptEmail);
    console.log('PASS: role=THERAPIST is ignored and creates PATIENT');

    const adminAttemptEmail = `auth-admin-${runId}@example.com`;
    const adminAttempt = await registerWithBody({
      name: 'Admin Attempt',
      email: adminAttemptEmail,
      password: 'Password123!',
      role: 'ADMIN',
    });
    assertPatientRole(adminAttempt);
    await expectRegisteredPatient(adminAttemptEmail);
    console.log('PASS: role=ADMIN cannot create ADMIN');

    const unknownRoleEmail = `auth-unknown-${runId}@example.com`;
    const unknownRoleAttempt = await registerWithBody({
      name: 'Unknown Role Attempt',
      email: unknownRoleEmail,
      password: 'Password123!',
      role: 'SUPER_ADMIN',
    });
    assertPatientRole(unknownRoleAttempt);
    await expectRegisteredPatient(unknownRoleEmail);
    console.log('PASS: unknown role cannot create privileged account');

    const loginResult = await authService.login({
      email: normalEmail,
      password: 'Password123!',
    });
    assertPatientRole(loginResult);
    assertNoPasswordFields(loginResult);
    console.log('PASS: legitimate registration remains login-compatible');

    console.log('ALL AUTH REGISTRATION SECURITY TESTS PASSED');
  } finally {
    await prisma.user.deleteMany({
      where: { email: { in: testEmails } },
    });
    await prisma.$disconnect();
  }
}

runAuthRegistrationTests().catch((err) => {
  console.error('AUTH REGISTRATION SECURITY TEST FAILURE:', err.message || err);
  process.exit(1);
});
