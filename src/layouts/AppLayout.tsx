import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Overview', end: true },
  { to: '/analysis', label: 'Activity Analysis' },
  { to: '/events', label: 'Detection Events' },
  { to: '/locations', label: 'Locations' },
  { to: '/devices', label: 'Devices' },
];

export function AppLayout() {
  const [open, setOpen] = useState(false);

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
            <div className="sidebar__brand-name">AIoT 智慧鼠患監測</div>
            <div className="sidebar__brand-sub">Smart Rat Activity Monitoring</div>
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
                <span className="nav-link__icon">▸</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar__footer">
            Data Service → Mock JSON
            <br />
            未來可替換為 REST API
          </div>
        </aside>

        <main className="main">
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            選單
          </button>
          <Outlet />
        </main>
      </div>
    </>
  );
}
