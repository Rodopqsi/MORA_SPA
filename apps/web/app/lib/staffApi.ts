import { apiBaseUrl } from './api';
import { getToken } from './auth';

export const staffFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const token = getToken('staffToken');
  if (!token) {
    throw new Error('No auth token');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
    } catch (err) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
};
