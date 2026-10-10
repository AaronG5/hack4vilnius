import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { CityShell } from "./components/CityShell";
import { RootLayout } from "./components/RootLayout";
import { ChallengeCreatePage } from "./pages/challenges/ChallengeCreatePage";
import { ChallengeDetailPage } from "./pages/challenges/ChallengeDetailPage";
import { ChallengesPage } from "./pages/challenges/ChallengesPage";
import { DashboardPage } from "./pages/city/DashboardPage";
import { DistrictPage } from "./pages/city/DistrictPage";
import { ProblemCityPage } from "./pages/city/ProblemCityPage";
import { MapPage } from "./pages/MapPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProblemSheet } from "./pages/ProblemSheet";
import { ProfilePage } from "./pages/ProfilePage";
import { ReportSheet } from "./pages/ReportSheet";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/map" replace />} />
            <Route element={<MapPage />}>
              <Route path="map" element={null} />
              <Route path="map/report" element={<ReportSheet />} />
              <Route path="problems/:id" element={<ProblemSheet />} />
            </Route>

            <Route path="challenges" element={<ChallengesPage />} />
            <Route path="challenges/new" element={<ChallengeCreatePage />} />
            <Route path="challenges/:id" element={<ChallengeDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          <Route path="city" element={<CityShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="districts/:id" element={<DistrictPage />} />
            <Route path="problems/:id" element={<ProblemCityPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/map" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
