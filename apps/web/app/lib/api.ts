export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

export const apiFetch = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
