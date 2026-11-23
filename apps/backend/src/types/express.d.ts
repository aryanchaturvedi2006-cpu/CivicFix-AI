import { Role } from '../constants/roles.js';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  departmentId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
