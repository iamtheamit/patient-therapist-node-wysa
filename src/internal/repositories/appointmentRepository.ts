import { prisma } from '../infrastructure/database/prismaClient';
import { Appointment, AppointmentStatus, PaymentStatus, BookingType, RecurrenceFrequency, Prisma } from '@prisma/client';

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
    status?: AppointmentStatus
  ): Promise<Appointment[]> {
    const where: Prisma.AppointmentWhereInput = { therapistId };
    if (status) where.appointmentStatus = status;

    return prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  public async findByPatient(
    patientId: string,
    status?: AppointmentStatus
  ): Promise<Appointment[]> {
    const where: Prisma.AppointmentWhereInput = { patientId };
    if (status) where.appointmentStatus = status;

    return prisma.appointment.findMany({
      where,
      include: {
        therapist: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }
}
