import { useState } from 'react';

export interface LoginPageProps {
  /** Called after the front-end demo has completed both sign-in steps. */
  onAuthenticated: (email: string) => void;
}

type LoginStep = 'credentials' | 'mfa';

interface CredentialErrors {
  email?: string;
  password?: string;
}

const DEMO_EMAIL = 'operator@tpe-rat-demo.gov.tw';
const DEMO_PASSWORD = 'Demo#2026';
const DEMO_MFA_CODE = '246810';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${'•'.repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credentialErrors, setCredentialErrors] = useState<CredentialErrors>({});
  const [mfaError, setMfaError] = useState('');
  const [notice, setNotice] = useState('');

  const fillDemoCredentials = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setCredentialErrors({});
    setNotice('已填入展示帳號；可繼續進行多因素驗證。');
  };

  const fillDemoMfa = () => {
    setMfaCode(DEMO_MFA_CODE);
    setMfaError('');
    setNotice('已填入展示驗證碼。');
  };

  const handleCredentialSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: CredentialErrors = {};

    if (!normalizedEmail) {
      nextErrors.email = '請輸入帳號電子郵件。';
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      nextErrors.email = '請輸入有效的電子郵件格式。';
    }

    if (!password) {
      nextErrors.password = '請輸入密碼。';
    } else if (password.length < 8) {
      nextErrors.password = '密碼至少需要 8 個字元。';
    }

    setCredentialErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setEmail(normalizedEmail);
    setMfaCode('');
    setMfaError('');
    setStep('mfa');
    setNotice(
      `已建立展示用驗證步驟；正式版會將一次性驗證碼傳送至 ${maskEmail(normalizedEmail)}。`,
    );
  };

  const handleMfaSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{6}$/.test(mfaCode)) {
      setMfaError('請輸入 6 位數驗證碼。');
      return;
    }

    if (mfaCode !== DEMO_MFA_CODE) {
      setMfaError('展示驗證碼不正確，請使用「填入展示驗證碼」。');
      return;
    }

    setMfaError('');
    setNotice('驗證完成，正在進入系統。');
    onAuthenticated(email);
  };

  const returnToCredentials = () => {
    setStep('credentials');
    setMfaCode('');
    setMfaError('');
    setNotice('請確認帳號與密碼後再繼續。');
  };

  const requestAnotherCode = () => {
    setMfaError('');
    setNotice(
      `已重新建立展示用驗證碼；正式版會將新的驗證碼傳送至 ${maskEmail(email)}。`,
    );
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
              帳號與密碼驗證
            </li>
            <li>
              <span aria-hidden="true">02</span>
              多因素驗證（MFA）
            </li>
            <li>
              <span aria-hidden="true">03</span>
              角色與操作紀錄控管
            </li>
          </ul>
        </div>

        <p className="login-page__prototype-note">
          展示登入介面：此頁僅模擬前端流程，尚未連接真實身分驗證、MFA 或權限服務。
        </p>
      </section>

      <section className="login-page__form-panel" aria-labelledby="login-form-title">
        <div className="login-card">
          <header className="login-card__header">
            <p className="login-card__kicker">SECURE ACCESS</p>
            <h2 id="login-form-title">登入監測控制台</h2>
            <p>
              {step === 'credentials'
                ? '請先驗證您的工作帳號。'
                : `請完成 ${maskEmail(email)} 的多因素驗證。`}
            </p>
          </header>

          <ol className="login-steps" aria-label="登入步驟">
            <li className={step === 'credentials' ? 'is-current' : 'is-complete'}>
              <span aria-hidden="true">1</span>
              帳號驗證
            </li>
            <li className={step === 'mfa' ? 'is-current' : ''}>
              <span aria-hidden="true">2</span>
              安全驗證
            </li>
          </ol>

          <p className="login-form__notice" role="status" aria-live="polite">
            {notice}
          </p>

          {step === 'credentials' ? (
            <form className="login-form" noValidate onSubmit={handleCredentialSubmit}>
              <div className="login-form__field">
                <label htmlFor="login-email">工作電子郵件</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@agency.gov.tw"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setCredentialErrors((current) => ({ ...current, email: undefined }));
                  }}
                  aria-invalid={Boolean(credentialErrors.email)}
                  aria-describedby={credentialErrors.email ? 'login-email-error' : undefined}
                />
                {credentialErrors.email ? (
                  <p id="login-email-error" className="login-form__error" role="alert">
                    {credentialErrors.email}
                  </p>
                ) : null}
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
                      setCredentialErrors((current) => ({ ...current, password: undefined }));
                    }}
                    aria-invalid={Boolean(credentialErrors.password)}
                    aria-describedby={credentialErrors.password ? 'login-password-error' : undefined}
                  />
                  <button
                    type="button"
                    className="login-form__text-button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                  >
                    {showPassword ? '隱藏' : '顯示'}
                  </button>
                </div>
                {credentialErrors.password ? (
                  <p id="login-password-error" className="login-form__error" role="alert">
                    {credentialErrors.password}
                  </p>
                ) : null}
              </div>

              <div className="login-form__options">
                <label className="login-form__checkbox">
                  <input type="checkbox" name="remember-device" />
                  <span>在此受管理裝置上保留登入狀態</span>
                </label>
                <button type="button" className="login-form__text-button">
                  忘記密碼？
                </button>
              </div>

              <div className="login-form__actions">
                <button type="submit" className="login-form__submit">
                  繼續安全驗證
                </button>
                <button
                  type="button"
                  className="login-form__demo-button"
                  onClick={fillDemoCredentials}
                >
                  填入展示帳號
                </button>
              </div>
            </form>
          ) : (
            <form className="login-form" noValidate onSubmit={handleMfaSubmit}>
              <div className="login-form__verification-summary">
                <span className="login-form__verification-icon" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <strong>帳號資料已通過格式檢查</strong>
                  <p>請輸入 6 位數的一次性驗證碼以完成登入。</p>
                </div>
              </div>

              <div className="login-form__field">
                <label htmlFor="login-mfa-code">一次性驗證碼</label>
                <input
                  id="login-mfa-code"
                  name="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={mfaCode}
                  onChange={(event) => {
                    setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setMfaError('');
                  }}
                  aria-invalid={Boolean(mfaError)}
                  aria-describedby={mfaError ? 'login-mfa-error' : 'login-mfa-help'}
                  autoFocus
                />
                <p id="login-mfa-help" className="login-form__help">
                  展示模式可使用下方按鈕自動填入驗證碼。
                </p>
                {mfaError ? (
                  <p id="login-mfa-error" className="login-form__error" role="alert">
                    {mfaError}
                  </p>
                ) : null}
              </div>

              <div className="login-form__verification-actions">
                <button type="button" className="login-form__text-button" onClick={requestAnotherCode}>
                  重新傳送驗證碼
                </button>
                <button type="button" className="login-form__text-button" onClick={fillDemoMfa}>
                  填入展示驗證碼
                </button>
              </div>

              <div className="login-form__actions login-form__actions--split">
                <button type="button" className="login-form__back-button" onClick={returnToCredentials}>
                  返回上一步
                </button>
                <button type="submit" className="login-form__submit">
                  驗證並進入系統
                </button>
              </div>
            </form>
          )}

          <footer className="login-card__footer">
            <span aria-hidden="true">◉</span>
            需要協助？請聯繫系統管理員或資安服務台。
          </footer>
        </div>
      </section>
    </main>
  );
}
