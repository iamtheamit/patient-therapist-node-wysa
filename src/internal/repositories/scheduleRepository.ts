import { prisma } from '../infrastructure/database/prismaClient';
import { TherapistSchedule } from '@prisma/client';
import { ScheduleItemDto } from '../validators/scheduleValidator';
import { DOMAIN_CONSTANTS } from '../shared/constants';

export class ScheduleRepository {

  public async findByTherapistId(therapistId: string, effectiveDate: Date = new Date()): Promise<TherapistSchedule[]> {
    const allSchedules = await prisma.therapistSchedule.findMany({
      where: {
        therapistId,
        effectiveFrom: { lte: effectiveDate },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gt: effectiveDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    // Deduplicate by dayOfWeek so the most recent effective schedule per day is returned
    const map = new Map<number, TherapistSchedule>();
    for (const schedule of allSchedules) {
      if (!map.has(schedule.dayOfWeek) && schedule.isActive) {
        map.set(schedule.dayOfWeek, schedule);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  public async findByTherapistIdForDateRange(
    therapistId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TherapistSchedule[]> {
    return prisma.therapistSchedule.findMany({
      where: {
        therapistId,
        effectiveFrom: { lte: endDate },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gte: startDate } },
        ],
      },
      orderBy: { effectiveFrom: 'asc' },
    });
  }

  public async updateSchedules(
    therapistId: string,
    items: ScheduleItemDto[],
    effectiveFrom: Date = new Date()
  ): Promise<TherapistSchedule[]> {
    return prisma.$transaction(async (tx) => {
      // Close out previous schedule window by setting effectiveUntil = effectiveFrom
      await tx.therapistSchedule.updateMany({
        where: {
          therapistId,
          effectiveUntil: null,
        },
        data: {
          effectiveUntil: effectiveFrom,
        },
      });

      // Insert new versioned schedule rules starting at effectiveFrom
      await tx.therapistSchedule.createMany({
        data: items.map((item) => ({
          therapistId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          slotDuration: item.slotDuration,
          bufferDuration: item.bufferDuration ?? DOMAIN_CONSTANTS.DEFAULT_BUFFER_DURATION_MINUTES,

          breakStartTime: item.breakStartTime ?? null,
          breakEndTime: item.breakEndTime ?? null,
          isActive: item.isActive ?? true,
          effectiveFrom,
          effectiveUntil: null,
        })),
      });

      // Return newly created active schedule rules
      return tx.therapistSchedule.findMany({
        where: {
          therapistId,
          isActive: true,
          effectiveUntil: null,
        },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }
}
