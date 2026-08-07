import { Request, Response, NextFunction } from 'express';
import { AvailabilityService } from '../../../services/availabilityService';
import { AppointmentService } from '../../../services/appointmentService';
import {
  getAvailabilityQuerySchema,
  holdSlotSchema,
  simulatePaymentSchema,
  updateAppointmentStatusSchema,
} from '../../../validators/appointmentValidator';
import { AppointmentStatus } from '@prisma/client';

const availabilityService = new AvailabilityService();
const appointmentService = new AppointmentService();

export class AppointmentController {
  public async getAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = getAvailabilityQuerySchema.parse({
        therapistId: req.query.therapistId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });

      const slots = await availabilityService.getAvailableSlots(
        parsed.therapistId,
        parsed.startDate,
        parsed.endDate
      );

      res.status(200).json(slots);
    } catch (err) {
      next(err);
    }
  }

  public async holdSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.user!.id;
      const parsed = holdSlotSchema.parse(req.body);
      const appointments = await appointmentService.holdSlot(patientId, parsed);
      res.status(201).json(appointments);
    } catch (err) {
      next(err);
    }
  }

  public async pay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.user!.id;
      const appointmentId = req.params.id;
      const parsed = simulatePaymentSchema.parse(req.body);
      const result = await appointmentService.simulatePayment(patientId, appointmentId, parsed);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public async cancelAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const appointmentId = req.params.id;
      const cancelled = await appointmentService.cancelAppointment(userId, role, appointmentId);
      res.status(200).json(cancelled);
    } catch (err) {
      next(err);
    }
  }

  public async cancelSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const seriesId = req.params.seriesId;
      const result = await appointmentService.cancelSeries(userId, role, seriesId);
      res.status(200).json({ message: 'Recurring series cancelled successfully', count: result.count });
    } catch (err) {
      next(err);
    }
  }

  public async updateStatusByTherapist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.user!.id;
      const appointmentId = req.params.id;
      const parsed = updateAppointmentStatusSchema.parse(req.body);
      const updated = await appointmentService.updateAppointmentStatusByTherapist(therapistId, appointmentId, parsed);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  public async getTherapistAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.user!.id;
      const status = req.query.status as AppointmentStatus | undefined;
      const list = await appointmentService.getTherapistAppointments(therapistId, status);
      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  }

  public async getPatientAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.user!.id;
      const status = req.query.status as AppointmentStatus | undefined;
      const list = await appointmentService.getPatientAppointments(patientId, status);
      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  }
}
