import { z } from 'zod';
import { BookingType, RecurrenceFrequency, AppointmentStatus } from '@prisma/client';

export const getAvailabilityQuerySchema = z.object({
  therapistId: z.string().uuid('Invalid therapist ID format'),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const holdSlotSchema = z.object({
  therapistId: z.string().uuid('Invalid therapist ID format'),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  bookingType: z.nativeEnum(BookingType).optional().default(BookingType.ONE_TIME),
  recurrenceFrequency: z.nativeEnum(RecurrenceFrequency).optional().default(RecurrenceFrequency.NONE),
  recurrenceEndDate: z.string().datetime({ offset: true }).optional(),
});

export const simulatePaymentSchema = z.object({
  status: z.enum(['SUCCESS', 'FAILED']),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED', 'NO_SHOW']),
});

export type GetAvailabilityQueryDto = z.infer<typeof getAvailabilityQuerySchema>;
export type HoldSlotDto = z.infer<typeof holdSlotSchema>;
export type SimulatePaymentDto = z.infer<typeof simulatePaymentSchema>;
export type UpdateAppointmentStatusDto = z.infer<typeof updateAppointmentStatusSchema>;
