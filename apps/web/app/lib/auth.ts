const getCookie = (key: string) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^| )${key}=([^;]+)`));
  return match ? match[2] : null;
};

export const getToken = (key = 'clientToken') => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key) ?? getCookie(key);
};

export const setToken = (token: string, key = 'clientToken') => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, token);
  document.cookie = `${key}=${token}; path=/; max-age=604800; SameSite=Lax`;
};

export const clearToken = (key = 'clientToken') => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
  document.cookie = `${key}=; path=/; max-age=0; SameSite=Lax`;
};
