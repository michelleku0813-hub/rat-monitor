import * as argon2 from 'argon2';
import { existsSync } from 'node:fs';
import readline from 'node:readline';
import { neon } from '@neondatabase/serverless';

const username = (process.argv[2] ?? '').trim().toLowerCase();
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

if (!process.env.DATABASE_URL) {
  console.error('找不到 DATABASE_URL。請先執行 vercel env pull .env.local --environment=production。');
  process.exit(1);
}

if (!usernamePattern.test(username)) {
  console.error('帳號需為 3–32 個小寫英文字母、數字、.、_ 或 -，且開頭必須是英文字母或數字。');
  process.exit(1);
}

if (!process.stdin.isTTY) {
  console.error('請在互動式終端機中執行此腳本，以安全輸入密碼。');
  process.exit(1);
}

function askSecret(prompt) {
  return new Promise((resolve) => {
    const terminal = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    const originalWrite = terminal._writeToOutput;
    terminal._writeToOutput = function maskedWrite() {};
    process.stdout.write(prompt);
    terminal.question('', (answer) => {
      terminal._writeToOutput = originalWrite;
      terminal.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function isStrongPassword(password) {
  return (
    password.length >= 14 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

const password = await askSecret('設定新的管理員密碼（不會顯示）：');
const confirmation = await askSecret('再次輸入密碼：');

if (password !== confirmation) {
  console.error('兩次輸入的密碼不同。');
  process.exit(1);
}

if (!isStrongPassword(password)) {
  console.error('密碼至少需 14 個字元，且包含大寫、小寫、數字與符號。');
  process.exit(1);
}

try {
  const sql = neon(process.env.DATABASE_URL);
  const existing = await sql.query(
    'SELECT id FROM admin_users WHERE username = $1 LIMIT 1',
    [username],
  );
  const user = existing[0];
  if (!user) {
    console.error('找不到這個管理員帳號；未做任何變更。');
    process.exit(1);
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const results = await sql.transaction((tx) => [
    tx.query('SELECT id FROM admin_users WHERE id = $1 FOR UPDATE', [user.id]),
    tx.query(
      "WITH updated AS (UPDATE admin_users SET password_hash = $1, password_changed_at = NOW(), session_version = session_version + 1 WHERE id = $2 AND status = 'active' RETURNING id), revoked AS (UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'password_changed' WHERE user_id IN (SELECT id FROM updated) AND revoked_at IS NULL) INSERT INTO auth_audit (event_type, actor_user_id, metadata) SELECT 'password_changed', id, '{\"source\":\"local_password_reset\"}'::jsonb FROM updated RETURNING actor_user_id",
      [passwordHash, user.id],
    ),
  ]);

  if (results[1].length === 0) {
    console.error('此管理員帳號目前已停用；未變更密碼。');
    process.exitCode = 1;
  } else {
    console.log('管理員密碼已重設，所有既有登入工作階段已失效：' + username);
  }
} catch {
  console.error('無法重設管理員密碼。請確認 DATABASE_URL、Neon 資料表與網路連線後再試。');
  process.exitCode = 1;
}
