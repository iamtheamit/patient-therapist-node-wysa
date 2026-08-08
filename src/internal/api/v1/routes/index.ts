import { Router } from 'express';
import { authRouter } from './auth.routes';
import { scheduleRouter } from './schedule.routes';
import { appointmentRouter } from './appointment.routes';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/therapist/schedules', scheduleRouter);
v1Router.use('/therapists', scheduleRouter);
v1Router.use('/appointments', appointmentRouter);
