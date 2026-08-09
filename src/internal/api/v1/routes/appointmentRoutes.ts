import { Router } from 'express';
import { AppointmentController } from '../controllers/appointmentController';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';
import { idempotencyMiddleware } from '../../../middleware/idempotencyMiddleware';

export const appointmentRouter = Router();
const controller = new AppointmentController();

// Patient Availability (Public / Authenticated)
appointmentRouter.get('/availability', controller.getAvailability.bind(controller));

// Patient Appointment Endpoints
appointmentRouter.post(
  '/hold',
  authenticateToken,
  requireRole('PATIENT'),
  idempotencyMiddleware,
  controller.holdSlot.bind(controller)
);

appointmentRouter.post(
  '/holds/:holdId/release',
  authenticateToken,
  requireRole('PATIENT'),
  controller.releaseHold.bind(controller)
);

appointmentRouter.post(
  '/:id/pay',
  authenticateToken,
  requireRole('PATIENT'),
  idempotencyMiddleware,
  controller.pay.bind(controller)
);

// Atomic series confirmation (recurring bookings)
appointmentRouter.post(
  '/series/:seriesId/pay',
  authenticateToken,
  requireRole('PATIENT'),
  idempotencyMiddleware,
  controller.confirmSeries.bind(controller)
);

appointmentRouter.get(
  '/patient',
  authenticateToken,
  requireRole('PATIENT'),
  controller.getPatientAppointments.bind(controller)
);

// Therapist Appointment Endpoints
appointmentRouter.get(
  '/therapist',
  authenticateToken,
  requireRole('THERAPIST'),
  controller.getTherapistAppointments.bind(controller)
);

appointmentRouter.patch(
  '/:id/status',
  authenticateToken,
  requireRole('THERAPIST', 'ADMIN'),
  controller.updateStatusByTherapist.bind(controller)
);

// Cancellation Endpoints
appointmentRouter.post(
  '/:id/cancel',
  authenticateToken,
  controller.cancelAppointment.bind(controller)
);

appointmentRouter.post(
  '/series/:seriesId/cancel',
  authenticateToken,
  controller.cancelSeries.bind(controller)
);
