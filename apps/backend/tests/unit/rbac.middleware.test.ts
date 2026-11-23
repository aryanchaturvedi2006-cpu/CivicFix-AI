import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { authorize, requireOwnershipOrRole } from '../../src/middlewares/auth.middleware.js';
import { Role } from '../../src/constants/roles.js';
import { UnauthorizedError, ForbiddenError } from '../../src/utils/errors.js';

describe('RBAC & Ownership Middleware Unit Tests', () => {
  describe('authorize()', () => {
    it('should call next() if user has an authorized role', () => {
      const req = {
        user: { id: 'usr-1', email: 'officer@civicfix.gov', role: Role.AUTHORITY },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const middleware = authorize([Role.AUTHORITY, Role.ADMIN]);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should throw ForbiddenError if user role is not in the whitelist', () => {
      const req = {
        user: { id: 'usr-1', email: 'citizen@example.com', role: Role.CITIZEN },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const middleware = authorize([Role.AUTHORITY, Role.ADMIN]);
      expect(() => middleware(req, res, next)).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedError if user is not authenticated', () => {
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn();

      const middleware = authorize([Role.CITIZEN]);
      expect(() => middleware(req, res, next)).toThrow(UnauthorizedError);
    });
  });

  describe('requireOwnershipOrRole()', () => {
    const ownerExtractor = (req: Request) => req.params['citizenId'];

    it('should grant access to the actual resource owner', () => {
      const req = {
        user: { id: 'usr-owner', role: Role.CITIZEN },
        params: { citizenId: 'usr-owner' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const middleware = requireOwnershipOrRole(ownerExtractor);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should grant access to ADMIN or AUTHORITY even if not owner', () => {
      const req = {
        user: { id: 'admin-id', role: Role.ADMIN },
        params: { citizenId: 'usr-owner' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const middleware = requireOwnershipOrRole(ownerExtractor);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject a different CITIZEN trying to access another citizen resource', () => {
      const req = {
        user: { id: 'intruder-id', role: Role.CITIZEN },
        params: { citizenId: 'usr-owner' },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      const middleware = requireOwnershipOrRole(ownerExtractor);
      expect(() => middleware(req, res, next)).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
