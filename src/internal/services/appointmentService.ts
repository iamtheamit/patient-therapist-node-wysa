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

      // 1.5 Delete any pre-existing slot holds by the same patient for this therapist to prevent self-conflict (only for recurring slot booking upgrade)
      if (dto.bookingType === BookingType.RECURRING) {
        await tx.appointment.deleteMany({
          where: {
            patientId,
            therapistId: dto.therapistId,
            startTime: { in: candidateSlots.map((s) => s.startTime) },
            appointmentStatus: AppointmentStatus.HOLD,
          },
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
    }, { maxWait: 15000, timeout: 15000 });
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

      // Re-fetch the appointment inside the lock to get the latest committed state
      const freshAppt = await appointmentRepo.findById(appointmentId, tx);
      if (!freshAppt) {
        throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
      }
      if (freshAppt.appointmentStatus !== AppointmentStatus.HOLD) {
        throw new BadRequestError(APPOINTMENT_MESSAGES.INVALID_STATE_FOR_PAYMENT(freshAppt.appointmentStatus));
      }

      // Check that no other appointment for this slot is already SCHEDULED (concurrent confirm guard)
      const slotAlreadyBooked = await tx.appointment.findFirst({
        where: {
          therapistId: appt.therapistId,
          startTime: appt.startTime,
          endTime: appt.endTime,
          appointmentStatus: AppointmentStatus.SCHEDULED,
          id: { not: appointmentId },
        },
      });
      if (slotAlreadyBooked) {
        // Mark this hold as expired since the slot is taken
        await appointmentRepo.updateStatus(appointmentId, AppointmentStatus.HOLD_EXPIRED, PaymentStatus.FAILED, tx);
        logger.warn('SLOT_ALREADY_BOOKED_ON_CONFIRM', {
          holdId: appointmentId,
          patientId,
          therapistId: appt.therapistId,
          startTime: appt.startTime.toISOString(),
          endTime: appt.endTime.toISOString(),
          operation: 'PAYMENT',
          result: 'SLOT_TAKEN',
        });
        throw new ConflictError(APPOINTMENT_MESSAGES.SLOT_CONFLICT(appt.startTime.toISOString()));
      }

      // Check hold expiration
      if (freshAppt.holdExpiresAt && freshAppt.holdExpiresAt <= new Date()) {
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
        const updated = await appointmentRepo.updateStatus(
          appointmentId,
          AppointmentStatus.SCHEDULED,
          PaymentStatus.SUCCESS,
          tx,
          dto.notes
        );
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
    }, { maxWait: 15000, timeout: 15000 });
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
    const filters: { patientId?: string; therapistId?: string } = {};

    if (role === 'PATIENT') {
      filters.patientId = userId;
    } else if (role === 'THERAPIST') {
      filters.therapistId = userId;
    } else {
      throw new ForbiddenError(APPOINTMENT_MESSAGES.CANCEL_PATIENT_DENIED);
    }

    const seriesAppointment = await appointmentRepo.findSeriesBySeriesId(seriesId);
    if (!seriesAppointment) {
      throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
    }

    const ownedAppointment = await appointmentRepo.findSeriesAppointment(seriesId, filters);
    if (!ownedAppointment) {
      throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
    }

    return appointmentRepo.updateSeriesStatus(seriesId, AppointmentStatus.CANCELLED, filters);
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

  /**
   * Atomically confirm all HOLD appointments in a recurring series.
   * Acquires advisory locks for every slot (sorted to prevent deadlock),
   * validates none are expired or already SCHEDULED by another patient,
   * then transitions the entire series to SCHEDULED in one transaction.
   */
  public async confirmSeries(
    patientId: string,
    seriesId: string,
    notes?: string
  ): Promise<Appointment[]> {
    return prisma.$transaction(async (tx) => {

      // 1. Fetch all appointments in the series
      const seriesAppts = await tx.appointment.findMany({
        where: { seriesId, patientId },
        orderBy: { startTime: 'asc' },
      });


      if (seriesAppts.length === 0) {
        throw new NotFoundError(APPOINTMENT_MESSAGES.NOT_FOUND);
      }

      // 2. Acquire advisory locks for each slot (sorted = no deadlock)
      for (const appt of seriesAppts) {
        await appointmentRepo.acquireSlotLock(tx, appt.therapistId, appt.startTime, appt.endTime);
      }

      const now = new Date();

      // 3. Validate every appointment in the series
      for (const appt of seriesAppts) {
        if (appt.appointmentStatus !== AppointmentStatus.HOLD) {
          throw new BadRequestError(
            APPOINTMENT_MESSAGES.INVALID_STATE_FOR_PAYMENT(appt.appointmentStatus)
          );
        }
        if (appt.holdExpiresAt && appt.holdExpiresAt <= now) {
          throw new ConflictError(APPOINTMENT_MESSAGES.HOLD_EXPIRED);
        }
        // Guard: another patient already booked one of these slots
        const conflict = await tx.appointment.findFirst({
          where: {
            therapistId: appt.therapistId,
            startTime: appt.startTime,
            endTime: appt.endTime,
            appointmentStatus: AppointmentStatus.SCHEDULED,
            id: { not: appt.id },
          },
        });
        if (conflict) {
          logger.warn('SERIES_SLOT_CONFLICT', {
            seriesId,
            slotId: appt.id,
            startTime: appt.startTime.toISOString(),
          });
          throw new ConflictError(APPOINTMENT_MESSAGES.SLOT_CONFLICT(appt.startTime.toISOString()));
        }
      }

      // 4. Atomically confirm all slots
      const confirmed: Appointment[] = [];
      for (const appt of seriesAppts) {
        const updated = await appointmentRepo.updateStatus(
          appt.id,
          AppointmentStatus.SCHEDULED,
          PaymentStatus.SUCCESS,
          tx,
          notes
        );
        confirmed.push(updated);
      }

      logger.info('SERIES_CONFIRMED', {
        seriesId,
        patientId,
        count: confirmed.length,
        operation: 'CONFIRM_SERIES',
        result: 'SUCCESS',
      });

      return confirmed;
    }, { maxWait: 15000, timeout: 30000 });
  }
}
