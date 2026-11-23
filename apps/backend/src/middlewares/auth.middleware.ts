import { Request, Response, NextFunction } from 'express';
import { Role } from '../constants/roles.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { TokenService } from '../services/token.service.js';
import { AuthUser } from '../types/express.js';

/**
 * Middleware that authenticates a request using the Bearer JWT in the Authorization header.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication required. Missing or malformed Bearer token.');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new UnauthorizedError('Bearer token is empty.');
  }

  try {
    const payload = TokenService.verifyAccessToken(token);

    const authUser: AuthUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName,
      departmentId: payload.departmentId,
    };

    req.user = authUser;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware that restricts access to users with specified roles.
 */
export function authorize(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required before role check.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Access denied. Role '${req.user.role}' is not authorized for this resource.`
      );
    }

    next();
  };
}

/**
 * Middleware enforcing ownership over a resource (or role bypass).
 */
export function requireOwnershipOrRole(
  ownerIdExtractor: (req: Request) => string | undefined,
  bypassRoles: Role[] = [Role.ADMIN, Role.AUTHORITY]
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required.');
    }

    // High-privilege roles bypass ownership checks
    if (bypassRoles.includes(req.user.role)) {
      return next();
    }

    const resourceOwnerId = ownerIdExtractor(req);
    if (!resourceOwnerId || req.user.id !== resourceOwnerId) {
      throw new ForbiddenError('Access denied. You do not own this resource.');
    }

    next();
  };
}
