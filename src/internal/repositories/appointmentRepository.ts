import { prisma } from '../infrastructure/database/prismaClient';
import { Appointment, AppointmentStatus, PaymentStatus, BookingType, RecurrenceFrequency, Prisma } from '@prisma/client';
import { PaginationParams, formatPaginatedResult } from '../shared/helpers/pagination';

export interface CreateHoldParams {
  patientId: string;
  therapistId: string;
  bookingType: BookingType;
  seriesId?: string | null;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceEndDate?: Date | null;
  startTime: Date;
  endTime: Date;
  holdExpiresAt: Date;
}

export class AppointmentRepository {
  public async findActiveAppointmentsInRange(
    therapistId: string,
    startRange: Date,
    endRange: Date
  ): Promise<Appointment[]> {
    const now = new Date();
    return prisma.appointment.findMany({
      where: {
        therapistId,
        startTime: { lt: endRange },
        endTime: { gt: startRange },
        appointmentStatus: { in: [AppointmentStatus.HOLD, AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED] },
        OR: [
          { appointmentStatus: { not: AppointmentStatus.HOLD } },
          { holdExpiresAt: { gt: now } },
        ],
      },
    });
  }

  public async cleanExpiredHoldsForSlot(
    tx: Prisma.TransactionClient,
    therapistId: string,
    startTime: Date
  ): Promise<void> {
    await tx.appointment.updateMany({
      where: {
        therapistId,
        startTime,
        appointmentStatus: AppointmentStatus.HOLD,
        holdExpiresAt: { lte: new Date() },
      },
      data: {
        appointmentStatus: AppointmentStatus.HOLD_EXPIRED,
        paymentStatus: PaymentStatus.FAILED,
      },
    });
  }

  public async expireOldHolds(): Promise<void> {
    await prisma.appointment.updateMany({
      where: {
        appointmentStatus: AppointmentStatus.HOLD,
        holdExpiresAt: { lte: new Date() },
      },
      data: {
        appointmentStatus: AppointmentStatus.HOLD_EXPIRED,
        paymentStatus: PaymentStatus.FAILED,
      },
    });
  }

  public async checkSlotConflict(
    tx: Prisma.TransactionClient,
    therapistId: string,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    const now = new Date();
    const conflict = await tx.appointment.findFirst({
      where: {
        therapistId,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        appointmentStatus: { in: [AppointmentStatus.HOLD, AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED] },
        OR: [
          { appointmentStatus: { not: AppointmentStatus.HOLD } },
          { holdExpiresAt: { gt: now } },
        ],
      },
    });

    return !!conflict;
  }

  public async createHoldInTx(
    tx: Prisma.TransactionClient,
    data: CreateHoldParams
  ): Promise<Appointment> {
    return tx.appointment.create({
      data: {
        patientId: data.patientId,
        therapistId: data.therapistId,
        bookingType: data.bookingType,
        seriesId: data.seriesId,
        recurrenceFrequency: data.recurrenceFrequency,
        recurrenceEndDate: data.recurrenceEndDate,
        startTime: data.startTime,
        endTime: data.endTime,
        appointmentStatus: AppointmentStatus.HOLD,
        paymentStatus: PaymentStatus.PENDING,
        holdExpiresAt: data.holdExpiresAt,
      },
    });
  }

  public async findById(id: string): Promise<Appointment | null> {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        therapist: { select: { id: true, name: true, email: true } },
      },
    });
  }

  public async updateStatus(
    id: string,
    appointmentStatus: AppointmentStatus,
    paymentStatus?: PaymentStatus
  ): Promise<Appointment> {
    const data: Prisma.AppointmentUpdateInput = { appointmentStatus };
    if (paymentStatus) {
      data.paymentStatus = paymentStatus;
    }
    return prisma.appointment.update({
      where: { id },
      data,
    });
  }

  public async updateSeriesStatus(
    seriesId: string,
    appointmentStatus: AppointmentStatus
  ): Promise<Prisma.BatchPayload> {
    return prisma.appointment.updateMany({
      where: { seriesId },
      data: { appointmentStatus },
    });
  }

  public async findByTherapist(
    therapistId: string,
    status?: AppointmentStatus,
    paginationParams?: PaginationParams
  ): Promise<any> {
    const where: Prisma.AppointmentWhereInput = { therapistId };
    if (status) {
      where.appointmentStatus = status;
    } else {
      where.appointmentStatus = {
        notIn: [AppointmentStatus.HOLD, AppointmentStatus.HOLD_EXPIRED, AppointmentStatus.PAYMENT_FAILED],
      };
    }

    const { page, limit, skip, take } = paginationParams || {};

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          patient: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startTime: 'asc' },
        ...(skip !== undefined ? { skip } : {}),
        ...(take !== undefined ? { take } : {}),
      }),
      prisma.appointment.count({ where }),
    ]);

    return formatPaginatedResult(appointments, total, page, limit);
  }

  public async findByPatient(
    patientId: string,
    status?: AppointmentStatus,
    paginationParams?: PaginationParams
  ): Promise<any> {
    const where: Prisma.AppointmentWhereInput = { patientId };
    if (status) where.appointmentStatus = status;

    const { page, limit, skip, take } = paginationParams || {};

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          therapist: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startTime: 'asc' },
        ...(skip !== undefined ? { skip } : {}),
        ...(take !== undefined ? { take } : {}),
      }),
      prisma.appointment.count({ where }),
    ]);

    return formatPaginatedResult(appointments, total, page, limit);
  }

  // ─── Dashboard-specific query methods ───────────────────────────────────────

  public async countByPatientStatuses(
    patientId: string,
    statuses: AppointmentStatus[]
  ): Promise<number> {
    return prisma.appointment.count({
      where: {
        patientId,
        appointmentStatus: { in: statuses },
      },
    });
  }

  public async countByTherapistStatuses(
    therapistId: string,
    statuses: AppointmentStatus[]
  ): Promise<number> {
    return prisma.appointment.count({
      where: {
        therapistId,
        appointmentStatus: { in: statuses },
      },
    });
  }

  public async countDistinctTherapists(patientId: string): Promise<number> {
    const result = await prisma.appointment.findMany({
      where: {
        patientId,
        appointmentStatus: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED],
        },
      },
      select: { therapistId: true },
      distinct: ['therapistId'],
    });
    return result.length;
  }

  public async countDistinctPatients(therapistId: string): Promise<number> {
    const result = await prisma.appointment.findMany({
      where: {
        therapistId,
        appointmentStatus: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED],
        },
      },
      select: { patientId: true },
      distinct: ['patientId'],
    });
    return result.length;
  }

  public async findUpcomingForPatient(patientId: string, limit: number = 5) {
    const now = new Date();
    return prisma.appointment.findMany({
      where: {
        patientId,
        startTime: { gt: now },
        appointmentStatus: { in: [AppointmentStatus.SCHEDULED] },
      },
      include: {
        therapist: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });
  }

  public async findUpcomingForTherapist(therapistId: string, limit: number = 5) {
    const now = new Date();
    return prisma.appointment.findMany({
      where: {
        therapistId,
        startTime: { gt: now },
        appointmentStatus: { in: [AppointmentStatus.SCHEDULED] },
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });
  }

  public async findActiveHoldsForPatient(patientId: string) {
    const now = new Date();
    return prisma.appointment.findMany({
      where: {
        patientId,
        appointmentStatus: AppointmentStatus.HOLD,
        holdExpiresAt: { gt: now },
      },
      include: {
        therapist: { select: { id: true, name: true, email: true } },
      },
      orderBy: { holdExpiresAt: 'asc' },
    });
  }

  public async findTodayAppointments(therapistId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return prisma.appointment.findMany({
      where: {
        therapistId,
        startTime: { gte: todayStart, lte: todayEnd },
        appointmentStatus: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED] },
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  public async findRecentForPatient(patientId: string, limit: number = 5) {
    const now = new Date();
    return prisma.appointment.findMany({
      where: {
        patientId,
        startTime: { lt: now },
        appointmentStatus: {
          in: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
      include: {
        therapist: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'desc' },
      take: limit,
    });
  }

  public async findRecentForTherapist(therapistId: string, limit: number = 5) {
    const now = new Date();
    return prisma.appointment.findMany({
      where: {
        therapistId,
        startTime: { lt: now },
        appointmentStatus: {
          in: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'desc' },
      take: limit,
    });
  }

  public async countPendingHoldsForTherapist(therapistId: string): Promise<number> {
    const now = new Date();
    return prisma.appointment.count({
      where: {
        therapistId,
        appointmentStatus: AppointmentStatus.HOLD,
        holdExpiresAt: { gt: now },
      },
    });
  }
}
