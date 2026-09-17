import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import readline from 'node:readline';
import { neon } from '@neondatabase/serverless';

const username = (process.argv[2] ?? '').trim().toLowerCase();
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

if (!process.env.DATABASE_URL) {
  console.error('找不到 DATABASE_URL。請先執行 vercel env pull .env.local。');
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

const password = await askSecret('設定管理員密碼（不會顯示）：');
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
  const existing = await sql.query('SELECT id FROM admin_users WHERE username = $1 LIMIT 1', [
    username,
  ]);
  if (existing.length > 0) {
    console.error('此管理員帳號已存在，為避免覆寫既有帳號，未做任何變更。');
    process.exit(1);
  }

  const userId = randomUUID();
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await sql.transaction((tx) => [
    tx.query(
      "INSERT INTO admin_users (id, username, password_hash, role) VALUES ($1, $2, $3, 'super_admin')",
      [userId, username, passwordHash],
    ),
    tx.query(
      "INSERT INTO auth_audit (event_type, actor_user_id, metadata) VALUES ('account_created', $1, '{\"source\":\"local_admin_script\"}'::jsonb)",
      [userId],
    ),
  ]);

  console.log('管理員帳號已建立：' + username);
} catch {
  console.error('無法建立管理員帳號。請確認 DATABASE_URL、Neon 資料表與網路連線後再試。');
  process.exitCode = 1;
}
