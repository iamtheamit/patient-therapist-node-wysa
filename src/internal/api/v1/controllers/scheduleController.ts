import { Request, Response, NextFunction } from 'express';
import { ScheduleService } from '../../../services/scheduleService';
import { updateScheduleSchema } from '../../../validators/scheduleValidator';
import { sendSuccess } from '../../../shared/responses';
import { BadRequestError } from '../../../shared/errors';

const service = new ScheduleService();

export class ScheduleController {
  public async getSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.params.therapistId || req.user?.id;
      if (!therapistId) {
        throw new BadRequestError('Therapist ID required');
      }
      const schedule = await service.getTherapistSchedule(therapistId);
      sendSuccess(res, schedule, 'Therapist schedule retrieved successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  public async updateSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.user!.id;
      const parsed = updateScheduleSchema.parse(req.body);
      const updated = await service.updateTherapistSchedule(therapistId, parsed.schedules);
      sendSuccess(res, updated, 'Therapist schedule updated successfully', 200);
    } catch (err) {
      next(err);
    }
  }
}

