import { prisma } from '../infrastructure/database/prismaClient';
import { TherapistSchedule } from '@prisma/client';
import { ScheduleItemDto } from '../validators/scheduleValidator';

export class ScheduleRepository {
  public async findByTherapistId(therapistId: string): Promise<TherapistSchedule[]> {
    return prisma.therapistSchedule.findMany({
      where: { therapistId, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  public async updateSchedules(therapistId: string, items: ScheduleItemDto[]): Promise<TherapistSchedule[]> {
    return prisma.$transaction(async (tx) => {
      // Deactivate or delete old schedule rules for this therapist
      await tx.therapistSchedule.deleteMany({
        where: { therapistId },
      });

      // Insert new schedule rules
      await tx.therapistSchedule.createMany({
        data: items.map((item) => ({
          therapistId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          slotDuration: item.slotDuration,
          isActive: item.isActive ?? true,
        })),
      });

      return tx.therapistSchedule.findMany({
        where: { therapistId, isActive: true },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }
}
