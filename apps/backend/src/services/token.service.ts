import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { Role } from '../constants/roles.js';
import { UnauthorizedError } from '../utils/errors.js';
import { logger } from '../utils/logger.util.js';

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  fullName: string;
  departmentId?: string | null;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export class TokenService {
  /**
   * Hashes a raw refresh token using SHA-256 for secure storage.
   */
  public static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a signed short-lived JWT access token.
   */
  public static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  /**
   * Generates an unguessable high-entropy refresh token string.
   */
  public static generateRawRefreshToken(): string {
    return `${crypto.randomUUID()}.${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Verifies and decodes an access token.
   */
  public static verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token has expired', 'TOKEN_EXPIRED');
      }
      throw new UnauthorizedError('Invalid access token', 'TOKEN_INVALID');
    }
  }

  /**
   * Creates and registers a new refresh token session in the database.
   */
  public static async createSession(
    payload: TokenPayload,
    userAgent?: string,
    ipAddress?: string
  ): Promise<GeneratedTokens> {
    const accessToken = this.generateAccessToken(payload);
    const rawRefreshToken = this.generateRawRefreshToken();
    const tokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_IN_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    };
  }

  /**
   * Rotates a refresh token: revokes old token, issues a new pair, and detects token reuse.
   */
  public static async rotateSession(
    rawRefreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<GeneratedTokens> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const existingSession = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // 1. Session does not exist
    if (!existingSession) {
      logger.warn('Refresh session lookup failed - unknown token hash', { ipAddress });
      throw new UnauthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID');
    }

    const { user } = existingSession;

    // 2. Token reuse detection: Token was already revoked or replaced!
    if (existingSession.revokedAt !== null || existingSession.replacedByTokenHash !== null) {
      logger.error('CRITICAL: Refresh token reuse detected! Revoking all active sessions for user.', undefined, {
        userId: user.id,
        sessionId: existingSession.id,
        ipAddress,
      });

      // Revoke all active sessions for this user to protect compromised account
      await prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      throw new UnauthorizedError(
        'Compromised refresh token detected. All active sessions have been revoked for your security.',
        'TOKEN_REUSE_DETECTED'
      );
    }

    // 3. Check expiration
    if (new Date() > existingSession.expiresAt) {
      await prisma.refreshToken.update({
        where: { id: existingSession.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedError('Refresh token has expired. Please sign in again.', 'REFRESH_TOKEN_EXPIRED');
    }

    // 4. Ensure user account is still active
    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated', 'ACCOUNT_INACTIVE');
    }

    // 5. Generate new pair and rotate atomically
    const newRawRefreshToken = this.generateRawRefreshToken();
    const newTokenHash = this.hashToken(newRawRefreshToken);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + env.JWT_REFRESH_EXPIRES_IN_DAYS);

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      fullName: user.fullName,
      departmentId: user.departmentId,
    };

    const newAccessToken = this.generateAccessToken(payload);

    await prisma.$transaction([
      // Invalidate the old token and link to successor
      prisma.refreshToken.update({
        where: { id: existingSession.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenHash: newTokenHash,
        },
      }),
      // Store the new token
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
          userAgent,
          ipAddress,
        },
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    };
  }

  /**
   * Revokes a session on logout.
   */
  public static async revokeSession(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const session = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (session && session.revokedAt === null) {
      await prisma.refreshToken.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
  }
}
