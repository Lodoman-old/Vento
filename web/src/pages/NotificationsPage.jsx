import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

const typeIcons = {
  agenda: "📋",
  supplier: "🚚",
  quote: "📄",
  checklist: "✅",
  evento: "📅",
  cliente: "👤",
  general: "🔔",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventFilter, setEventFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const qs = eventFilter ? `?eventId=${eventFilter}` : "";
      const data = await api.get("/notifications" + qs);
      setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  }, [eventFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const limit = user?.role === "administrador" ? "?limit=100" : "?limit=100";
        const res = await api.get("/events" + limit);
        const list = res.data || res;
        setEvents(list);
      } catch { /* ignore */ }
    }
    fetchEvents();
  }, [user]);

  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  async function markAllRead() {
    await api.post("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function cleanup() {
    try {
      const res = await api.delete("/notifications/cleanup");
      setNotifications((prev) => prev.filter((n) => !n.is_read || new Date(n.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
    } catch { /* ignore */ }
  }

  const unread = notifications.filter((n) => !n.is_read);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Notificaciones</h1>
        <div className="flex gap-2">
          {unread.length > 0 && (
            <button onClick={markAllRead}
              className="text-xs px-3 py-1.5 bg-vento-cyan text-vento-navy rounded-lg font-medium hover:bg-cyan-400 transition">
              Marcar todas leídas
            </button>
          )}
          <button onClick={cleanup}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
            Limpiar antiguas
          </button>
        </div>
      </div>

      <div className="mb-4">
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan">
          <option value="">Todos los eventos</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {notifications.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
            <p className="text-slate-400">No hay notificaciones</p>
          </div>
        )}

        {notifications.map((n) => (
          <div key={n.id}
            className={`bg-white rounded-xl border px-4 py-3 flex items-start gap-3 transition
              ${n.is_read ? "border-slate-200" : "border-vento-cyan/30 bg-vento-cyan/[0.02]"}`}>
            <span className="text-lg mt-0.5">{typeIcons[n.type] || typeIcons.general}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${n.is_read ? "text-slate-600" : "font-semibold text-slate-800"}`}>
                {n.title}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>
              <div className="flex gap-3 mt-1">
                {n.event_name && <span className="text-[10px] text-slate-400">{n.event_name}</span>}
                <span className="text-[10px] text-slate-300">
                  {new Date(n.created_at).toLocaleString("es-MX")}
                </span>
              </div>
            </div>
            {n.event_id && (
              <Link to={`/events/${n.event_id}`}
                className="text-[10px] text-vento-cyan hover:underline shrink-0 mt-1">
                Ver evento
              </Link>
            )}
            {!n.is_read && (
              <button onClick={() => markRead(n.id)}
                className="text-[10px] text-slate-400 hover:text-slate-600 shrink-0 mt-1">
                ✓
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}