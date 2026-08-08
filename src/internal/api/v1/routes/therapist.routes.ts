import { Router } from 'express';
import { TherapistController } from '../controllers/therapistController';
import { authenticateToken } from '../../../middleware/authMiddleware';

export const therapistRouter = Router();
const controller = new TherapistController();

therapistRouter.get('/', authenticateToken, controller.getAll.bind(controller));
