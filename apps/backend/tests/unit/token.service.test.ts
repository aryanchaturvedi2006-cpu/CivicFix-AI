import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { TokenService, TokenPayload } from '../../src/services/token.service.js';
import { Role } from '../../src/constants/roles.js';

describe('TokenService Unit Tests', () => {
  it('should hash a raw token with SHA-256 deterministically', () => {
    const rawToken = 'test-refresh-token-12345';
    const hash1 = TokenService.hashToken(rawToken);
    const hash2 = TokenService.hashToken(rawToken);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(crypto.createHash('sha256').update(rawToken).digest('hex'));
  });

  it('should generate a valid JWT access token and verify its payload', () => {
    const payload: TokenPayload = {
      sub: 'usr_12345678-1234-1234-1234-123456789012',
      email: 'citizen@example.com',
      role: Role.CITIZEN,
      fullName: 'John Doe',
      departmentId: null,
    };

    const accessToken = TokenService.generateAccessToken(payload);
    expect(accessToken).toBeDefined();
    expect(typeof accessToken).toBe('string');
    expect(accessToken.split('.')).toHaveLength(3);

    const verified = TokenService.verifyAccessToken(accessToken);
    expect(verified.sub).toBe(payload.sub);
    expect(verified.email).toBe(payload.email);
    expect(verified.role).toBe(payload.role);
    expect(verified.fullName).toBe(payload.fullName);
  });

  it('should generate cryptographically strong unique refresh tokens', () => {
    const token1 = TokenService.generateRawRefreshToken();
    const token2 = TokenService.generateRawRefreshToken();

    expect(token1).not.toBe(token2);
    expect(token1).toContain('.');
  });

  it('should throw an error for malformed access tokens', () => {
    expect(() => TokenService.verifyAccessToken('invalid.token.string')).toThrow();
  });
});
