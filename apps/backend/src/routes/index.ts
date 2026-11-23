import { Router, Request, Response } from 'express';
import { authRoutes } from './auth.routes.js';
import { sendSuccess } from '../utils/response.util.js';

const router = Router();

// Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount modules
router.use('/auth', authRoutes);

export const apiRouter = router;
