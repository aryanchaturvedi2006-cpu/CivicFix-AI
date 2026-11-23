import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.util.js';
import { logger } from '../utils/logger.util.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Capture request contextual metadata (omit passwords/tokens)
  const reqContext = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  };

  // 1. Handled Domain AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`Server error during ${req.method} ${req.originalUrl}: ${err.message}`, err, reqContext);
    } else {
      logger.warn(`Operational warning during ${req.method} ${req.originalUrl}: ${err.message}`, {
        code: err.code,
        statusCode: err.statusCode,
        ...reqContext,
      });
    }

    sendError(res, err.message, err.statusCode, err.code, err.details);
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedDetails = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    logger.warn(`Validation failure on ${req.method} ${req.originalUrl}`, { details: formattedDetails, ...reqContext });
    sendError(res, 'Request validation failed', 400, 'VALIDATION_ERROR', formattedDetails);
    return;
  }

  // 3. Malformed JSON Body
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn(`Malformed JSON body on ${req.method} ${req.originalUrl}`, reqContext);
    sendError(res, 'Malformed JSON in request payload', 400, 'INVALID_JSON_BODY');
    return;
  }

  // 4. Prisma Specific Error handling (P2002: unique constraint, P2025: record not found)
  if (err && typeof err === 'object' && 'code' in err) {
    const prismaCode = (err as { code: string }).code;
    if (prismaCode === 'P2002') {
      const meta = (err as { meta?: { target?: string[] } }).meta;
      const fields = meta?.target ? meta.target.join(', ') : 'field';
      logger.warn(`Prisma unique constraint failure on [${fields}]`, reqContext);
      sendError(res, `A record with this ${fields} already exists`, 409, 'DUPLICATE_RESOURCE');
      return;
    }
    if (prismaCode === 'P2025') {
      logger.warn(`Prisma record not found`, reqContext);
      sendError(res, 'The requested database record does not exist', 404, 'RECORD_NOT_FOUND');
      return;
    }
  }

  // 5. Unhandled / Unexpected Errors
  logger.error(`Unhandled internal server error: ${err.message}`, err, reqContext);

  const safeMessage = env.NODE_ENV === 'production'
    ? 'An unexpected internal server error occurred'
    : err.message;

  sendError(res, safeMessage, 500, 'INTERNAL_SERVER_ERROR');
}
