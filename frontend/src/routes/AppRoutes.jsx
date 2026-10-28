import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import DashboardPage from "../pages/DashboardPage.jsx";
import ChambresPage from "../pages/ChambresPage.jsx";
import ClientsPage from "../pages/ClientsPage.jsx";
import ReservationsPage from "../pages/ReservationsPage.jsx";
import PaiementsPage from "../pages/PaiementsPage.jsx";
import RapportsPage from "../pages/RapportsPage.jsx";
import UtilisateursPage from "../pages/UtilisateursPage.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="chambres" element={<ChambresPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="paiements" element={<PaiementsPage />} />
          <Route path="rapports" element={<RapportsPage />} />
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="utilisateurs" element={<UtilisateursPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
