import { Request, Response, NextFunction } from 'express';

// TODO: Implement appointment-related endpoint handlers for v1.
export class AppointmentController {
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    // TODO: delegate to service layer and send a response.
    next();
  }
}
