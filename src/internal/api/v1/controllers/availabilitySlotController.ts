import { Request, Response, NextFunction } from 'express';
import { AvailabilitySlotService } from '../../../services/availabilitySlotService';
import { createAvailabilitySlotSchema } from '../../../validators/availabilitySlotValidator';
import { sendSuccess } from '../../../shared/responses';
import { BadRequestError } from '../../../shared/errors';
import { parsePaginationParams } from '../../../shared/helpers/pagination';

const service = new AvailabilitySlotService();

export class AvailabilitySlotController {
  public async createSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.user!.id;
      const parsed = createAvailabilitySlotSchema.parse(req.body);
      const slot = await service.createSlot(therapistId, parsed);
      sendSuccess(res, slot, 'Availability slot created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  public async getSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.params.therapistId || req.user?.id;
      if (!therapistId) {
        throw new BadRequestError('Therapist ID is required.');
      }
      const date = req.query.date as string | undefined;
      const paginationParams = parsePaginationParams(req.query);
      const slots = await service.getSlots(therapistId, date, paginationParams);
      sendSuccess(res, slots, 'Availability slots retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public async deleteSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.user!.id;
      const slotId = req.params.id;
      const deleted = await service.deleteSlot(slotId, therapistId);
      sendSuccess(res, deleted, 'Availability slot deleted successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}
