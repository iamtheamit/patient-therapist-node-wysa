import { Router } from 'express';
import { therapistRouter } from './therapistRoutes';


export const scheduleRouter = Router();

// Forward /api/v1/therapist/schedules requests to canonical therapist router
scheduleRouter.use('/', therapistRouter);
