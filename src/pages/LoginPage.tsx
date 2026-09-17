import { useState } from 'react';
import { signIn, type AuthenticatedUser } from '../services/authService';

export interface LoginPageProps {
  onAuthenticated: (user: AuthenticatedUser) => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedUsername || !password) {
      setError('請輸入管理員帳號與密碼。');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const user = await signIn(normalizedUsername, password);
      onAuthenticated(user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登入失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-page__brand-panel" aria-labelledby="login-brand-title">
        <div className="login-page__brand-content">
          <span className="login-page__brand-mark" aria-hidden="true">
            ◈
          </span>
          <p className="login-page__eyebrow">TAIPEI AIOT OPERATIONS</p>
          <h1 id="login-brand-title">智慧鼠患監測平台</h1>
          <p className="login-page__brand-description">
            以設備監控、AI 影像辨識與事件通知，協助城市環境團隊即時掌握現場狀態。
          </p>

          <ul className="login-page__security-list" aria-label="登入保護機制">
            <li>
              <span aria-hidden="true">01</span>
              管理員帳號與密碼驗證
            </li>
            <li>
              <span aria-hidden="true">02</span>
              受保護的安全工作階段
            </li>
            <li>
              <span aria-hidden="true">03</span>
              存取權限與操作紀錄控管
            </li>
          </ul>
        </div>

        <p className="login-page__prototype-note">
          本系統僅限授權管理員使用，不提供公開註冊、Email 驗證或自助密碼重設。
        </p>
      </section>

      <section className="login-page__form-panel" aria-labelledby="login-form-title">
        <div className="login-card">
          <header className="login-card__header">
            <p className="login-card__kicker">SECURE ACCESS</p>
            <h2 id="login-form-title">登入監測控制台</h2>
            <p>請使用系統管理員建立的帳號登入。</p>
          </header>

          <ol className="login-steps" aria-label="登入步驟">
            <li className="is-current">
              <span aria-hidden="true">1</span>
              帳密驗證
            </li>
            <li>
              <span aria-hidden="true">2</span>
              進入控制台
            </li>
          </ol>

          <p className="login-form__notice" role="status" aria-live="polite">
            登入失敗訊息不會透露帳號是否存在。
          </p>

          <form className="login-form" noValidate onSubmit={handleSubmit}>
            <div className="login-form__field">
              <label htmlFor="login-username">管理員帳號</label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                placeholder="例如 rat-admin"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setError('');
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                disabled={submitting}
                autoFocus
              />
            </div>

            <div className="login-form__field">
              <label htmlFor="login-password">密碼</label>
              <div className="login-form__password-control">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError('');
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="login-form__text-button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                  disabled={submitting}
                >
                  {showPassword ? '隱藏' : '顯示'}
                </button>
              </div>
            </div>

            {error ? (
              <p id="login-error" className="login-form__error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="login-form__actions">
              <button type="submit" className="login-form__submit" disabled={submitting}>
                {submitting ? '登入中…' : '登入控制台'}
              </button>
            </div>
          </form>

          <footer className="login-card__footer">
            <span aria-hidden="true">◉</span>
            需要帳號或密碼協助？請聯繫系統管理員。
          </footer>
        </div>
      </section>
    </main>
  );
}
