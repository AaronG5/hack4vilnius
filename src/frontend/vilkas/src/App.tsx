import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { CityShell } from "./components/CityShell";
import { Stub } from "./components/Stub";
import { MapPage } from "./pages/MapPage";
import { SplashPage } from "./pages/SplashPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<SplashPage />} />
          <Route path="map" element={<MapPage />} />

          <Route path="report/new" element={<Stub board="2" title="Naujas pranešimas" />} />
          <Route path="report/review" element={<Stub board="2" title="DI atpažinimas" />} />
          <Route path="report/duplicates" element={<Stub board="3" title="Dublikatų patikra" />} />

          <Route path="problems/:id" element={<Stub board="4" title="Problema" />} />
          <Route path="problems/:id/verify" element={<Stub board="5a" title="Ar vis dar yra?" />} />
          <Route
            path="problems/:id/verify/photo"
            element={<Stub board="5b" title="Naujausia nuotrauka" />}
          />
          <Route path="notifications" element={<Stub board="5" title="Pranešimai" />} />

          <Route path="challenges" element={<Stub board="6" title="Iššūkiai" withNav />} />
          <Route path="challenges/new" element={<Stub board="6" title="Naujas iššūkis" />} />
          <Route path="challenges/:id" element={<Stub board="6" title="Iššūkis" />} />

          <Route path="profile" element={<Stub board="7" title="Profilis" withNav />} />
          <Route
            path="profile/collection"
            element={<Stub board="7a" title="Vilniaus kolekcija" />}
          />
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
