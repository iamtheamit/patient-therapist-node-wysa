import { Request, Response, NextFunction } from 'express';
import { ScheduleService } from '../../../services/scheduleService';
import { updateScheduleSchema } from '../../../validators/scheduleValidator';
import { sendSuccess } from '../../../shared/responses';
import { BadRequestError } from '../../../shared/errors';
import { SCHEDULE_MESSAGES } from '../../../shared/constants';

const service = new ScheduleService();

export class ScheduleController {
  public async getSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.params.therapistId || req.user?.id;
      if (!therapistId) {
        throw new BadRequestError(SCHEDULE_MESSAGES.THERAPIST_ID_REQUIRED);
      }
      const schedule = await service.getTherapistSchedule(therapistId);
      sendSuccess(res, schedule, SCHEDULE_MESSAGES.FETCH_SUCCESS, 200);
    } catch (err) {
      next(err);
    }
  }

  public async updateSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.user!.id;
      const parsed = updateScheduleSchema.parse(req.body);
      const updated = await service.updateTherapistSchedule(therapistId, parsed.schedules);
      sendSuccess(res, updated, SCHEDULE_MESSAGES.UPDATE_SUCCESS, 200);
    } catch (err) {
      next(err);
    }
  }
}

