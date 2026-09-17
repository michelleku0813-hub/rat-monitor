import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

type Database = NeonQueryFunction<false, false>;

export type AdminRole = 'super_admin' | 'operator' | 'viewer';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: AdminRole;
}

export interface AuthenticatedSession {
  sessionId: string;
  user: AuthenticatedUser;
}

interface SessionRow {
  session_id: string;
  user_id: string;
  username: string;
  role: AdminRole;
}

interface AdminUserRow {
  id: string;
  username: string;
  password_hash: string;
  role: AdminRole;
  status: 'active' | 'disabled';
}

let database: Database | undefined;

export const SESSION_IDLE_SECONDS = 30 * 60;
export const SESSION_ABSOLUTE_SECONDS = 8 * 60 * 60;
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$Sr1mL5a2QMCcjw/bC9+l5Q$JfNZNynfb5ifP/FBXErnrj7/BZH5SIVSGxIrV9p+Klo';

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

/**
 * Do not pass caught database-driver errors to console.error(). A malformed
 * connection string can otherwise include credentials in a hosted log.
 */
export function logAuthFailure(operation: string, error: unknown): void {
  const kind = error instanceof AuthConfigurationError ? 'configuration' : 'internal';
  console.error(`Authentication ${operation} failed (${kind}).`);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new AuthConfigurationError(name + ' is not configured');
  }
  return value;
}

export function getDatabase(): Database {
  if (!database) {
    database = neon(requiredEnv('DATABASE_URL'));
  }
  return database;
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export function getDummyPasswordHash(): string {
  return process.env.AUTH_DUMMY_PASSWORD_HASH ?? DUMMY_PASSWORD_HASH;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Vercel overwrites this header with the public client IP in production.
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function hmac(value: string, secretName: string): string {
  return createHmac('sha256', requiredEnv(secretName)).update(value).digest('hex');
}

export function sessionTokenDigest(rawToken: string): string {
  return hmac(rawToken, 'SESSION_TOKEN_PEPPER');
}

export function fingerprint(value: string): string {
  return hmac(value, 'AUTH_FINGERPRINT_KEY');
}

export function loginThrottleKey(username: string, ip: string): string {
  return fingerprint('login:' + username + ':' + ip);
}

export function getSessionCookieName(): string {
  return isSecureRuntime() ? '__Host-rat-monitor-session' : 'rat-monitor-session';
}

function isSecureRuntime(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
}

export function getSessionToken(request: Request): string | null {
  const rawHeader = request.headers.get('cookie');
  if (!rawHeader) return null;

  const cookieName = getSessionCookieName();
  for (const item of rawHeader.split(';')) {
    const [name, ...valueParts] = item.trim().split('=');
    if (name === cookieName) {
      return valueParts.join('=') || null;
    }
  }
  return null;
}

export function sessionCookie(rawToken: string): string {
  const attributes = [
    getSessionCookieName() + '=' + rawToken,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + SESSION_ABSOLUTE_SECONDS,
  ];

  if (isSecureRuntime()) attributes.push('Secure');
  return attributes.join('; ');
}

export function expiredSessionCookie(): string {
  const attributes = [
    getSessionCookieName() + '=',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];

  if (isSecureRuntime()) attributes.push('Secure');
  return attributes.join('; ');
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isTrustedMutation(request: Request): boolean {
  const expectedOrigin = process.env.APP_ORIGIN;
  if (!expectedOrigin) {
    throw new AuthConfigurationError('APP_ORIGIN is not configured');
  }
  return request.headers.get('origin') === expectedOrigin;
}

export function jsonResponse(
  body: unknown,
  status = 200,
  additionalHeaders?: HeadersInit,
): Response {
  const headers = new Headers(additionalHeaders);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  return Response.json(body, { status, headers });
}

export function emptyResponse(status: number, additionalHeaders?: HeadersInit): Response {
  const headers = new Headers(additionalHeaders);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(null, { status, headers });
}

export async function parseJsonObject<T extends object>(
  request: Request,
): Promise<T | null> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return null;
  }

  try {
    const payload: unknown = await request.json();
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
      return null;
    }
    return payload as T;
  } catch {
    return null;
  }
}

export async function findAdminUser(username: string): Promise<AdminUserRow | null> {
  const rows = (await getDatabase().query(
    'SELECT id, username, password_hash, role, status FROM admin_users WHERE username = $1 LIMIT 1',
    [username],
  )) as AdminUserRow[];
  return rows[0] ?? null;
}

export async function isLoginThrottled(principalKey: string): Promise<boolean> {
  const rows = (await getDatabase().query(
    'SELECT locked_until FROM auth_login_throttles WHERE principal_key = $1 LIMIT 1',
    [principalKey],
  )) as { locked_until: string | null }[];
  const lockedUntil = rows[0]?.locked_until;
  return Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());
}

export async function recordLoginFailure(
  principalKey: string,
  usernameFingerprint: string,
  ipFingerprint: string,
): Promise<void> {
  const sql = getDatabase();
  await sql.transaction((tx) => [
    tx.query(
      "INSERT INTO auth_login_throttles (principal_key, failed_attempts, first_failed_at, locked_until, updated_at) VALUES ($1, 1, NOW(), NULL, NOW()) ON CONFLICT (principal_key) DO UPDATE SET failed_attempts = CASE WHEN auth_login_throttles.first_failed_at < NOW() - INTERVAL '15 minutes' THEN 1 ELSE auth_login_throttles.failed_attempts + 1 END, first_failed_at = CASE WHEN auth_login_throttles.first_failed_at < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE auth_login_throttles.first_failed_at END, locked_until = CASE WHEN (CASE WHEN auth_login_throttles.first_failed_at < NOW() - INTERVAL '15 minutes' THEN 1 ELSE auth_login_throttles.failed_attempts + 1 END) >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END, updated_at = NOW()",
      [principalKey],
    ),
    tx.query(
      "INSERT INTO auth_audit (event_type, username_fingerprint, ip_fingerprint) VALUES ('login_failed', $1, $2)",
      [usernameFingerprint, ipFingerprint],
    ),
  ]);
}

export async function createAuthenticatedSession(
  user: AuthenticatedUser,
  request: Request,
  principalKey: string,
): Promise<string> {
  const rawToken = createSessionToken();
  const tokenDigest = sessionTokenDigest(rawToken);
  const sessionId = randomUUID();
  const now = Date.now();
  const idleExpiresAt = new Date(now + SESSION_IDLE_SECONDS * 1000);
  const absoluteExpiresAt = new Date(now + SESSION_ABSOLUTE_SECONDS * 1000);
  const ipFingerprint = fingerprint(getClientIp(request));
  const sql = getDatabase();

  await sql.transaction((tx) => [
    tx.query('SELECT id FROM admin_users WHERE id = $1 FOR UPDATE', [user.id]),
    tx.query(
      "UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'new_login' WHERE user_id = $1 AND revoked_at IS NULL",
      [user.id],
    ),
    tx.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [user.id]),
    tx.query(
      'DELETE FROM auth_login_throttles WHERE principal_key = $1',
      [principalKey],
    ),
    tx.query(
      "INSERT INTO auth_sessions (id, user_id, token_digest, session_version, idle_expires_at, absolute_expires_at) SELECT $1, id, $2, session_version, $3, $4 FROM admin_users WHERE id = $5 AND status = 'active'",
      [sessionId, tokenDigest, idleExpiresAt, absoluteExpiresAt, user.id],
    ),
    tx.query(
      "INSERT INTO auth_audit (event_type, actor_user_id, session_id, username_fingerprint, ip_fingerprint) VALUES ('login_succeeded', $1, $2, $3, $4)",
      [user.id, sessionId, fingerprint(user.username), ipFingerprint],
    ),
  ]);

  return rawToken;
}

export async function getAuthenticatedSession(
  request: Request,
): Promise<AuthenticatedSession | null> {
  const rawToken = getSessionToken(request);
  if (!rawToken) return null;

  const rows = (await getDatabase().query(
    "SELECT s.id AS session_id, u.id AS user_id, u.username, u.role FROM auth_sessions s INNER JOIN admin_users u ON u.id = s.user_id WHERE s.token_digest = $1 AND s.revoked_at IS NULL AND s.idle_expires_at > NOW() AND s.absolute_expires_at > NOW() AND s.session_version = u.session_version AND u.status = 'active' LIMIT 1",
    [sessionTokenDigest(rawToken)],
  )) as SessionRow[];
  const session = rows[0];
  if (!session) return null;

  return {
    sessionId: session.session_id,
    user: {
      id: session.user_id,
      username: session.username,
      role: session.role,
    },
  };
}

export async function refreshSessionActivity(sessionId: string): Promise<boolean> {
  const rows = (await getDatabase().query(
    "UPDATE auth_sessions SET last_activity_at = NOW(), idle_expires_at = LEAST(absolute_expires_at, NOW() + INTERVAL '30 minutes') WHERE id = $1 AND revoked_at IS NULL AND idle_expires_at > NOW() AND absolute_expires_at > NOW() RETURNING id",
    [sessionId],
  )) as { id: string }[];
  return rows.length > 0;
}

export async function revokeSession(
  session: AuthenticatedSession,
  request: Request,
): Promise<void> {
  const sql = getDatabase();
  await sql.transaction((tx) => [
    tx.query(
      "UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'logout' WHERE id = $1 AND revoked_at IS NULL",
      [session.sessionId],
    ),
    tx.query(
      "INSERT INTO auth_audit (event_type, actor_user_id, session_id, username_fingerprint, ip_fingerprint) VALUES ('logout', $1, $2, $3, $4)",
      [
        session.user.id,
        session.sessionId,
        fingerprint(session.user.username),
        fingerprint(getClientIp(request)),
      ],
    ),
  ]);
}
