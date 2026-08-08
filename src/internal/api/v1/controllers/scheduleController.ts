import { Request, Response, NextFunction } from 'express';
import { ScheduleService } from '../../../services/scheduleService';
import { updateScheduleSchema } from '../../../validators/scheduleValidator';
import { sendSuccess } from '../../../shared/responses';
import { BadRequestError } from '../../../shared/errors';
import { SCHEDULE_MESSAGES } from '../../../shared/constants';

const service = new ScheduleService();

const DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

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
      
      let schedulesPayload = req.body.schedules;

      // Handle weeklyRules format if sent by frontend form
      if (!schedulesPayload && Array.isArray(req.body.weeklyRules)) {
        const slotDuration = req.body.slotDurationMinutes || 30;
        schedulesPayload = req.body.weeklyRules
          .filter((rule: any) => rule.isEnabled)
          .map((rule: any) => ({
            dayOfWeek: DAY_MAP[rule.day] ?? 1,
            startTime: rule.startTime,
            endTime: rule.endTime,
            slotDuration,
            isActive: true,
          }));
      }

      const parsed = updateScheduleSchema.parse({ schedules: schedulesPayload || [] });
      const updated = await service.updateTherapistSchedule(therapistId, parsed.schedules);
      sendSuccess(res, updated, SCHEDULE_MESSAGES.UPDATE_SUCCESS, 200);
    } catch (err) {
      next(err);
    }
  }
}

