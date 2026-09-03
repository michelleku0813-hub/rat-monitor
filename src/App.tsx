import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { ActivityAnalysisPage } from './pages/ActivityAnalysisPage';
import { DetectionEventsPage } from './pages/DetectionEventsPage';
import { LocationsPage } from './pages/LocationsPage';
import { DevicesPage } from './pages/DevicesPage';
import { LoginPage } from './pages/LoginPage';

const SESSION_KEY = 'rat-monitor-demo-user';

function savedUser(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const [userEmail, setUserEmail] = useState<string | null>(savedUser);

  const signIn = (email: string) => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, email);
    } catch {
      // The prototype remains usable when browser storage is unavailable.
    }
    setUserEmail(email);
  };

  const signOut = () => {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing else to clean up for the front-end-only demo.
    }
    setUserEmail(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={userEmail ? <Navigate to="/" replace /> : <LoginPage onAuthenticated={signIn} />}
        />
        <Route
          element={
            userEmail ? (
              <AppLayout userEmail={userEmail} onSignOut={signOut} />
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
