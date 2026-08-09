import { Router } from 'express';
import { authRouter } from './auth.routes';
import { scheduleRouter } from './schedule.routes';
import { appointmentRouter } from './appointment.routes';
import { availabilitySlotRouter } from './availabilitySlot.routes';
import { therapistRouter } from './therapist.routes';
import { dashboardRouter } from './dashboard.routes';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/therapist/schedules', scheduleRouter);
v1Router.use('/therapist/availability-slots', availabilitySlotRouter);
v1Router.use('/therapists', therapistRouter);
v1Router.use('/appointments', appointmentRouter);
v1Router.use('/dashboard', dashboardRouter);

