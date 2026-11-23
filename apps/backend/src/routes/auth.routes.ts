import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authRateLimiter } from '../middlewares/rate-limit.middleware.js';
import {
  registerCitizenSchema,
  loginSchema,
  refreshTokenSchema,
} from '../validators/auth.validator.js';

const router = Router();

// Apply auth rate limiter to public authentication endpoints
router.post(
  '/register',
  authRateLimiter,
  validate(registerCitizenSchema),
  AuthController.register
);

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  AuthController.login
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  AuthController.refresh
);

router.post(
  '/logout',
  validate(refreshTokenSchema),
  AuthController.logout
);

// Protected endpoint
router.get(
  '/me',
  authenticate,
  AuthController.getMe
);

export const authRoutes = router;
