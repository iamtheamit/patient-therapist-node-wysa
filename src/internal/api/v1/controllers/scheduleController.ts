import { Request, Response, NextFunction } from 'express';
import { ScheduleService } from '../../../services/scheduleService';
import { updateScheduleSchema } from '../../../validators/scheduleValidator';

const service = new ScheduleService();

export class ScheduleController {
  public async getSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.params.therapistId || req.user?.id;
      if (!therapistId) {
        res.status(400).json({ error: 'Therapist ID required' });
        return;
      }
      const schedule = await service.getTherapistSchedule(therapistId);
      res.status(200).json(schedule);
    } catch (err) {
      next(err);
    }
  }

  public async updateSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.user!.id;
      const parsed = updateScheduleSchema.parse(req.body);
      const updated = await service.updateTherapistSchedule(therapistId, parsed.schedules);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
}
