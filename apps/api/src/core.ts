import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';

export const prisma = new PrismaClient();

export type AuthUser = {
  id: number;
  username: string;
  roles: string[];
  kind: 'staff';
};

export type AuthClient = {
  id: number;
  phone: string;
  email?: string | null;
  kind: 'client';
};

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const parse = <TSchema extends z.ZodTypeAny>(schema: TSchema, data: unknown): z.infer<TSchema> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(', ');
    throw new AppError(400, message, 'validation_error');
  }
  return result.data;
};

export const hashPassword = (value: string) => bcrypt.hash(value, 10);
export const verifyPassword = (value: string, hash: string) => bcrypt.compare(value, hash);

export const signToken = (payload: object) => {
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as SignOptions['expiresIn'];

  return jwt.sign(payload, secret, { expiresIn });
};

const handleAuthError = (err: unknown): never => {
  if (err instanceof jwt.TokenExpiredError) {
    throw new AppError(401, 'Token expired', 'token_expired');
  }
  if (err instanceof jwt.JsonWebTokenError) {
    throw new AppError(401, 'Invalid token', 'invalid_token');
  }
  throw err;
};

export const authRequired = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'Unauthorized', 'unauthorized');
  }

  const token = header.slice(7);
  let decoded: {
    sub: string | number;
    username?: string;
    roles?: string[];
    kind?: string;
    phone?: string;
    email?: string | null;
  };
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as typeof decoded;
  } catch (err) {
    handleAuthError(err);
  }

  if (decoded!.kind && decoded!.kind !== 'staff') {
    throw new AppError(401, 'Unauthorized', 'unauthorized');
  }

  if (!decoded!.username) {
    throw new AppError(401, 'Unauthorized', 'unauthorized');
  }

  req.user = {
    id: Number(decoded!.sub),
    username: decoded!.username!,
    roles: decoded!.roles ?? [],
    kind: 'staff'
  };

  next();
});

export const clientAuthRequired = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'Unauthorized', 'unauthorized');
  }

  const token = header.slice(7);
  let decoded: {
    sub: string | number;
    kind?: string;
    phone?: string;
    email?: string | null;
  };
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as typeof decoded;
  } catch (err) {
    handleAuthError(err);
  }

  if (decoded!.kind !== 'client' || !decoded!.phone) {
    throw new AppError(401, 'Unauthorized', 'unauthorized');
  }

  req.client = {
    id: Number(decoded!.sub),
    phone: decoded!.phone!,
    email: decoded!.email ?? null,
    kind: 'client'
  };

  next();
});

export const requireRoles = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Unauthorized', 'unauthorized'));
    }

    const allowed = roles.some((role) => req.user?.roles.includes(role));
    if (!allowed) {
      return next(new AppError(403, 'Forbidden', 'forbidden'));
    }

    next();
  };
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof AppError ? err.status : 500;
  const code = err instanceof AppError ? err.code : 'internal_error';
  const message = err instanceof AppError ? err.message : (err instanceof Error ? err.message : 'Internal error');

  // Log full stack on 5xx so we can debug 500s
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[api] ${req.method} ${req.originalUrl} -> ${status}`, err);
  }

  res.status(status).json({
    error: {
      message,
      code
    }
  });
};

export type PaginationParams = {
  page: number;
  pageSize: number;
  q?: string;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const sanitizePositiveInt = (value: unknown, fallback: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(n), max);
};

export const readPagination = (query: Record<string, unknown> | { [key: string]: unknown }): PaginationParams => {
  const page = sanitizePositiveInt(query.page, 1, 10_000);
  const pageSize = sanitizePositiveInt(query.pageSize ?? query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const rawQ = typeof query.q === 'string' ? query.q.trim() : '';
  return { page, pageSize, q: rawQ ? rawQ : undefined };
};

export const paginationMeta = (params: PaginationParams, total: number) => {
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1
  };
};

export const paginatedResponse = <T>(
  data: T[],
  params: PaginationParams,
  total: number
) => ({
  data,
  meta: paginationMeta(params, total)
});
