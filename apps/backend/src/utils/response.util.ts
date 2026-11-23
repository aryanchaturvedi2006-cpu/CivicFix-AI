import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: PaginationMeta | Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: PaginationMeta | Record<string, unknown>
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
  return res.status(statusCode).json(response);
}

export function sendCreated<T>(
  res: Response,
  data: T,
  meta?: Record<string, unknown>
): Response {
  return sendSuccess(res, data, 201, meta);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  code = 'INTERNAL_SERVER_ERROR',
  details: unknown[] = []
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details.length > 0 ? { details } : {}),
    },
  };
  return res.status(statusCode).json(response);
}
