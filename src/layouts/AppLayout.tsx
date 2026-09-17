import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import type { AdminRole } from '../services/authService';
import type { AppUserContext } from '../hooks/useAppUser';

const NAV: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: '監測總覽', icon: '▦', end: true },
  { to: '/analysis', label: '活動分析', icon: '⌁' },
  { to: '/events', label: '偵測事件', icon: '◉' },
  { to: '/locations', label: '場域熱點', icon: '⌖' },
  { to: '/devices', label: '設備健康', icon: '▤' },
];

interface AppLayoutProps {
  username: string;
  role: AdminRole;
  onSignOut: () => Promise<void>;
}

export function AppLayout({ username, role, onSignOut }: AppLayoutProps) {
  const [open, setOpen] = useState(false);
  const userInitial = username.slice(0, 1).toUpperCase();

  return (
    <>
      <div className="demo-banner" role="status">
        <span className="demo-banner__badge">Prototype</span>
        <span>Prototype – Demo Data　模擬資料 · 非正式監測結果</span>
      </div>

      <div className="app-shell">
        {open && (
          <div
            className="sidebar-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}

        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="sidebar__brand">
            <div className="sidebar__brand-lockup">
              <span className="sidebar__brand-mark">◈</span>
              <div>
                <div className="sidebar__brand-name">AIoT 智慧鼠患監測</div>
                <div className="sidebar__brand-sub">TAIPEI OPERATIONS CENTER</div>
              </div>
            </div>
          </div>

          <nav className="sidebar__nav" aria-label="主選單">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="nav-link__icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar__footer">
            <span className="sidebar__footer-dot" /> 系統資料流正常
            <br />
            Prototype · Mock Data
          </div>
        </aside>

        <main className="main">
          <header className="app-topbar">
            <div className="app-topbar__left">
              <button
                type="button"
                className="mobile-nav-toggle"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
              >
                選單
              </button>
              <span className="app-topbar__secure"><i /> 安全連線 · TLS 模擬</span>
            </div>
            <div className="app-topbar__profile">
              <span className="app-topbar__user-copy">
                <strong>{role === 'super_admin' ? '系統管理員' : '營運人員'}</strong>
                <small>{username}</small>
              </span>
              <span className="app-topbar__avatar" aria-hidden>{userInitial}</span>
              <button type="button" className="app-topbar__signout" onClick={() => void onSignOut()}>
                登出
              </button>
            </div>
          </header>
          <Outlet context={{ username, role } satisfies AppUserContext} />
        </main>
      </div>
    </>
  );
}
