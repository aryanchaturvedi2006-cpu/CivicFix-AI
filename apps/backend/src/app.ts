import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { globalRateLimiter } from './middlewares/rate-limit.middleware.js';
import { sendSuccess, sendError } from './utils/response.util.js';

export function createApp(): Express {
  const app: Express = express();

  // Trust reverse proxy (for correct IP detection behind Nginx, Cloudflare, etc.)
  app.set('trust proxy', 1);

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Root Healthcheck (outside rate limiting for container probes)
  app.get('/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'healthy',
      service: 'civicfix-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // Apply Global Rate Limiting in production/development
  if (env.NODE_ENV !== 'test') {
    app.use(globalRateLimiter);
  }

  // Mount API Router under prefix (e.g. /api/v1)
  app.use(env.API_PREFIX, apiRouter);

  // 404 Catch-All Handler
  app.use((req: Request, res: Response) => {
    sendError(res, `Cannot ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND');
  });

  // Centralized Error Handling Middleware (must be registered last)
  app.use(errorHandler);

  return app;
}
