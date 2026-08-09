import { Request, Response, NextFunction } from 'express';
import { TherapistService } from '../../../services/therapistService';
import { sendSuccess } from '../../../shared/responses';
import { THERAPIST_MESSAGES, HttpStatus } from '../../../shared/constants';
import { parsePaginationParams } from '../../../shared/helpers/pagination';
import { ForbiddenError } from '../../../shared/errors';

const service = new TherapistService();

export class TherapistController {
  public async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paginationParams = parsePaginationParams(req.query);
      const result = await service.getAllTherapists(paginationParams);
      sendSuccess(res, result, THERAPIST_MESSAGES.FETCH_ALL_SUCCESS, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  }

  public async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const therapistId = req.params.therapistId;

      if (req.user?.role !== 'ADMIN' && req.user?.id !== therapistId) {
        throw new ForbiddenError('You do not have permission to access this therapist statistics.');
      }

      const stats = await service.getTherapistStats(therapistId);
      sendSuccess(res, stats, THERAPIST_MESSAGES.FETCH_ALL_SUCCESS, HttpStatus.OK);
    } catch (err) {
      next(err);
    }
  }
}


