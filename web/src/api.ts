import type { AuthState } from './types';

let csrfToken = '';

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);

  const response = await fetch(`/api${path}`, {
    ...init,
    method,
    headers,
    credentials: 'same-origin'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload as T;
}

export async function loadAuth(): Promise<Pick<AuthState, 'user' | 'guilds' | 'csrfToken'>> {
  const result = await api<Pick<AuthState, 'user' | 'guilds' | 'csrfToken'>>('/auth/me');
  setCsrfToken(result.csrfToken);
  return result;
}