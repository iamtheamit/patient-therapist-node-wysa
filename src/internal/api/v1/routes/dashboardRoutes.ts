import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticateToken } from '../../../middleware/authMiddleware';

export const dashboardRouter = Router();
const controller = new DashboardController();

// GET /api/v1/dashboard — Role-aware aggregated dashboard data
dashboardRouter.get('/', authenticateToken, controller.getDashboard.bind(controller));
