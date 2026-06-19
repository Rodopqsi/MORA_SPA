import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback, MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppError } from './core';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

export const UPLOAD_BUCKETS = ['services', 'staff', 'clients', 'products', 'misc', 'payments'] as const;
export type UploadBucket = (typeof UPLOAD_BUCKETS)[number];

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const sanitizeBucket = (raw: unknown): UploadBucket => {
  const value = typeof raw === 'string' ? raw : 'misc';
  return (UPLOAD_BUCKETS as readonly string[]).includes(value) ? (value as UploadBucket) : 'misc';
};

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const bucket = sanitizeBucket((req.query?.bucket ?? req.body?.bucket));
    const dest = path.join(UPLOAD_ROOT, bucket);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
    const id = crypto.randomBytes(8).toString('hex');
    const stamp = Date.now();
    cb(null, `${stamp}-${id}${safeExt}`);
  }
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new AppError(415, 'Tipo de archivo no permitido. Solo se aceptan imagenes JPG, PNG, WEBP o GIF.', 'invalid_mime'));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 8 }
});

export const publicUrlFor = (bucket: UploadBucket, filename: string): string => {
  return `/uploads/${bucket}/${filename}`;
};

export const handleUploadError = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(413, 'La imagen supera el tamano maximo permitido (5MB).', 'file_too_large'));
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      next(new AppError(400, 'Demasiados archivos. Maximo 8 por peticion.', 'too_many_files'));
      return;
    }
  }
  next(err);
};

export const UPLOAD_PUBLIC_PREFIX = '/uploads';

export const resolveUploadAbsolutePath = (publicPath: string): string | null => {
  if (!publicPath.startsWith(`${UPLOAD_PUBLIC_PREFIX}/`)) return null;
  const rel = publicPath.slice(UPLOAD_PUBLIC_PREFIX.length + 1).split('/').join(path.sep);
  const absolute = path.join(UPLOAD_ROOT, rel);
  // protect against path traversal
  if (!absolute.startsWith(UPLOAD_ROOT)) return null;
  return absolute;
};
