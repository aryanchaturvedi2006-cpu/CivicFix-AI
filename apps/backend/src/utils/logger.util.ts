import { env } from '../config/env.js';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaString}`;
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    if (env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('DEBUG', message, meta));
    }
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    console.info(this.formatMessage('INFO', message, meta));
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage('WARN', message, meta));
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: env.NODE_ENV === 'development' ? error.stack : undefined }
      : { raw: error };
    
    console.error(this.formatMessage('ERROR', message, { ...errorDetails, ...meta }));
  }
}

export const logger = new Logger();
