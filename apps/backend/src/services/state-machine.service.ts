import { ComplaintStatus } from '../constants/status.js';
import { Role } from '../constants/roles.js';
import { ValidationError, ForbiddenError } from '../utils/errors.js';

interface TransitionRule {
  from: ComplaintStatus;
  to: ComplaintStatus;
  allowedRoles: Role[];
  requiresComment?: boolean;
}

const ALLOWED_TRANSITIONS: TransitionRule[] = [
  // 1. Citizen or System AI ingestion
  { from: ComplaintStatus.SUBMITTED, to: ComplaintStatus.AI_PROCESSED, allowedRoles: [Role.ADMIN] },
  { from: ComplaintStatus.SUBMITTED, to: ComplaintStatus.PENDING_REVIEW, allowedRoles: [Role.ADMIN, Role.AUTHORITY] },
  { from: ComplaintStatus.AI_PROCESSED, to: ComplaintStatus.PENDING_REVIEW, allowedRoles: [Role.ADMIN, Role.AUTHORITY] },

  // 2. Authority Review
  { from: ComplaintStatus.PENDING_REVIEW, to: ComplaintStatus.ASSIGNED, allowedRoles: [Role.ADMIN, Role.AUTHORITY] },
  { from: ComplaintStatus.PENDING_REVIEW, to: ComplaintStatus.REJECTED, allowedRoles: [Role.ADMIN, Role.AUTHORITY], requiresComment: true },

  // 3. Worker Progress
  { from: ComplaintStatus.ASSIGNED, to: ComplaintStatus.IN_PROGRESS, allowedRoles: [Role.ADMIN, Role.WORKER] },
  { from: ComplaintStatus.IN_PROGRESS, to: ComplaintStatus.RESOLVED, allowedRoles: [Role.ADMIN, Role.WORKER] },

  // 4. Verification / Rework
  { from: ComplaintStatus.RESOLVED, to: ComplaintStatus.VERIFIED, allowedRoles: [Role.ADMIN, Role.AUTHORITY] },
  { from: ComplaintStatus.RESOLVED, to: ComplaintStatus.IN_PROGRESS, allowedRoles: [Role.ADMIN, Role.AUTHORITY], requiresComment: true },
];

export class ComplaintStateMachine {
  /**
   * Validates if a status transition is permitted for the given role and conditions.
   */
  public static validateTransition(
    currentStatus: ComplaintStatus,
    targetStatus: ComplaintStatus,
    userRole: Role,
    comment?: string
  ): void {
    if (currentStatus === targetStatus) {
      throw new ValidationError(`Complaint is already in ${currentStatus} status`);
    }

    const rule = ALLOWED_TRANSITIONS.find(
      (t) => t.from === currentStatus && t.to === targetStatus
    );

    if (!rule) {
      throw new ValidationError(
        `Invalid status transition: cannot move complaint from '${currentStatus}' to '${targetStatus}'`
      );
    }

    if (!rule.allowedRoles.includes(userRole)) {
      throw new ForbiddenError(
        `Role '${userRole}' is not authorized to transition complaints from '${currentStatus}' to '${targetStatus}'`
      );
    }

    if (rule.requiresComment && (!comment || comment.trim().length === 0)) {
      throw new ValidationError(`A comment/reason is mandatory when transitioning to '${targetStatus}'`);
    }
  }

  /**
   * Returns list of reachable states from current status for a given role.
   */
  public static getNextAllowedStatuses(currentStatus: ComplaintStatus, userRole: Role): ComplaintStatus[] {
    return ALLOWED_TRANSITIONS
      .filter((t) => t.from === currentStatus && t.allowedRoles.includes(userRole))
      .map((t) => t.to);
  }
}
