import { prisma } from '../internal/infrastructure/database/prismaClient';
import { AppointmentService } from '../internal/services/appointmentService';
import { BookingType, RecurrenceFrequency, AppointmentStatus } from '@prisma/client';
import { ConflictError } from '../internal/shared/errors';

const appointmentService = new AppointmentService();

async function runConcurrencyTests() {
  console.log('\n==================================================');
  console.log('STARTING POSTGRESQL CONCURRENCY & ADVISORY LOCK TESTS');
  console.log('==================================================\n');

  let testTherapistId: string;
  let patientA: string;
  let patientB: string;

  try {
    // 1. Setup test users in database
    console.log('⚙️  [Setup] Fetching or creating test users...');
    let therapistUser = await prisma.user.findFirst({ where: { role: 'THERAPIST' } });
    if (!therapistUser) {
      therapistUser = await prisma.user.create({
        data: {
          name: 'Test Therapist',
          email: `test_therapist_${Date.now()}@wysa.com`,
          passwordHash: 'hashed_pw',
          role: 'THERAPIST',
        },
      });
    }
    testTherapistId = therapistUser.id;

    let patientUser1 = await prisma.user.findFirst({ where: { role: 'PATIENT', email: { contains: 'test_patient_1' } } });
    if (!patientUser1) {
      patientUser1 = await prisma.user.create({
        data: {
          name: 'Test Patient 1',
          email: `test_patient_1_${Date.now()}@wysa.com`,
          passwordHash: 'hashed_pw',
          role: 'PATIENT',
        },
      });
    }
    patientA = patientUser1.id;

    let patientUser2 = await prisma.user.findFirst({ where: { role: 'PATIENT', email: { contains: 'test_patient_2' } } });
    if (!patientUser2) {
      patientUser2 = await prisma.user.create({
        data: {
          name: 'Test Patient 2',
          email: `test_patient_2_${Date.now()}@wysa.com`,
          passwordHash: 'hashed_pw',
          role: 'PATIENT',
        },
      });
    }
    patientB = patientUser2.id;

    // Helper to generate future slot time
    const getFutureSlot = (offsetMinutes: number) => {
      const start = new Date(Date.now() + offsetMinutes * 60 * 1000);
      start.setSeconds(0, 0);
      const end = new Date(start.getTime() + 50 * 60 * 1000);
      return { startTime: start.toISOString(), endTime: end.toISOString() };
    };

    // Cleanup existing test appointments for this therapist
    await prisma.appointment.deleteMany({ where: { therapistId: testTherapistId } });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: 2 Simultaneous HOLD Requests for the same slot
    // ──────────────────────────────────────────────────────────────────────────
    console.log('🧪 TEST 1: 2 Simultaneous HOLD Requests for the exact same slot');
    const slot1 = getFutureSlot(120);

    const reqs2 = [
      appointmentService.holdSlot(patientA, {
        therapistId: testTherapistId,
        startTime: slot1.startTime,
        endTime: slot1.endTime,
        bookingType: BookingType.ONE_TIME,
        recurrenceFrequency: RecurrenceFrequency.NONE,
      }),
      appointmentService.holdSlot(patientB, {
        therapistId: testTherapistId,
        startTime: slot1.startTime,
        endTime: slot1.endTime,
        bookingType: BookingType.ONE_TIME,
        recurrenceFrequency: RecurrenceFrequency.NONE,
      }),
    ];

    const results2 = await Promise.allSettled(reqs2);
    const successCount2 = results2.filter((r) => r.status === 'fulfilled').length;
    const conflictCount2 = results2.filter((r) => r.status === 'rejected').length;

    console.log(`   Result: ${successCount2} Success, ${conflictCount2} Conflict(s)`);
    if (successCount2 === 1 && conflictCount2 === 1) {
      console.log('   ✅ PASS: Exactly 1 hold succeeded and 1 was rejected with conflict!\n');
    } else {
      throw new Error(`TEST 1 FAILED: Expected 1 success and 1 conflict, got ${successCount2} success and ${conflictCount2} conflict`);
    }

    // Cleanup
    await prisma.appointment.deleteMany({ where: { therapistId: testTherapistId } });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: 10 Simultaneous HOLD Requests
    // ──────────────────────────────────────────────────────────────────────────
    console.log('🧪 TEST 2: 10 Simultaneous HOLD Requests for the exact same slot');
    const slot2 = getFutureSlot(180);

    const reqs10 = Array.from({ length: 10 }).map((_, i) =>
      appointmentService.holdSlot(i % 2 === 0 ? patientA : patientB, {
        therapistId: testTherapistId,
        startTime: slot2.startTime,
        endTime: slot2.endTime,
        bookingType: BookingType.ONE_TIME,
        recurrenceFrequency: RecurrenceFrequency.NONE,
      })
    );

    const results10 = await Promise.allSettled(reqs10);
    const successCount10 = results10.filter((r) => r.status === 'fulfilled').length;
    const conflictCount10 = results10.filter((r) => r.status === 'rejected').length;

    console.log(`   Result: ${successCount10} Success, ${conflictCount10} Conflict(s)`);
    if (successCount10 === 1 && conflictCount10 === 9) {
      console.log('   ✅ PASS: Exactly 1 hold succeeded and 9 were rejected with conflict!\n');
    } else {
      throw new Error(`TEST 2 FAILED: Expected 1 success and 9 conflicts, got ${successCount10} success and ${conflictCount10} conflicts`);
    }

    // Cleanup
    await prisma.appointment.deleteMany({ where: { therapistId: testTherapistId } });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: 100 Simultaneous HOLD Requests (Massive Cluster Concurrency)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('🧪 TEST 3: 100 Simultaneous HOLD Requests for the exact same slot');
    const slot3 = getFutureSlot(240);

    const reqs100 = Array.from({ length: 100 }).map((_, i) =>
      appointmentService.holdSlot(i % 2 === 0 ? patientA : patientB, {
        therapistId: testTherapistId,
        startTime: slot3.startTime,
        endTime: slot3.endTime,
        bookingType: BookingType.ONE_TIME,
        recurrenceFrequency: RecurrenceFrequency.NONE,
      })
    );

    const results100 = await Promise.allSettled(reqs100);
    const successCount100 = results100.filter((r) => r.status === 'fulfilled').length;
    const conflictCount100 = results100.filter((r) => r.status === 'rejected').length;

    console.log(`   Result: ${successCount100} Success, ${conflictCount100} Conflict(s)`);
    if (successCount100 === 1 && conflictCount100 === 99) {
      console.log('   ✅ PASS: Exactly 1 hold succeeded and 99 were rejected with conflict!\n');
    } else {
      throw new Error(`TEST 3 FAILED: Expected 1 success and 99 conflicts, got ${successCount100} success and ${conflictCount100} conflicts`);
    }

    // Cleanup
    await prisma.appointment.deleteMany({ where: { therapistId: testTherapistId } });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Expired Hold Re-allocation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('🧪 TEST 4: Expired Hold Re-allocation after holdExpiresAt');
    const slot4 = getFutureSlot(300);

    // Create an expired hold manually
    await prisma.appointment.create({
      data: {
        patientId: patientA,
        therapistId: testTherapistId,
        startTime: new Date(slot4.startTime),
        endTime: new Date(slot4.endTime),
        appointmentStatus: AppointmentStatus.HOLD,
        holdExpiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
      },
    });

    // Patient B attempts to hold the slot
    const holdByPatientB = await appointmentService.holdSlot(patientB, {
      therapistId: testTherapistId,
      startTime: slot4.startTime,
      endTime: slot4.endTime,
      bookingType: BookingType.ONE_TIME,
      recurrenceFrequency: RecurrenceFrequency.NONE,
    });

    if (holdByPatientB.length === 1 && holdByPatientB[0].patientId === patientB) {
      console.log('   ✅ PASS: Patient B successfully acquired slot after Patient A hold expired!\n');
    } else {
      throw new Error('TEST 4 FAILED: Patient B was unable to acquire slot after hold expired.');
    }

    // Cleanup
    await prisma.appointment.deleteMany({ where: { therapistId: testTherapistId } });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: Release Hold & Re-booking
    // ──────────────────────────────────────────────────────────────────────────
    console.log('🧪 TEST 5: Release Hold & Immediate Re-booking');
    const slot5 = getFutureSlot(360);

    const holdA = await appointmentService.holdSlot(patientA, {
      therapistId: testTherapistId,
      startTime: slot5.startTime,
      endTime: slot5.endTime,
      bookingType: BookingType.ONE_TIME,
      recurrenceFrequency: RecurrenceFrequency.NONE,
    });

    // Patient A releases hold
    await appointmentService.releaseHold(patientA, holdA[0].id);

    // Patient B attempts to hold slot now
    const holdBAfterRelease = await appointmentService.holdSlot(patientB, {
      therapistId: testTherapistId,
      startTime: slot5.startTime,
      endTime: slot5.endTime,
      bookingType: BookingType.ONE_TIME,
      recurrenceFrequency: RecurrenceFrequency.NONE,
    });

    if (holdBAfterRelease.length === 1 && holdBAfterRelease[0].patientId === patientB) {
      console.log('   ✅ PASS: Patient B successfully acquired slot after Patient A released hold!\n');
    } else {
      throw new Error('TEST 5 FAILED: Patient B failed to acquire slot after release.');
    }

    // Cleanup
    await prisma.appointment.deleteMany({ where: { therapistId: testTherapistId } });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: Payment Confirmation Concurrency & Safety
    // ──────────────────────────────────────────────────────────────────────────
    console.log('🧪 TEST 6: Payment Confirmation Concurrency (Hold -> Scheduled)');
    const slot6 = getFutureSlot(420);

    const holdPayTest = await appointmentService.holdSlot(patientA, {
      therapistId: testTherapistId,
      startTime: slot6.startTime,
      endTime: slot6.endTime,
      bookingType: BookingType.ONE_TIME,
      recurrenceFrequency: RecurrenceFrequency.NONE,
    });

    const appointmentId = holdPayTest[0].id;

    // Simulate 2 concurrent payment confirmation requests for the same appointment
    const payReqs = [
      appointmentService.simulatePayment(patientA, appointmentId, { status: 'SUCCESS' }),
      appointmentService.simulatePayment(patientA, appointmentId, { status: 'SUCCESS' }),
    ];

    const payResults = await Promise.allSettled(payReqs);
    const paySuccess = payResults.filter((r) => r.status === 'fulfilled').length;

    const finalApptState = await prisma.appointment.findUnique({ where: { id: appointmentId } });

    if (finalApptState?.appointmentStatus === AppointmentStatus.SCHEDULED && paySuccess >= 1) {
      console.log('   ✅ PASS: Appointment cleanly transitioned to SCHEDULED without state corruption!\n');
    } else {
      throw new Error('TEST 6 FAILED: Payment confirmation concurrency failed.');
    }

    // Cleanup
    await prisma.appointment.deleteMany({ where: { therapistId: testTherapistId } });

    console.log('==================================================');
    console.log('🎉 ALL 6 CONCURRENCY TESTS PASSED SUCCESSFULLY!');
    console.log('==================================================\n');
  } catch (err: any) {
    console.error('❌ CONCURRENCY TEST FAILURE:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runConcurrencyTests();
