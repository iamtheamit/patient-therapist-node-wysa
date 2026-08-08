import { prisma } from '../infrastructure/database/prismaClient';

export interface TherapistAvailabilitySlot {
  id: string;
  therapistId: string;
  date: string;
  startTime: string;
  endTime: string;
  appointmentType?: string | null;
  isRecurring: boolean;
  repeatType?: string | null;
  repeatFrequency?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateAvailabilitySlotParams {
  therapistId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  appointmentType?: string;
  isRecurring?: boolean;
  repeatType?: string;
  repeatFrequency?: string;
}

export class AvailabilitySlotRepository {
  private get model() {
    return (prisma as any).therapistAvailabilitySlot;
  }

  public async createSlot(data: CreateAvailabilitySlotParams): Promise<TherapistAvailabilitySlot> {
    return this.model.create({
      data: {
        therapistId: data.therapistId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        appointmentType: data.appointmentType,
        isRecurring: data.isRecurring ?? false,
        repeatType: data.repeatType,
        repeatFrequency: data.repeatFrequency,
      },
    });
  }

  public async findByTherapistId(therapistId: string, date?: string): Promise<TherapistAvailabilitySlot[]> {
    const where: any = { therapistId };
    if (date) {
      where.date = date;
    }
    return this.model.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  public async findById(id: string): Promise<TherapistAvailabilitySlot | null> {
    return this.model.findUnique({
      where: { id },
    });
  }

  public async deleteSlot(id: string, therapistId: string): Promise<TherapistAvailabilitySlot> {
    return this.model.delete({
      where: { id },
    });
  }
}
