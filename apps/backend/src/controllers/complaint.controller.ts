import { Request, Response, NextFunction } from 'express';
import { ComplaintService } from '../services/complaint.service.js';
import { UnauthorizedError } from '../utils/errors.js';
import { sendCreated, sendSuccess } from '../utils/response.util.js';

export class ComplaintController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const complaint = await ComplaintService.create(req.body, req.user.id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendCreated(res, complaint);
    } catch (error) {
      next(error);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await ComplaintService.list(req.query as never, req.user);
      sendSuccess(res, result.complaints, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const complaint = await ComplaintService.getById(req.params.id, req.user);
      sendSuccess(res, complaint);
    } catch (error) {
      next(error);
    }
  }

  public static async transition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();
      const complaint = await ComplaintService.transition(
        req.params.id,
        req.body.status,
        req.body.comment,
        req.user,
        { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
      );
      sendSuccess(res, complaint);
    } catch (error) {
      next(error);
    }
  }
}
