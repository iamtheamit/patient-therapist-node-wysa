import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/internal/infrastructure/database/prismaClient';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { logger } from '../src/internal/shared/logger';

export async function seed(): Promise<void> {
  logger.info('Initiating database seeding process...');

  const therapistName = process.env.SEED_THERAPIST_NAME || 'Dr. Sarah Jenkins';
  const therapistEmail = process.env.SEED_THERAPIST_EMAIL || 'therapist@wysa.com';
  const therapistPassword = process.env.SEED_THERAPIST_PASSWORD || 'Password123!';

  const patientName = process.env.SEED_PATIENT_NAME || 'John Doe';
  const patientEmail = process.env.SEED_PATIENT_EMAIL || 'patient@wysa.com';
  const patientPassword = process.env.SEED_PATIENT_PASSWORD || 'Password123!';

  const startTime = process.env.SEED_SCHEDULE_START_TIME || '09:00';
  const endTime = process.env.SEED_SCHEDULE_END_TIME || '17:00';
  const slotDuration = parseInt(process.env.SEED_SCHEDULE_SLOT_DURATION || '30', 10);

  const therapistPasswordHash = await bcrypt.hash(therapistPassword, 10);
  const patientPasswordHash = await bcrypt.hash(patientPassword, 10);

  // 1. Seed Therapist User
  const therapist = await prisma.user.upsert({
    where: { email: therapistEmail },
    update: {
      name: therapistName,
      passwordHash: therapistPasswordHash,
    },
    create: {
      name: therapistName,
      email: therapistEmail,
      passwordHash: therapistPasswordHash,
      role: Role.THERAPIST,
    },
  });

  // 2. Seed Patient User
  const patient = await prisma.user.upsert({
    where: { email: patientEmail },
    update: {
      name: patientName,
      passwordHash: patientPasswordHash,
    },
    create: {
      name: patientName,
      email: patientEmail,
      passwordHash: patientPasswordHash,
      role: Role.PATIENT,
    },
  });

  // 3. Seed Weekly Schedule for Therapist (Monday to Friday)
  await prisma.therapistSchedule.deleteMany({
    where: { therapistId: therapist.id },
  });

  const schedules = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    therapistId: therapist.id,
    dayOfWeek,
    startTime,
    endTime,
    slotDuration,
    isActive: true,
  }));

  await prisma.therapistSchedule.createMany({
    data: schedules,
  });

  logger.info('Database seeded successfully', {
    therapist: { id: therapist.id, email: therapistEmail, name: therapistName },
    patient: { id: patient.id, email: patientEmail, name: patientName },
    schedule: { days: 'Mon-Fri', hours: `${startTime}-${endTime}`, slotDurationMinutes: slotDuration },
  });
}

seed()
  .catch((e) => {
    logger.error('Fatal seeding failure', { error: e.message, stack: e.stack });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
