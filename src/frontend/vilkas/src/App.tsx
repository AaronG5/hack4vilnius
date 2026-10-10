import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { CityShell } from "./components/CityShell";
import { Stub } from "./components/Stub";
import { ChallengeCreatePage } from "./pages/challenges/ChallengeCreatePage";
import { ChallengeDetailPage } from "./pages/challenges/ChallengeDetailPage";
import { ChallengesPage } from "./pages/challenges/ChallengesPage";
import { MapPage } from "./pages/MapPage";
import { ProblemSheet } from "./pages/ProblemSheet";
import { ProfilePage } from "./pages/ProfilePage";
import { ReportSheet } from "./pages/ReportSheet";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
        </Route>

        <Route path="city" element={<CityShell />}>
          <Route index element={<Stub board="8" title="Šios savaitės prioritetai" />} />
          <Route path="districts/:id" element={<Stub board="9" title="Rajono skydelis" />} />
          <Route path="problems/:id" element={<Stub board="10" title="Problemos kortelė" />} />
        </Route>

        <Route path="*" element={<Navigate to="/map" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
