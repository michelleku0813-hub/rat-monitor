export type AdminRole = 'super_admin' | 'operator' | 'viewer';

export interface AuthenticatedUser {
  username: string;
  role: AdminRole;
}

interface ApiError {
  error?: string;
}

interface UserResponse extends ApiError {
  user?: AuthenticatedUser;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const response = await fetch('/api/auth/me', {
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (response.status === 401) return null;

  const payload = await readJson<UserResponse>(response);
  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error ?? '無法確認登入狀態。');
  }
  return payload.user;
}

export async function signIn(username: string, password: string): Promise<AuthenticatedUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const payload = await readJson<UserResponse>(response);

  if (!response.ok || !payload?.user) {
    throw new Error(payload?.error ?? '登入失敗，請稍後再試。');
  }
  return payload.user;
}

export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error('無法完成登出。');
  }
}

export async function recordSessionActivity(): Promise<'active' | 'expired' | 'unavailable'> {
  const response = await fetch('/api/auth/activity', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.ok) return 'active';
  if (response.status === 401) return 'expired';
  return 'unavailable';
}
