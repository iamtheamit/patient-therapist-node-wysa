import { randomUUID } from 'crypto';
import { prisma } from '../infrastructure/database/prismaClient';
import { AppointmentRepository } from '../repositories/appointmentRepository';
import { HoldSlotDto, SimulatePaymentDto, UpdateAppointmentStatusDto } from '../validators/appointmentValidator';
import { ConflictError, NotFoundError, ForbiddenError, BadRequestError } from '../shared/errors';
import { APPOINTMENT_MESSAGES } from '../shared/constants';
import { AppointmentStatus, PaymentStatus, BookingType, RecurrenceFrequency, Appointment } from '@prisma/client';
import { config } from '../../config';
import { PaginationParams } from '../shared/helpers/pagination';

const appointmentRepo = new AppointmentRepository();

export class AppointmentService {
  public async holdSlot(patientId: string, dto: HoldSlotDto): Promise<Appointment[]> {
    const mainStart = new Date(dto.startTime);
    const mainEnd = new Date(dto.endTime);

    if (mainStart <= new Date()) {
      throw new BadRequestError(APPOINTMENT_MESSAGES.SLOT_IN_PAST);
    }

    const slotDurationMs = mainEnd.getTime() - mainStart.getTime();
    if (slotDurationMs <= 0) {
      throw new BadRequestError(APPOINTMENT_MESSAGES.INVALID_SLOT_DURATION);
    }

    // Determine candidate slots for booking
    const candidateSlots: { startTime: Date; endTime: Date }[] = [{ startTime: mainStart, endTime: mainEnd }];

    if (dto.bookingType === BookingType.RECURRING) {
      if (!dto.recurrenceEndDate) {
        throw new BadRequestError(APPOINTMENT_MESSAGES.RECURRENCE_END_REQUIRED);
      }
      if (dto.recurrenceFrequency === RecurrenceFrequency.NONE) {
        throw new BadRequestError(APPOINTMENT_MESSAGES.RECURRENCE_FREQ_REQUIRED);
      }

      const recEnd = new Date(dto.recurrenceEndDate);
      let currStart = new Date(mainStart);

      while (true) {
        let nextStart = new Date(currStart);
        switch (dto.recurrenceFrequency) {
          case RecurrenceFrequency.DAILY:
            nextStart.setDate(nextStart.getDate() + 1);
            break;
          case RecurrenceFrequency.WEEKLY:
            nextStart.setDate(nextStart.getDate() + 7);
            break;
          case RecurrenceFrequency.BI_WEEKLY:
            nextStart.setDate(nextStart.getDate() + 14);
            break;
          case RecurrenceFrequency.MONTHLY:
            nextStart.setMonth(nextStart.getMonth() + 1);
            break;
          default:
            break;
        }

        if (nextStart > recEnd) break;

        const nextEnd = new Date(nextStart.getTime() + slotDurationMs);
        candidateSlots.push({ startTime: nextStart, endTime: nextEnd });
        currStart = nextStart;
      }
    }

    const seriesId = dto.bookingType === BookingType.RECURRING ? randomUUID() : null;
    const holdExpiresAt = new Date(Date.now() + config.holdDurationSeconds * 1000);

    // Execute hold generation in database transaction for concurrency safety across cluster nodes
    return prisma.$transaction(async (tx) => {
      // 1. Clean expired holds & check conflicts for each candidate slot
      for (const slot of candidateSlots) {
        await appointmentRepo.cleanExpiredHoldsForSlot(tx, dto.therapistId, slot.startTime);
        const hasConflict = await appointmentRepo.checkSlotConflict(tx, dto.therapistId, slot.startTime, slot.endTime);
        if (hasConflict) {
          throw new ConflictError(
            APPOINTMENT_MESSAGES.SLOT_CONFLICT(slot.startTime.toISOString())
          );
        }
      }

      // 2. Insert all holds atomically
      const createdAppointments: Appointment[] = [];
      for (const slot of candidateSlots) {
        const appt = await appointmentRepo.createHoldInTx(tx, {
          patientId,
          therapistId: dto.therapistId,
          bookingType: dto.bookingType ?? BookingType.ONE_TIME,
          seriesId,
          recurrenceFrequency: dto.recurrenceFrequency ?? RecurrenceFrequency.NONE,
          recurrenceEndDate: dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : null,
          startTime: slot.startTime,
          endTime: slot.endTime,
          holdExpiresAt,
        });
        createdAppointments.push(appt);
      }

      return createdAppointments;
    });
  }

  public async simulatePayment(patientId: string, appointmentId: string, dto: SimulatePaymentDto): Promise<Appointment> {
    const appt = await appointmentRepo.findById(appointmentId);
    if (!appt) {
      throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
    }

    if (appt.patientId !== patientId) {
      throw new ForbiddenError(APPOINTMENT_MESSAGES.PAYMENT_ACCESS_DENIED);
    }

    if (appt.appointmentStatus !== AppointmentStatus.HOLD) {
      throw new BadRequestError(APPOINTMENT_MESSAGES.INVALID_STATE_FOR_PAYMENT(appt.appointmentStatus));
    }

    // Check hold expiration
    if (appt.holdExpiresAt && appt.holdExpiresAt <= new Date()) {
      await appointmentRepo.updateStatus(appointmentId, AppointmentStatus.HOLD_EXPIRED, PaymentStatus.FAILED);
      throw new ConflictError(APPOINTMENT_MESSAGES.HOLD_EXPIRED);
    }

    if (dto.status === 'SUCCESS') {
      return appointmentRepo.updateStatus(appointmentId, AppointmentStatus.SCHEDULED, PaymentStatus.SUCCESS);
    } else {
      return appointmentRepo.updateStatus(appointmentId, AppointmentStatus.PAYMENT_FAILED, PaymentStatus.FAILED);
    }
  }

  public async cancelAppointment(userId: string, role: string, appointmentId: string): Promise<Appointment> {
    const appt = await appointmentRepo.findById(appointmentId);
    if (!appt) {
      throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
    }

    if (role === 'PATIENT' && appt.patientId !== userId) {
      throw new ForbiddenError(APPOINTMENT_MESSAGES.CANCEL_PATIENT_DENIED);
    }
    if (role === 'THERAPIST' && appt.therapistId !== userId) {
      throw new ForbiddenError(APPOINTMENT_MESSAGES.CANCEL_THERAPIST_DENIED);
    }

    return appointmentRepo.updateStatus(appointmentId, AppointmentStatus.CANCELLED);
  }

  public async cancelSeries(userId: string, role: string, seriesId: string) {
    return appointmentRepo.updateSeriesStatus(seriesId, AppointmentStatus.CANCELLED);
  }

  public async releaseHold(patientId: string, holdId: string): Promise<Appointment> {
    const appt = await appointmentRepo.findById(holdId);
    if (!appt) {
      throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
    }

    if (appt.patientId !== patientId) {
      throw new ForbiddenError(APPOINTMENT_MESSAGES.PAYMENT_ACCESS_DENIED);
    }

    if (appt.appointmentStatus !== AppointmentStatus.HOLD) {
      throw new BadRequestError('Appointment is not in HOLD state');
    }

    return appointmentRepo.updateStatus(holdId, AppointmentStatus.HOLD_EXPIRED);
  }

  public async updateAppointmentStatusByTherapist(
    therapistId: string,
    appointmentId: string,
    dto: UpdateAppointmentStatusDto
  ): Promise<Appointment> {
    const appt = await appointmentRepo.findById(appointmentId);
    if (!appt) {
      throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
    }

    if (appt.therapistId !== therapistId) {
      throw new ForbiddenError(APPOINTMENT_MESSAGES.THERAPIST_UPDATE_DENIED);
    }

    return appointmentRepo.updateStatus(appointmentId, dto.status as AppointmentStatus);
  }

  public async getTherapistAppointments(therapistId: string, status?: AppointmentStatus, paginationParams?: PaginationParams) {
    await appointmentRepo.expireOldHolds();
    return appointmentRepo.findByTherapist(therapistId, status, paginationParams);
  }

  public async getPatientAppointments(patientId: string, status?: AppointmentStatus, paginationParams?: PaginationParams) {
    await appointmentRepo.expireOldHolds();
    return appointmentRepo.findByPatient(patientId, status, paginationParams);
  }
}
