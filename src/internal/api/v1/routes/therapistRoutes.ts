import { Router } from 'express';
import { TherapistController } from '../controllers/therapistController';
import { ScheduleController } from '../controllers/scheduleController';
import { AppointmentController } from '../controllers/appointmentController';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';

export const therapistRouter = Router();
const controller = new TherapistController();
const scheduleController = new ScheduleController();
const appointmentController = new AppointmentController();

// Therapist Resource Endpoints
therapistRouter.get('/', authenticateToken, controller.getAll.bind(controller));
therapistRouter.get('/:therapistId/stats', authenticateToken, controller.getStats.bind(controller));

// Schedule Configuration Endpoints (Canonical)
therapistRouter.get(
  '/:therapistId/schedule-config',
  authenticateToken,
  requireRole('THERAPIST', 'ADMIN'),
  scheduleController.getSchedule.bind(scheduleController)
);
therapistRouter.put(
  '/:therapistId/schedule-config',
  authenticateToken,
  requireRole('THERAPIST', 'ADMIN'),
  scheduleController.updateSchedule.bind(scheduleController)
);

// Therapist Agenda Endpoint
therapistRouter.get(
  '/:therapistId/agenda',
  authenticateToken,
  requireRole('THERAPIST'),
  appointmentController.getTherapistAppointments.bind(appointmentController)
);


