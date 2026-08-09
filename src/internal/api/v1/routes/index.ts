import { Router } from 'express';
import { authRouter } from './authRoutes';
import { scheduleRouter } from './scheduleRoutes';
import { appointmentRouter } from './appointmentRoutes';
import { therapistRouter } from './therapistRoutes';
import { dashboardRouter } from './dashboardRoutes';


export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/therapist/schedules', scheduleRouter);
v1Router.use('/therapists', therapistRouter);
v1Router.use('/appointments', appointmentRouter);
v1Router.use('/dashboard', dashboardRouter);

