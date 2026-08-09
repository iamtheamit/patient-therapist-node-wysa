import { Router } from 'express';
import { TherapistController } from '../controllers/therapistController';
import { ScheduleController } from '../controllers/scheduleController';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';

export const therapistRouter = Router();
const controller = new TherapistController();
const scheduleController = new ScheduleController();

therapistRouter.get('/', authenticateToken, controller.getAll.bind(controller));
therapistRouter.get('/:therapistId/stats', authenticateToken, controller.getStats.bind(controller));
therapistRouter.get('/:therapistId/schedule-config', authenticateToken, scheduleController.getSchedule.bind(scheduleController));
therapistRouter.put(
  '/:therapistId/schedule-config',
  authenticateToken,
  requireRole('THERAPIST', 'ADMIN'),
  scheduleController.updateSchedule.bind(scheduleController)
);

