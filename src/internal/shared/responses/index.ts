import { Response } from 'express';
import { HttpStatus } from '../constants/httpStatus';

export interface ApiResponse<T = any> {
  status: boolean;
  message: string;
  data: T | null;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message: string = 'Operation completed successfully',
  statusCode: number = HttpStatus.OK
): Response {
  const payload: ApiResponse<T> = {
    status: true,
    message,
    data,
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
  details: any = null
): Response {
  const payload: ApiResponse = {
    status: false,
    message,
    data: details,
  };
  return res.status(statusCode).json(payload);
}


