import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { Role } from '../constants/roles.js';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors.js';
import { TokenService, GeneratedTokens, TokenPayload } from './token.service.js';
import { AuditService } from './audit.service.js';
import { RegisterCitizenInput, LoginInput } from '../validators/auth.validator.js';

export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: Role;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  createdAt: Date;
}

export interface AuthResult {
  user: UserResponse;
  tokens: GeneratedTokens;
}

export class AuthService {
  /**
   * Registers a new citizen user.
   */
  public static async registerCitizen(
    input: RegisterCitizenInput,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthResult> {
    // 1. Check for duplicate email
    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingEmail) {
      throw new ConflictError('A user with this email address already exists', 'EMAIL_IN_USE');
    }

    // 2. Check for duplicate phone if provided
    if (input.phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: input.phone },
      });
      if (existingPhone) {
        throw new ConflictError('A user with this phone number already exists', 'PHONE_IN_USE');
      }
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

    // 4. Create citizen user
    const newUser = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phone: input.phone,
        role: Role.CITIZEN,
        isActive: true,
      },
    });

    const tokenPayload: TokenPayload = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role as Role,
      fullName: newUser.fullName,
      departmentId: newUser.departmentId,
    };

    // 5. Create secure session with token rotation
    const tokens = await TokenService.createSession(tokenPayload, userAgent, ipAddress);

    // 6. Record non-sensitive audit log
    await AuditService.log({
      userId: newUser.id,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: newUser.id,
      newValues: {
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
      },
      ipAddress,
      userAgent,
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        phone: newUser.phone,
        role: newUser.role as Role,
        departmentId: newUser.departmentId,
        createdAt: newUser.createdAt,
      },
      tokens,
    };
  }

  /**
   * Authenticates user credentials and issues tokens.
   */
  public static async login(
    input: LoginInput,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthResult> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Timing-safe constant-time comparison defense
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Please contact support.', 'ACCOUNT_DEACTIVATED');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      await AuditService.log({
        userId: user.id,
        action: 'FAILED_LOGIN_ATTEMPT',
        entity: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const tokenPayload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      fullName: user.fullName,
      departmentId: user.departmentId,
    };

    const tokens = await TokenService.createSession(tokenPayload, userAgent, ipAddress);

    await AuditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role as Role,
        departmentId: user.departmentId,
        department: user.department,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  /**
   * Refreshes access token and rotates refresh token.
   */
  public static async refresh(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<GeneratedTokens> {
    return TokenService.rotateSession(refreshToken, userAgent, ipAddress);
  }

  /**
   * Revokes the refresh token session on logout.
   */
  public static async logout(
    refreshToken: string,
    userId?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    await TokenService.revokeSession(refreshToken);

    if (userId) {
      await AuditService.log({
        userId,
        action: 'USER_LOGOUT',
        entity: 'User',
        entityId: userId,
        ipAddress,
        userAgent,
      });
    }
  }

  /**
   * Fetches profile of currently authenticated user.
   */
  public static async getProfile(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role as Role,
      departmentId: user.departmentId,
      department: user.department,
      createdAt: user.createdAt,
    };
  }
}
