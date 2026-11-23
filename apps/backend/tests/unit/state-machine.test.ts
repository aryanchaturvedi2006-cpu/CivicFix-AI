import { describe, it, expect } from 'vitest';
import { ComplaintStateMachine } from '../../src/services/state-machine.service.js';
import { ComplaintStatus } from '../../src/constants/status.js';
import { Role } from '../../src/constants/roles.js';
import { ValidationError, ForbiddenError } from '../../src/utils/errors.js';

describe('ComplaintStateMachine Unit Tests', () => {
  it('should permit AUTHORITY to transition PENDING_REVIEW -> ASSIGNED', () => {
    expect(() => {
      ComplaintStateMachine.validateTransition(
        ComplaintStatus.PENDING_REVIEW,
        ComplaintStatus.ASSIGNED,
        Role.AUTHORITY
      );
    }).not.toThrow();
  });

  it('should permit WORKER to transition ASSIGNED -> IN_PROGRESS', () => {
    expect(() => {
      ComplaintStateMachine.validateTransition(
        ComplaintStatus.ASSIGNED,
        ComplaintStatus.IN_PROGRESS,
        Role.WORKER
      );
    }).not.toThrow();
  });

  it('should reject CITIZEN attempting to transition PENDING_REVIEW -> ASSIGNED', () => {
    expect(() => {
      ComplaintStateMachine.validateTransition(
        ComplaintStatus.PENDING_REVIEW,
        ComplaintStatus.ASSIGNED,
        Role.CITIZEN
      );
    }).toThrow(ForbiddenError);
  });

  it('should reject invalid lifecycle jumps (e.g. SUBMITTED directly to VERIFIED)', () => {
    expect(() => {
      ComplaintStateMachine.validateTransition(
        ComplaintStatus.SUBMITTED,
        ComplaintStatus.VERIFIED,
        Role.ADMIN
      );
    }).toThrow(ValidationError);
  });

  it('should enforce mandatory comment when rejecting a complaint', () => {
    expect(() => {
      ComplaintStateMachine.validateTransition(
        ComplaintStatus.PENDING_REVIEW,
        ComplaintStatus.REJECTED,
        Role.AUTHORITY,
        '' // Empty comment
      );
    }).toThrow(ValidationError);

    expect(() => {
      ComplaintStateMachine.validateTransition(
        ComplaintStatus.PENDING_REVIEW,
        ComplaintStatus.REJECTED,
        Role.AUTHORITY,
        'Duplicate report outside municipal boundary.'
      );
    }).not.toThrow();
  });

  it('should return next allowed statuses accurately', () => {
    const nextForAuthority = ComplaintStateMachine.getNextAllowedStatuses(
      ComplaintStatus.PENDING_REVIEW,
      Role.AUTHORITY
    );

    expect(nextForAuthority).toContain(ComplaintStatus.ASSIGNED);
    expect(nextForAuthority).toContain(ComplaintStatus.REJECTED);
    expect(nextForAuthority).not.toContain(ComplaintStatus.VERIFIED);
  });
});
