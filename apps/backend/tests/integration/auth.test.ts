import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { Role } from '../../src/constants/roles.js';
import { TokenService } from '../../src/services/token.service.js';

// Mock Prisma
vi.mock('../../src/config/prisma.js', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

describe('Authentication Flow Integration Tests', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new citizen successfully and return tokens', async () => {
      // Mock no existing email or phone
      (prisma.user.findUnique as any).mockResolvedValue(null);

      // Mock user creation
      const mockCreatedUser = {
        id: 'usr-1111-2222-3333',
        email: 'newcitizen@example.com',
        fullName: 'New Citizen',
        phone: '+919876543210',
        role: Role.CITIZEN,
        isActive: true,
        departmentId: null,
        createdAt: new Date(),
      };
      (prisma.user.create as any).mockResolvedValue(mockCreatedUser);
      (prisma.refreshToken.create as any).mockResolvedValue({});
      (prisma.auditLog.create as any).mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newcitizen@example.com',
          password: 'SecurePassword123',
          fullName: 'New Citizen',
          phone: '+919876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('newcitizen@example.com');
      expect(res.body.data.user.role).toBe('CITIZEN');
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      expect(res.body.data.user.passwordHash).toBeUndefined(); // Password hash must never be leaked
    });

    it('should return 409 Conflict if email is already in use', async () => {
      (prisma.user.findUnique as any).mockResolvedValueOnce({
        id: 'existing-id',
        email: 'citizen@example.com',
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'citizen@example.com',
          password: 'SecurePassword123',
          fullName: 'New Citizen',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_IN_USE');
    });

    it('should return 400 Validation Error for weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'citizen@example.com',
          password: 'weak',
          fullName: 'New Citizen',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate user and return session tokens', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123', 10);
      const mockUser = {
        id: 'usr-4444-5555',
        email: 'officer@civicfix.gov',
        passwordHash,
        fullName: 'Officer John',
        phone: null,
        role: Role.AUTHORITY,
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Roads', code: 'ROADS' },
        isActive: true,
        createdAt: new Date(),
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as any).mockResolvedValue({});
      (prisma.auditLog.create as any).mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'officer@civicfix.gov',
          password: 'CorrectPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('AUTHORITY');
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid password with 401 INVALID_CREDENTIALS', async () => {
      const passwordHash = await bcrypt.hash('CorrectPassword123', 10);
      const mockUser = {
        id: 'usr-4444-5555',
        email: 'officer@civicfix.gov',
        passwordHash,
        isActive: true,
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.auditLog.create as any).mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'officer@civicfix.gov',
          password: 'WrongPassword999',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/v1/auth/refresh and Reuse Detection', () => {
    it('should rotate token successfully when a valid active token is provided', async () => {
      const rawToken = 'test-refresh-token';
      const tokenHash = TokenService.hashToken(rawToken);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockSession = {
        id: 'session-123',
        tokenHash,
        expiresAt: futureDate,
        revokedAt: null,
        replacedByTokenHash: null,
        user: {
          id: 'usr-1',
          email: 'citizen@example.com',
          role: Role.CITIZEN,
          fullName: 'Jane Citizen',
          isActive: true,
          departmentId: null,
        },
      };

      (prisma.refreshToken.findUnique as any).mockResolvedValue(mockSession);
      (prisma.$transaction as any).mockResolvedValue([{}, {}]);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should detect token reuse and revoke all sessions when a replaced token is replayed', async () => {
      const compromisedToken = 'stolen-already-used-token';
      const tokenHash = TokenService.hashToken(compromisedToken);

      const mockCompromisedSession = {
        id: 'session-old',
        tokenHash,
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: new Date(), // Already revoked!
        replacedByTokenHash: 'newer-token-hash', // Already replaced!
        user: {
          id: 'victim-user-1',
          isActive: true,
        },
      };

      (prisma.refreshToken.findUnique as any).mockResolvedValue(mockCompromisedSession);
      (prisma.refreshToken.updateMany as any).mockResolvedValue({ count: 3 });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: compromisedToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TOKEN_REUSE_DETECTED');
      // Verify that all active tokens for that user were invalidated
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'victim-user-1',
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return profile when authenticated with valid Bearer token', async () => {
      const validPayload = {
        sub: 'usr-current',
        email: 'officer@civicfix.gov',
        role: Role.AUTHORITY,
        fullName: 'Officer John',
        departmentId: 'dept-1',
      };
      const token = TokenService.generateAccessToken(validPayload);

      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'usr-current',
        email: 'officer@civicfix.gov',
        fullName: 'Officer John',
        phone: null,
        role: Role.AUTHORITY,
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Roads', code: 'ROADS' },
        createdAt: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('officer@civicfix.gov');
      expect(res.body.data.role).toBe('AUTHORITY');
    });

    it('should reject request without Bearer token with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
