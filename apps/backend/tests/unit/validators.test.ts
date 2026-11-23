import { describe, it, expect } from 'vitest';
import {
  registerCitizenBody,
  loginBody,
  refreshTokenBody,
} from '../../src/validators/auth.validator.js';

describe('Auth Validators Unit Tests', () => {
  describe('registerCitizenBody', () => {
    it('should validate a correct registration payload', () => {
      const validPayload = {
        email: 'citizen.test@example.com',
        password: 'ValidPassword123',
        fullName: 'Jane Citizen',
        phone: '+919876543210',
      };

      const result = registerCitizenBody.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('citizen.test@example.com');
      }
    });

    it('should reject invalid email formats', () => {
      const payload = {
        email: 'invalid-email-address',
        password: 'ValidPassword123',
        fullName: 'Jane Citizen',
      };

      const result = registerCitizenBody.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('Invalid email');
      }
    });

    it('should reject passwords lacking uppercase or numbers', () => {
      const weakPassword1 = {
        email: 'citizen@example.com',
        password: 'onlylowercaseletters',
        fullName: 'Jane Citizen',
      };
      expect(registerCitizenBody.safeParse(weakPassword1).success).toBe(false);

      const weakPassword2 = {
        email: 'citizen@example.com',
        password: 'NoNumbersHereAtAll',
        fullName: 'Jane Citizen',
      };
      expect(registerCitizenBody.safeParse(weakPassword2).success).toBe(false);
    });

    it('should reject passwords shorter than 8 characters', () => {
      const shortPassword = {
        email: 'citizen@example.com',
        password: 'Pass1',
        fullName: 'Jane Citizen',
      };
      expect(registerCitizenBody.safeParse(shortPassword).success).toBe(false);
    });
  });

  describe('loginBody', () => {
    it('should validate correct login inputs', () => {
      const payload = {
        email: 'citizen@example.com',
        password: 'SomePassword',
      };
      expect(loginBody.safeParse(payload).success).toBe(true);
    });

    it('should reject empty credentials', () => {
      expect(loginBody.safeParse({ email: '', password: '' }).success).toBe(false);
    });
  });

  describe('refreshTokenBody', () => {
    it('should validate presence of refreshToken', () => {
      expect(refreshTokenBody.safeParse({ refreshToken: 'valid-token' }).success).toBe(true);
      expect(refreshTokenBody.safeParse({ refreshToken: '' }).success).toBe(false);
    });
  });
});
