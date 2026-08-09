import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const scheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, 'startTime must be in HH:mm format (e.g. 09:00)'),
  endTime: z.string().regex(timeRegex, 'endTime must be in HH:mm format (e.g. 17:00)'),
  slotDuration: z.number().int().min(15).max(240).default(50),
  bufferDuration: z.number().int().min(0).max(120).default(10),
  breakStartTime: z.string().regex(timeRegex).optional().nullable(),
  breakEndTime: z.string().regex(timeRegex).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateScheduleSchema = z.object({
  schedules: z.array(scheduleItemSchema),
});

export type ScheduleItemDto = z.infer<typeof scheduleItemSchema>;
export type UpdateScheduleDto = z.infer<typeof updateScheduleSchema>;
