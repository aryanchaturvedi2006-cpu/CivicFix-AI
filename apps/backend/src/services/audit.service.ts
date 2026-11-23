import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.util.js';

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'tokenHash',
  'secret',
  'authorization',
]);

function sanitizeValues(obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!obj) return null;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeValues(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export class AuditService {
  /**
   * Safely records an audit log entry in the database.
   */
  public static async log(params: AuditLogParams): Promise<void> {
    try {
      const sanitizedOld = sanitizeValues(params.oldValues);
      const sanitizedNew = sanitizeValues(params.newValues);

      await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          // Cast to any to satisfy Prisma InputJsonValue
          oldValues: sanitizedOld as any,
          newValues: sanitizedNew as any,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });

      logger.info(`Audit Log: [${params.action}] on ${params.entity}:${params.entityId}`, {
        userId: params.userId,
        ip: params.ipAddress,
      });
    } catch (error) {
      // Never let an audit logging failure crash the primary business transaction, but log the failure
      logger.error('Failed to write audit log entry', error, {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
      });
    }
  }
}
