import { z } from 'zod';

export const registerCitizenBody = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').trim(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Phone number must follow international format (e.g. +919876543210)')
    .optional(),
});

export const loginBody = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenBody = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const registerCitizenSchema = {
  body: registerCitizenBody,
};

export const loginSchema = {
  body: loginBody,
};

export const refreshTokenSchema = {
  body: refreshTokenBody,
};

export type RegisterCitizenInput = z.infer<typeof registerCitizenBody>;
export type LoginInput = z.infer<typeof loginBody>;
export type RefreshTokenInput = z.infer<typeof refreshTokenBody>;
