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
import { sendSuccess } from '../../../shared/responses';
import { APPOINTMENT_MESSAGES } from '../../../shared/constants';
import { parsePaginationParams } from '../../../shared/helpers/pagination';
import { ForbiddenError } from '../../../shared/errors';

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
      const paginationParams = parsePaginationParams(req.query);

      const slots = await availabilityService.getAvailableSlots(
        parsed.therapistId,
        parsed.startDate,
        parsed.endDate,
        paginationParams
      );

      sendSuccess(res, slots, APPOINTMENT_MESSAGES.AVAILABILITY_SUCCESS, 200);
    } catch (err) {
      next(err);
    }
  }

  public async holdSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.user!.id;
      const parsed = holdSlotSchema.parse(req.body);
      const appointments = await appointmentService.holdSlot(patientId, parsed);
      sendSuccess(res, appointments, APPOINTMENT_MESSAGES.HOLD_SUCCESS, 201);
    } catch (err) {
      next(err);
    }
  }

  public async releaseHold(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.user!.id;
      const holdId = req.params.holdId;
      const result = await appointmentService.releaseHold(patientId, holdId);
      sendSuccess(res, result, 'Slot hold released successfully', 200);
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
      sendSuccess(res, result, APPOINTMENT_MESSAGES.PAYMENT_SUCCESS, 200);
    } catch (err) {
      next(err);
    }
  }

  public async confirmSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.user!.id;
      const { seriesId } = req.params;
      const { notes } = req.body as { notes?: string };
      const confirmed = await appointmentService.confirmSeries(patientId, seriesId, notes);
      sendSuccess(
        res,
        {
          seriesId,
          confirmedCount: confirmed.length,
          appointments: confirmed.map((a) => ({ id: a.id, startTime: a.startTime, endTime: a.endTime })),
        },
        APPOINTMENT_MESSAGES.PAYMENT_SUCCESS,
        200
      );
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
      sendSuccess(res, cancelled, APPOINTMENT_MESSAGES.CANCEL_SUCCESS, 200);
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
      sendSuccess(res, { count: result.count }, APPOINTMENT_MESSAGES.CANCEL_SERIES_SUCCESS, 200);
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
      sendSuccess(res, updated, APPOINTMENT_MESSAGES.STATUS_UPDATE_SUCCESS, 200);
    } catch (err) {
      next(err);
    }
  }

  public async getTherapistAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.params.therapistId || req.user!.id;
      if (req.user?.role === 'THERAPIST' && req.user.id !== therapistId) {
        throw new ForbiddenError('You do not have permission to access this therapist agenda.');
      }
      const filters = {
        search: req.query.search as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as string | undefined,
      };
      const paginationParams = parsePaginationParams(req.query);
      const list = await appointmentService.getTherapistAppointments(therapistId, filters, paginationParams);
      sendSuccess(res, list, APPOINTMENT_MESSAGES.THERAPIST_FETCH_SUCCESS, 200);
    } catch (err) {
      next(err);
    }
  }

  public async getPatientAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = req.user!.id;
      const filters = {
        search: req.query.search as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as string | undefined,
      };
      const paginationParams = parsePaginationParams(req.query);
      const list = await appointmentService.getPatientAppointments(patientId, filters, paginationParams);
      sendSuccess(res, list, APPOINTMENT_MESSAGES.PATIENT_FETCH_SUCCESS, 200);
    } catch (err) {
      next(err);
    }
  }
}

