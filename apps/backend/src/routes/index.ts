import { Router, Request, Response } from 'express';
import { authRoutes } from './auth.routes.js';
import { complaintRoutes } from './complaint.routes.js';
import { AIClient } from '../services/ai-client.service.js';
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
router.use('/complaints', complaintRoutes);

router.get('/ai/health', async (_req: Request, res: Response) => {
  sendSuccess(res, {
    aiServiceAvailable: await AIClient.health(),
  });
});

export const apiRouter = router;
