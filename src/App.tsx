import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { ActivityAnalysisPage } from './pages/ActivityAnalysisPage';
import { DetectionEventsPage } from './pages/DetectionEventsPage';
import { LocationsPage } from './pages/LocationsPage';
import { DevicesPage } from './pages/DevicesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
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
