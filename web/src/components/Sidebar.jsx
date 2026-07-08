import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import Logo from "./Logo";

const links = [
  { to: "/", label: "Panel" },
  { to: "/events", label: "Eventos" },
  { to: "/catalog", label: "Catálogo" },
  { to: "/suppliers", label: "Proveedores" },
  { to: "/notifications", label: "Notificaciones" },
  { to: "/users", label: "Usuarios", adminOnly: true },
  { to: "/settings", label: "Configuración", adminOnly: true },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const { count } = await api.get("/notifications/unread-count");
        setUnreadCount(count);
      } catch {
        // ignore
      }
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-vento-navy text-white flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <div className="p-6 border-b border-white/10 flex flex-col items-center relative">
        <button onClick={onClose} className="lg:hidden absolute top-0 right-0 text-white/40 hover:text-white transition p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <Logo size={24} showText={true} />
        <p className="text-[10px] text-white/40 mt-1 tracking-wide">Eventos en perfecta sincronía.</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.filter((l) => !l.adminOnly || user?.role === "administrador").map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? "bg-vento-cyan/10 text-vento-cyan" : "text-white/70 hover:bg-white/5"
              }`
            }
          >
            <span className="flex-1">{link.label}</span>
            {link.to === "/notifications" && unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <p className="text-sm text-white/60">{user?.display_name || user?.name}</p>
        <p className="text-xs text-white/40 capitalize">{user?.role}</p>
        <button onClick={logout} className="mt-2 text-xs text-red-400 hover:text-red-300">
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
