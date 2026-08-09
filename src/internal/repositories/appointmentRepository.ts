import { prisma } from '../infrastructure/database/prismaClient';
import { Appointment, AppointmentStatus, PaymentStatus, BookingType, RecurrenceFrequency, Prisma } from '@prisma/client';
import { PaginationParams, formatPaginatedResult } from '../shared/helpers/pagination';

import { generateSlotLockKey } from '../shared/helpers/lockHelper';

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

export interface AppointmentFilterParams {
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export class AppointmentRepository {
  public async acquireSlotLock(
    tx: Prisma.TransactionClient,
    therapistId: string,
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    const { key1, key2 } = generateSlotLockKey(therapistId, startTime, endTime);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key1}::integer, ${key2}::integer)`;
  }

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

  public async findById(id: string, tx?: Prisma.TransactionClient): Promise<Appointment | null> {
    const client = tx || prisma;
    return client.appointment.findUnique({
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
    paymentStatus?: PaymentStatus,
    tx?: Prisma.TransactionClient
  ): Promise<Appointment> {
    const client = tx || prisma;
    const data: Prisma.AppointmentUpdateInput = { appointmentStatus };
    if (paymentStatus) {
      data.paymentStatus = paymentStatus;
    }
    return client.appointment.update({
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
    filters?: AppointmentFilterParams | AppointmentStatus,
    paginationParams?: PaginationParams
  ): Promise<any> {
    const where: Prisma.AppointmentWhereInput = { therapistId };
    const filterObj = typeof filters === 'string' ? { status: filters } : filters;

    if (filterObj?.status) {
      if (Object.values(AppointmentStatus).includes(filterObj.status as any)) {
        where.appointmentStatus = filterObj.status as AppointmentStatus;
      }
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
    filters?: AppointmentFilterParams | AppointmentStatus,
    paginationParams?: PaginationParams
  ): Promise<any> {
    const where: Prisma.AppointmentWhereInput = { patientId };
    const now = new Date();
    const filterObj = typeof filters === 'string' ? { status: filters } : filters;

    if (filterObj?.status) {
      const s = filterObj.status;
      if (s === 'upcoming') {
        where.startTime = { gte: now };
        where.appointmentStatus = { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED] };
      } else if (s === 'past') {
        where.OR = [
          { startTime: { lt: now } },
          { appointmentStatus: { in: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED] } },
        ];
      } else if (s === 'holds') {
        where.appointmentStatus = AppointmentStatus.HOLD;
        where.holdExpiresAt = { gt: now };
      } else if (s === 'failed') {
        where.OR = [
          { appointmentStatus: { in: [AppointmentStatus.HOLD_EXPIRED, AppointmentStatus.PAYMENT_FAILED] } },
          { appointmentStatus: AppointmentStatus.HOLD, holdExpiresAt: { lte: now } },
        ];
      } else if (Object.values(AppointmentStatus).includes(s as any)) {
        where.appointmentStatus = s as AppointmentStatus;
      }
    }

    if (filterObj?.startDate || filterObj?.endDate) {
      const dateCond: Prisma.DateTimeFilter = {};
      if (filterObj.startDate) {
        const parts = filterObj.startDate.split('-').map(Number);
        dateCond.gte = parts.length === 3 && !isNaN(parts[0])
          ? new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
          : new Date(filterObj.startDate);
      }
      if (filterObj.endDate) {
        const parts = filterObj.endDate.split('-').map(Number);
        dateCond.lte = parts.length === 3 && !isNaN(parts[0])
          ? new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999)
          : new Date(filterObj.endDate);
      }
      where.startTime = {
        ...(typeof where.startTime === 'object' ? where.startTime : {}),
        ...dateCond,
      };
    }

    if (filterObj?.search) {
      const term = filterObj.search.trim();
      if (term) {
        where.AND = [
          {
            OR: [
              { therapist: { name: { contains: term, mode: 'insensitive' } } },
              { therapist: { email: { contains: term, mode: 'insensitive' } } },
            ],
          },
        ];
      }
    }

    const { page, limit, skip, take } = paginationParams || {};

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          therapist: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startTime: 'desc' },
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
