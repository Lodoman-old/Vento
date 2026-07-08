import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function PortalRoute() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "cliente") return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-vento-light">
      <main className="p-4 lg:p-6 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
