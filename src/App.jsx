import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import ExplorerPage from "./pages/ExplorerPage";
import LandingPage from "./pages/LandingPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/explorer" element={<ExplorerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
