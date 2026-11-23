import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from '../utils/logger.util.js';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

if (env.NODE_ENV === 'development') {
  // @ts-expect-error Prisma event typing
  prisma.$on('query', (e: { query: string; duration: number }) => {
    logger.debug(`Prisma Query: ${e.query} [${e.duration}ms]`);
  });
}

// @ts-expect-error Prisma event typing
prisma.$on('error', (e: { message: string }) => {
  logger.error(`Prisma Client Error: ${e.message}`);
});

if (env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}
