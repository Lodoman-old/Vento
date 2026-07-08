import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ToastProvider } from "./components/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import PortalRoute from "./components/PortalRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import AgendaPage from "./pages/AgendaPage";
import SuppliersPage from "./pages/SuppliersPage";
import EventSuppliersPage from "./pages/EventSuppliersPage";
import QuotesPage from "./pages/QuotesPage";
import CatalogPage from "./pages/CatalogPage";
import NotificationsPage from "./pages/NotificationsPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import PortalPage from "./pages/PortalPage";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/events/:id/agenda" element={<AgendaPage />} />
          <Route path="/events/:id/suppliers" element={<EventSuppliersPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/events/:id/quotes" element={<QuotesPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>
        <Route element={<PortalRoute />}>
          <Route path="/portal" element={<PortalPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
