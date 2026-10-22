export type Role = 'viewer' | 'controller';

export interface User {
  username: string;
  role: Role;
}

export interface CameraInfo {
  stream: string;
  ptz: { directions: Direction[] } | null;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  me: () => request<{ user: User }>('/api/auth/me').then((r) => r.user),
  login: (username: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }).then((r) => r.user),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  cameraInfo: () => request<CameraInfo>('/api/camera/info'),
  ptz: (direction: Direction) =>
    request('/api/camera/ptz', { method: 'POST', body: JSON.stringify({ direction }) }),
};

export const STREAM_WS_PATH = '/api/camera/ws';
export const SNAPSHOT_PATH = '/api/camera/snapshot';
