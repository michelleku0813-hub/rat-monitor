import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { ActivityAnalysisPage } from './pages/ActivityAnalysisPage';
import { DetectionEventsPage } from './pages/DetectionEventsPage';
import { LocationsPage } from './pages/LocationsPage';
import { DevicesPage } from './pages/DevicesPage';
import { LoginPage } from './pages/LoginPage';
import {
  getCurrentUser,
  recordSessionActivity,
  signOut as endSession,
  type AuthenticatedUser,
} from './services/authService';

export default function App() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let lastReportedAt = 0;
    const reportActivity = () => {
      const now = Date.now();
      if (now - lastReportedAt < 5 * 60 * 1000) return;
      lastReportedAt = now;

      void recordSessionActivity().then((status) => {
        if (status === 'expired') setUser(null);
      }).catch(() => undefined);
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, reportActivity));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, reportActivity));
    };
  }, [user]);

  const signIn = (authenticatedUser: AuthenticatedUser) => {
    setUser(authenticatedUser);
  };

  const signOut = async () => {
    try {
      await endSession();
    } finally {
      setUser(null);
    }
  };

  if (authLoading) {
    return (
      <main className="auth-loading" aria-live="polite">
        正在確認安全登入狀態…
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage onAuthenticated={signIn} />}
        />
        <Route
          element={
            user ? (
              <AppLayout username={user.username} role={user.role} onSignOut={signOut} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="analysis" element={<ActivityAnalysisPage />} />
          <Route path="events" element={<DetectionEventsPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
