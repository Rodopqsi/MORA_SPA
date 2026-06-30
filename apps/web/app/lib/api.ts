import { getToken, clearToken } from './auth';

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (!host.includes('localhost')) {
      return `${window.location.protocol}//${host.replace('web', 'api')}/api`;
    }
  }
  return apiBaseUrl;
};

export const getApiPublicUrl = (): string => getApiBaseUrl().replace(/\/api$/, '');

export const resolveUploadUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${getApiPublicUrl()}${url}`;
};

export const apiFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const token = getToken('clientToken');
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {})
    }
  });
  if (!response.ok) {
    let message = 'Request failed';
    let code: string | undefined;
    try {
      const body = await response.json();
      message = body?.error?.message ?? body?.message ?? message;
      code = body?.error?.code ?? body?.code;
    } catch (err) {
      message = response.statusText || message;
    }
    if (response.status === 401 && typeof window !== 'undefined') {
      if (code === 'token_expired' || code === 'invalid_token' || token) {
        clearToken('clientToken');
        clearToken('staffToken');
        const p = window.location.pathname;
        const isAdminArea = p.startsWith('/admin') || p.startsWith('/dashboard');
        const target = isAdminArea ? '/admin/login' : '/login';
        if (!p.startsWith('/login') && !p.startsWith('/admin/login')) {
          const next = encodeURIComponent(p + window.location.search);
          window.location.href = `${target}?next=${next}&expired=1`;
        }
      }
    }
    throw new Error(message);
  }

  return response.json();
};
