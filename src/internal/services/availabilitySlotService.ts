import { AvailabilitySlotRepository, CreateAvailabilitySlotParams } from '../repositories/availabilitySlotRepository';
import { BadRequestError, NotFoundError, ForbiddenError } from '../shared/errors';
import { PaginationParams } from '../shared/helpers/pagination';

const repo = new AvailabilitySlotRepository();

export class AvailabilitySlotService {
  public async createSlot(therapistId: string, params: Omit<CreateAvailabilitySlotParams, 'therapistId'>) {
    const [startH, startM] = params.startTime.split(':').map(Number);
    const [endH, endM] = params.endTime.split(':').map(Number);

    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    if (endMin <= startMin) {
      throw new BadRequestError('End time must be after start time.');
    }

    return repo.createSlot({
      therapistId,
      ...params,
    });
  }

  public async getSlots(therapistId: string, date?: string, paginationParams?: PaginationParams) {
    return repo.findByTherapistId(therapistId, date, paginationParams);
  }

  public async deleteSlot(slotId: string, therapistId: string) {
    const slot = await repo.findById(slotId);
    if (!slot) {
      throw new NotFoundError('Availability slot not found.');
    }
    if (slot.therapistId !== therapistId) {
      throw new ForbiddenError('You can only delete your own availability slots.');
    }

    return repo.deleteSlot(slotId, therapistId);
  }
}
