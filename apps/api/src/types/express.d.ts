import { AuthClient, AuthUser } from '../core';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      client?: AuthClient;
    }
  }
}

export {};
