import { z } from 'zod';

export const createAvailabilitySlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:mm format'),
  appointmentType: z.string().optional(),
  isRecurring: z.boolean().optional(),
  repeatType: z.string().optional(),
  repeatFrequency: z.string().optional(),
  recurrenceEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Recurrence end date must be in YYYY-MM-DD format').optional().nullable(),
}).refine((data) => {
  if (data.isRecurring && !data.recurrenceEndDate) {
    return false;
  }
  return true;
}, {
  message: 'Recurrence end date is mandatory when the slot is recurring',
  path: ['recurrenceEndDate'],
});

export type CreateAvailabilitySlotDto = z.infer<typeof createAvailabilitySlotSchema>;
