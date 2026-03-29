import { User } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: User['role'];
      };
    }
  }
}

export {};
