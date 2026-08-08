import { Router } from 'express';
import { ScheduleController } from '../controllers/scheduleController';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';

export const scheduleRouter = Router();
const controller = new ScheduleController();

scheduleRouter.get('/:therapistId/schedule-config', authenticateToken, controller.getSchedule.bind(controller));
scheduleRouter.put('/:therapistId/schedule-config', authenticateToken, requireRole('THERAPIST', 'ADMIN'), controller.updateSchedule.bind(controller));
scheduleRouter.get('/:therapistId?', authenticateToken, controller.getSchedule.bind(controller));
scheduleRouter.put('/', authenticateToken, requireRole('THERAPIST', 'ADMIN'), controller.updateSchedule.bind(controller));
