import { randomUUID } from 'crypto';
import { prisma } from '../infrastructure/database/prismaClient';
import { AppointmentRepository, AppointmentFilterParams } from '../repositories/appointmentRepository';
import { HoldSlotDto, SimulatePaymentDto, UpdateAppointmentStatusDto } from '../validators/appointmentValidator';
import { ConflictError, NotFoundError, ForbiddenError, BadRequestError } from '../shared/errors';
import { APPOINTMENT_MESSAGES } from '../shared/constants';
import { AppointmentStatus, PaymentStatus, BookingType, RecurrenceFrequency, Appointment } from '@prisma/client';
import { config } from '../../config';
import { PaginationParams } from '../shared/helpers/pagination';

import { logger } from '../shared/logger/logger';

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

    // Sort candidate slots chronologically to prevent deadlocks across multi-slot locks
    candidateSlots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const seriesId = dto.bookingType === BookingType.RECURRING ? randomUUID() : null;
    const holdExpiresAt = new Date(Date.now() + config.holdDurationSeconds * 1000);

    // Execute hold generation in database transaction with PostgreSQL transaction-scoped advisory locking
    return prisma.$transaction(async (tx) => {
      // 1. Acquire PostgreSQL transaction-level advisory locks for each candidate slot FIRST
      for (const slot of candidateSlots) {
        await appointmentRepo.acquireSlotLock(tx, dto.therapistId, slot.startTime, slot.endTime);
        logger.info('SLOT_LOCK_ACQUIRED', {
          therapistId: dto.therapistId,
          patientId,
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          operation: 'HOLD',
        });
      }

      // 2. Clean expired holds & check conflicts for each candidate slot
      for (const slot of candidateSlots) {
        await appointmentRepo.cleanExpiredHoldsForSlot(tx, dto.therapistId, slot.startTime);
        const hasConflict = await appointmentRepo.checkSlotConflict(tx, dto.therapistId, slot.startTime, slot.endTime);
        if (hasConflict) {
          logger.warn('SLOT_UNAVAILABLE', {
            therapistId: dto.therapistId,
            patientId,
            startTime: slot.startTime.toISOString(),
            endTime: slot.endTime.toISOString(),
            operation: 'HOLD',
            result: 'CONFLICT',
          });
          throw new ConflictError(
            APPOINTMENT_MESSAGES.SLOT_CONFLICT(slot.startTime.toISOString())
          );
        }
      }

      // 3. Insert all holds atomically
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
        logger.info('SLOT_HOLD_CREATED', {
          holdId: appt.id,
          therapistId: dto.therapistId,
          patientId,
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          holdExpiresAt: holdExpiresAt.toISOString(),
          operation: 'HOLD',
          result: 'SUCCESS',
        });
        createdAppointments.push(appt);
      }

      return createdAppointments;
    });
  }

  public async simulatePayment(patientId: string, appointmentId: string, dto: SimulatePaymentDto): Promise<Appointment> {
    return prisma.$transaction(async (tx) => {
      const appt = await appointmentRepo.findById(appointmentId, tx);
      if (!appt) {
        throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
      }

      if (appt.patientId !== patientId) {
        throw new ForbiddenError(APPOINTMENT_MESSAGES.PAYMENT_ACCESS_DENIED);
      }

      if (appt.appointmentStatus !== AppointmentStatus.HOLD) {
        throw new BadRequestError(APPOINTMENT_MESSAGES.INVALID_STATE_FOR_PAYMENT(appt.appointmentStatus));
      }

      // Acquire advisory lock for appointment slot inside transaction
      await appointmentRepo.acquireSlotLock(tx, appt.therapistId, appt.startTime, appt.endTime);

      // Check hold expiration
      if (appt.holdExpiresAt && appt.holdExpiresAt <= new Date()) {
        await appointmentRepo.updateStatus(appointmentId, AppointmentStatus.HOLD_EXPIRED, PaymentStatus.FAILED, tx);
        logger.warn('HOLD_EXPIRED', {
          holdId: appointmentId,
          patientId,
          therapistId: appt.therapistId,
          startTime: appt.startTime.toISOString(),
          endTime: appt.endTime.toISOString(),
          operation: 'PAYMENT',
          result: 'HOLD_EXPIRED',
        });
        throw new ConflictError(APPOINTMENT_MESSAGES.HOLD_EXPIRED);
      }

      if (dto.status === 'SUCCESS') {
        const updated = await appointmentRepo.updateStatus(appointmentId, AppointmentStatus.SCHEDULED, PaymentStatus.SUCCESS, tx);
        logger.info('APPOINTMENT_CONFIRMED', {
          appointmentId: updated.id,
          patientId,
          therapistId: appt.therapistId,
          startTime: appt.startTime.toISOString(),
          endTime: appt.endTime.toISOString(),
          operation: 'PAYMENT',
          result: 'SUCCESS',
        });
        return updated;
      } else {
        const updated = await appointmentRepo.updateStatus(appointmentId, AppointmentStatus.PAYMENT_FAILED, PaymentStatus.FAILED, tx);
        logger.warn('PAYMENT_FAILED', {
          appointmentId: updated.id,
          patientId,
          therapistId: appt.therapistId,
          startTime: appt.startTime.toISOString(),
          endTime: appt.endTime.toISOString(),
          operation: 'PAYMENT',
          result: 'PAYMENT_FAILED',
        });
        return updated;
      }
    });
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
    return prisma.$transaction(async (tx) => {
      const appt = await appointmentRepo.findById(holdId, tx);
      if (!appt) {
        throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
      }

      if (appt.patientId !== patientId) {
        throw new ForbiddenError(APPOINTMENT_MESSAGES.PAYMENT_ACCESS_DENIED);
      }

      if (appt.appointmentStatus === AppointmentStatus.HOLD_EXPIRED) {
        return appt;
      }

      if (appt.appointmentStatus !== AppointmentStatus.HOLD) {
        throw new BadRequestError('Appointment is not in HOLD state');
      }

      await appointmentRepo.acquireSlotLock(tx, appt.therapistId, appt.startTime, appt.endTime);

      const updated = await appointmentRepo.updateStatus(holdId, AppointmentStatus.HOLD_EXPIRED, PaymentStatus.FAILED, tx);
      logger.info('HOLD_RELEASED', {
        holdId,
        patientId,
        therapistId: appt.therapistId,
        startTime: appt.startTime.toISOString(),
        endTime: appt.endTime.toISOString(),
        operation: 'RELEASE',
        result: 'SUCCESS',
      });
      return updated;
    });
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

  public async getTherapistAppointments(therapistId: string, filters?: AppointmentFilterParams | AppointmentStatus, paginationParams?: PaginationParams) {
    await appointmentRepo.expireOldHolds();
    return appointmentRepo.findByTherapist(therapistId, filters, paginationParams);
  }

  public async getPatientAppointments(patientId: string, filters?: AppointmentFilterParams | AppointmentStatus, paginationParams?: PaginationParams) {
    await appointmentRepo.expireOldHolds();
    return appointmentRepo.findByPatient(patientId, filters, paginationParams);
  }
}
