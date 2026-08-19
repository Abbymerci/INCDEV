import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import IncidentsDashboardPage from "./pages/incidents/IncidentsDashboardPage";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/incidents" replace />} />
        <Route path="/incidents" element={<IncidentsDashboardPage />} />
        <Route
          path="/services"
          element={<PlaceholderPage title="Services" description="Service catalog and health status." />}
        />
        <Route
          path="/changes"
          element={<PlaceholderPage title="Changes" description="Scheduled and in-flight change requests." />}
        />
        <Route
          path="/analytics"
          element={<PlaceholderPage title="Analytics" description="Incident trends and reporting." />}
        />
        <Route
          path="/settings"
          element={<PlaceholderPage title="Settings" description="Portal configuration and preferences." />}
        />
        <Route path="*" element={<Navigate to="/incidents" replace />} />
      </Route>
    </Routes>
  );
}
