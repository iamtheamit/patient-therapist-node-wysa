import { Router } from 'express';
import { ScheduleController } from '../controllers/scheduleController';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';

export const scheduleRouter = Router();
const controller = new ScheduleController();

scheduleRouter.get('/:therapistId?', authenticateToken, controller.getSchedule.bind(controller));
scheduleRouter.put('/', authenticateToken, requireRole('THERAPIST', 'ADMIN'), controller.updateSchedule.bind(controller));
