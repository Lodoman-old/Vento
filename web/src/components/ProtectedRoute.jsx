import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Sidebar from "./Sidebar";

export default function ProtectedRoute() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen bg-vento-light">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 overflow-auto min-w-0">
        <div className="p-4 lg:p-6">
          {/* Hamburger for mobile */}
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden mb-4 text-slate-500 hover:text-vento-navy transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
