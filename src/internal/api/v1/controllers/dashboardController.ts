import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../../../services/dashboardService';
import { sendSuccess } from '../../../shared/responses';
import { DASHBOARD_MESSAGES } from '../../../shared/constants';

const dashboardService = new DashboardService();

export class DashboardController {
  public async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;

      if (role === 'PATIENT') {
        const data = await dashboardService.getPatientDashboard(userId);
        sendSuccess(res, data, DASHBOARD_MESSAGES.PATIENT_SUCCESS, 200);
      } else {
        const data = await dashboardService.getTherapistDashboard(userId);
        sendSuccess(res, data, DASHBOARD_MESSAGES.THERAPIST_SUCCESS, 200);
      }
    } catch (err) {
      next(err);
    }
  }
}
