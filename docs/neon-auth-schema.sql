-- AIoT Smart Rat Monitoring — administrator authentication schema
-- Run this once in the Neon SQL Editor before creating the first administrator.
-- This schema intentionally has no email or phone fields.

BEGIN;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL
    CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  password_hash TEXT NOT NULL
    CHECK (char_length(password_hash) BETWEEN 30 AND 512),
  role TEXT NOT NULL DEFAULT 'super_admin'
    CHECK (role IN ('super_admin', 'operator', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  session_version INTEGER NOT NULL DEFAULT 1
    CHECK (session_version > 0),
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_unique
  ON admin_users ((LOWER(username)));

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  token_digest TEXT NOT NULL UNIQUE
    CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  session_version INTEGER NOT NULL DEFAULT 1
    CHECK (session_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idle_expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
    CHECK (revoke_reason IN (
      'logout', 'new_login', 'password_changed', 'admin_revoked', 'expired'
    )),
  CHECK (idle_expires_at <= absolute_expires_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX IF NOT EXISTS auth_sessions_active_user_lookup
  ON auth_sessions (user_id, absolute_expires_at)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_one_active_session_per_user
  ON auth_sessions (user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_login_throttles (
  principal_key TEXT PRIMARY KEY
    CHECK (principal_key ~ '^[0-9a-f]{64}$'),
  failed_attempts SMALLINT NOT NULL DEFAULT 1
    CHECK (failed_attempts > 0),
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'login_failed', 'login_succeeded', 'logout', 'account_created',
      'account_disabled', 'account_enabled', 'password_changed',
      'sessions_revoked'
    )),
  actor_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES auth_sessions(id) ON DELETE SET NULL,
  username_fingerprint TEXT
    CHECK (username_fingerprint IS NULL OR username_fingerprint ~ '^[0-9a-f]{64}$'),
  ip_fingerprint TEXT
    CHECK (ip_fingerprint IS NULL OR ip_fingerprint ~ '^[0-9a-f]{64}$'),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS auth_audit_actor_lookup
  ON auth_audit (actor_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS auth_audit_login_failure_lookup
  ON auth_audit (username_fingerprint, occurred_at DESC)
  WHERE event_type = 'login_failed';

COMMIT;
