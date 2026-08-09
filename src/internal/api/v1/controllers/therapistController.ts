import { Request, Response, NextFunction } from 'express';
import { TherapistService } from '../../../services/therapistService';
import { sendSuccess } from '../../../shared/responses';
import { THERAPIST_MESSAGES } from '../../../shared/constants';
import { parsePaginationParams } from '../../../shared/helpers/pagination';

const service = new TherapistService();

export class TherapistController {
  public async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paginationParams = parsePaginationParams(req.query);
      const result = await service.getAllTherapists(paginationParams);
      sendSuccess(res, result, THERAPIST_MESSAGES.FETCH_ALL_SUCCESS, 200);
    } catch (err) {
      next(err);
    }
  }

  public async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(
        res,
        {
          todaySessionsCount: 2,
          pendingConfirmationsCount: 1,
          activePatientsCount: 12,
        },
        THERAPIST_MESSAGES.FETCH_ALL_SUCCESS,
        200
      );
    } catch (err) {
      next(err);
    }
  }
}
