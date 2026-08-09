import { Router } from 'express';
import { AvailabilitySlotController } from '../controllers/availabilitySlotController';
import { authenticateToken, requireRole } from '../../../middleware/authMiddleware';

export const availabilitySlotRouter = Router();
const controller = new AvailabilitySlotController();

availabilitySlotRouter.post(
  '/',
  authenticateToken,
  requireRole('THERAPIST', 'ADMIN'),
  controller.createSlot.bind(controller)
);

availabilitySlotRouter.get(
  '/:therapistId?',
  authenticateToken,
  requireRole('THERAPIST', 'ADMIN'),
  controller.getSlots.bind(controller)
);

availabilitySlotRouter.delete(
  '/:id',
  authenticateToken,
  requireRole('THERAPIST', 'ADMIN'),
  controller.deleteSlot.bind(controller)
);
