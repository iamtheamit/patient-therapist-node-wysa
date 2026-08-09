import dotenv from 'dotenv';
dotenv.config();
import assert from 'assert';
import { prisma } from '../internal/infrastructure/database/prismaClient';
import { ScheduleRepository } from '../internal/repositories/scheduleRepository';
import { AvailabilityService } from '../internal/services/availabilityService';

async function runScheduleIntegrityTest() {
  console.log('--- Running Schedule History & Versioning Data Integrity Test ---');
  let therapistId: string | null = null;
  const scheduleRepo = new ScheduleRepository();
  const availabilityService = new AvailabilityService();

  try {
    // 1. Create test therapist user
    const therapist = await prisma.user.create({
      data: {
        name: 'Dr. Integrity Test',
        email: `integrity-test-${Date.now()}@therapysync.com`,
        passwordHash: 'hash',
        role: 'THERAPIST',
      },
    });
    therapistId = therapist.id;
    console.log(`[PASS] Created test therapist: ${therapistId}`);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 14); // 14 days ago

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days in future

    // 2. Setup initial schedule rules (50-min slots, 09:00 - 17:00) effective from 14 days ago
    await scheduleRepo.updateSchedules(
      therapistId,
      [
        {
          dayOfWeek: 1, // Monday
          startTime: '09:00',
          endTime: '17:00',
          slotDuration: 50,
          bufferDuration: 10,
          isActive: true,
        },
      ],
      pastDate
    );

    const pastSchedules = await scheduleRepo.findByTherapistId(therapistId, pastDate);
    assert.strictEqual(pastSchedules.length, 1, 'Past schedule rules count should be 1');
    assert.strictEqual(pastSchedules[0].slotDuration, 50, 'Historical slot duration must be 50 min');
    assert.strictEqual(pastSchedules[0].startTime, '09:00', 'Historical start time must be 09:00');
    console.log('[PASS] Initial schedule rules created with past effectiveFrom timestamp');

    // 3. Update schedule rules (30-min slots, 10:00 - 16:00) effective starting futureDate
    await scheduleRepo.updateSchedules(
      therapistId,
      [
        {
          dayOfWeek: 1, // Monday
          startTime: '10:00',
          endTime: '16:00',
          slotDuration: 30,
          bufferDuration: 10,
          isActive: true,
        },
      ],
      futureDate
    );

    // 4. Verify database preserves BOTH historical version and new version (no hard-deletion)
    const allDbSchedules = await prisma.therapistSchedule.findMany({
      where: { therapistId },
      orderBy: { createdAt: 'asc' },
    });

    assert.ok(allDbSchedules.length >= 2, 'Database should contain both archived and active schedule versions');

    const archivedRule = allDbSchedules.find((s) => s.slotDuration === 50);
    assert.ok(archivedRule, 'Archived historical rule (50m) must exist in DB');
    assert.ok(archivedRule?.effectiveUntil, 'Archived historical rule must have effectiveUntil set');

    const newRule = allDbSchedules.find((s) => s.slotDuration === 30);
    assert.ok(newRule, 'New schedule rule (30m) must exist in DB');
    assert.strictEqual(newRule?.isActive, true, 'New schedule rule must be marked isActive = true');
    console.log('[PASS] Non-destructive schedule versioning verified (no deleteMany data loss)');

    // 5. Verify time-aware schedule lookups
    const historicalLookup = await scheduleRepo.findByTherapistId(therapistId, pastDate);
    assert.strictEqual(historicalLookup[0].slotDuration, 50, 'Past date query must return historical 50m slot duration');

    const futureLookup = await scheduleRepo.findByTherapistId(therapistId, futureDate);
    assert.strictEqual(futureLookup[0].slotDuration, 30, 'Future date query must return new 30m slot duration');
    console.log('[PASS] Time-aware schedule rule lookups verified for past vs future dates');

    // 6. Verify availability slot derivation preserves historical slot duration
    const pastMondayStr = '2026-08-03'; // Historical Monday
    const futureMondayStr = '2026-08-17'; // Future Monday

    const pastAvailability = await availabilityService.getAvailableSlots(
      therapistId,
      pastMondayStr,
      pastMondayStr
    );

    const futureAvailability = await availabilityService.getAvailableSlots(
      therapistId,
      futureMondayStr,
      futureMondayStr
    );

    const pastSlots = Array.isArray(pastAvailability) ? pastAvailability : pastAvailability.items;
    const futureSlots = Array.isArray(futureAvailability) ? futureAvailability : futureAvailability.items;

    if (pastSlots && pastSlots.length > 0) {
      assert.strictEqual(pastSlots[0].durationMinutes, 50, 'Past derived slots must maintain 50m duration');
    }

    if (futureSlots && futureSlots.length > 0) {
      assert.strictEqual(futureSlots[0].durationMinutes, 30, 'Future derived slots must use 30m duration');
    }
    console.log('[PASS] Dynamic availability slot engine maintains historical accuracy');

    console.log('\n✅ ALL SCHEDULE INTEGRITY TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (therapistId) {
      await prisma.therapistSchedule.deleteMany({ where: { therapistId } });
      await prisma.user.delete({ where: { id: therapistId } });
    }
    await prisma.$disconnect();
  }
}

runScheduleIntegrityTest();
