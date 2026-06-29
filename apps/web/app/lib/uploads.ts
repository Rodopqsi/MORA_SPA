import { apiBaseUrl } from './api';
import { getToken } from './auth';

export type UploadBucket = 'services' | 'staff' | 'clients' | 'products' | 'misc';

export type UploadedFile = {
  url: string;
  fileName: string;
  size: number;
  mimetype: string;
  publicId?: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const validateFile = (file: File): string | null => {
  if (!ALLOWED_MIME.includes(file.type)) {
    return `Tipo de archivo no permitido: ${file.type || 'desconocido'}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `La imagen supera el máximo de 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }
  return null;
};

export const uploadImages = async (files: File[], bucket: UploadBucket): Promise<UploadedFile[]> => {
  const valid: File[] = [];
  for (const file of files) {
    const error = validateFile(file);
    if (error) {
      throw new Error(error);
    }
    valid.push(file);
  }
  if (valid.length === 0) {
    return [];
  }

  const token = getToken('staffToken');
  if (!token) {
    throw new Error('No auth token');
  }

  const formData = new FormData();
  for (const file of valid) {
    formData.append('files', file);
  }

  const response = await fetch(`${apiBaseUrl}/uploads?bucket=${bucket}`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    let message = 'No se pudo subir la imagen';
    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  const json = (await response.json()) as { data?: UploadedFile[] };
  return json.data ?? [];
};

export const deleteUpload = async (url: string, publicId?: string): Promise<void> => {
  const token = getToken('staffToken');
  if (!token) {
    throw new Error('No auth token');
  }
  const qs = new URLSearchParams();
  qs.set('url', url);
  if (publicId) qs.set('publicId', publicId);
  const response = await fetch(`${apiBaseUrl}/uploads?${qs.toString()}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    // best effort
    return;
  }
};
