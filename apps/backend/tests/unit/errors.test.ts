import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  BadGatewayError,
} from '../../src/utils/errors.js';

describe('Error Hierarchy Unit Tests', () => {
  it('should initialize AppError with expected defaults', () => {
    const error = new AppError('Server error', 500, 'CUSTOM_ERROR', ['detail']);
    expect(error.message).toBe('Server error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('CUSTOM_ERROR');
    expect(error.details).toEqual(['detail']);
    expect(error.isOperational).toBe(true);
  });

  it('should instantiate NotFoundError as 404', () => {
    const error = new NotFoundError('Item not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should instantiate UnauthorizedError as 401', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should instantiate ForbiddenError as 403', () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('should instantiate ValidationError as 400', () => {
    const error = new ValidationError('Bad request', [{ field: 'email' }]);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toHaveLength(1);
  });

  it('should instantiate ConflictError as 409', () => {
    const error = new ConflictError('Duplicate key');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
  });

  it('should instantiate BadGatewayError as 502', () => {
    const error = new BadGatewayError();
    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('BAD_GATEWAY');
  });
});
