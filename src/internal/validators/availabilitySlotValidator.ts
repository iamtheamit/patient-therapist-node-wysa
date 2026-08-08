import { z } from 'zod';

export const createAvailabilitySlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:mm format'),
  appointmentType: z.string().optional(),
  isRecurring: z.boolean().optional(),
  repeatType: z.string().optional(),
  repeatFrequency: z.string().optional(),
});

export type CreateAvailabilitySlotDto = z.infer<typeof createAvailabilitySlotSchema>;
