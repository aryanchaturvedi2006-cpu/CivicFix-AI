import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ComplaintController } from '../controllers/complaint.controller.js';
import { Role } from '../constants/roles.js';
import {
  createComplaintSchema,
  listComplaintsSchema,
  complaintIdSchema,
  transitionComplaintSchema,
} from '../validators/complaint.validator.js';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize([Role.CITIZEN]),
  validate(createComplaintSchema),
  ComplaintController.create
);

router.get(
  '/',
  authenticate,
  validate(listComplaintsSchema),
  ComplaintController.list
);

router.get(
  '/:id',
  authenticate,
  validate(complaintIdSchema),
  ComplaintController.getById
);

router.patch(
  '/:id/status',
  authenticate,
  authorize([Role.ADMIN, Role.AUTHORITY, Role.WORKER]),
  validate(transitionComplaintSchema),
  ComplaintController.transition
);

export const complaintRoutes = router;
