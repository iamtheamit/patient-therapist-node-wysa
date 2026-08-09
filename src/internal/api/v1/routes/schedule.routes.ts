import { Router } from 'express';
import { ScheduleController } from '../controllers/scheduleController';
import { AppointmentController } from '../controllers/appointmentController';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';

export const scheduleRouter = Router();
const controller = new ScheduleController();
const appointmentController = new AppointmentController();

scheduleRouter.get('/:therapistId/agenda', authenticateToken, requireRole('THERAPIST', 'ADMIN'), appointmentController.getTherapistAppointments.bind(appointmentController));
scheduleRouter.get('/:therapistId/schedule-config', authenticateToken, requireRole('THERAPIST', 'ADMIN'), controller.getSchedule.bind(controller));
scheduleRouter.put('/:therapistId/schedule-config', authenticateToken, requireRole('THERAPIST', 'ADMIN'), controller.updateSchedule.bind(controller));
scheduleRouter.get('/:therapistId?', authenticateToken, requireRole('THERAPIST', 'ADMIN'), controller.getSchedule.bind(controller));
scheduleRouter.put('/', authenticateToken, requireRole('THERAPIST', 'ADMIN'), controller.updateSchedule.bind(controller));
