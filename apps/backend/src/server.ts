import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { logger } from './utils/logger.util.js';

const app = createApp();

const server = app.listen(env.PORT, async () => {
  logger.info(`CivicFix AI Backend service running on port ${env.PORT} in [${env.NODE_ENV}] mode`);
  logger.info(`Health check available at http://localhost:${env.PORT}/health`);
  logger.info(`API endpoints mounted at http://localhost:${env.PORT}${env.API_PREFIX}`);

  // Test database connection
  try {
    await prisma.$connect();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Failed to establish database connection on startup', error);
  }
});

// Graceful Shutdown Handler
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed. Disconnecting database client...');
    try {
      await prisma.$disconnect();
      logger.info('Database disconnected cleanly. Process exiting.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during database disconnect', err);
      process.exit(1);
    }
  });

  // Force shutdown if cleanup takes too long
  setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
