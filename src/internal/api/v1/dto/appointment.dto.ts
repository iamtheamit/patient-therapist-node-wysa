import { BookingType, RecurrenceFrequency, AppointmentStatus, PaymentStatus } from '@prisma/client';

export interface CreateHoldRequestDto {
  therapistId: string;
  startTime: string;
  endTime: string;
  bookingType?: BookingType;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
}

export interface AppointmentResponseDto {
  id: string;
  patientId: string;
  therapistId: string;
  bookingType: BookingType;
  seriesId?: string | null;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceEndDate?: Date | null;
  appointmentStatus: AppointmentStatus;
  paymentStatus: PaymentStatus;
  holdExpiresAt?: Date | null;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
}
