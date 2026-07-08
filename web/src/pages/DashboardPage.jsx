import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { fmtDate } from "../lib/format";
import { api } from "../lib/api";
import { Link } from "react-router-dom";

const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const dayNames = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];

export default function DashboardPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calData, setCalData] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    api.get("/events").then((r) => setEvents(r.data || r)).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get(`/events/calendar?year=${calYear}&month=${calMonth + 1}`).then((r) => {
      setCalData(r.days || {});
      setSelectedDay(null);
    }).catch(console.error);
  }, [calMonth, calYear]);

  const active = events.filter((e) => e.status === "activo");
  const draft = events.filter((e) => e.status === "borrador");
  const completed = events.filter((e) => e.status === "completado");
  const statusMap = { activo: "Activo", borrador: "Borrador", completado: "Completado", cancelado: "Cancelado", active: "Activo", draft: "Borrador", completed: "Completado", cancelled: "Cancelado" };
  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.date) > now && e.status !== "cancelado")
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const calDays = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calDays.push({ day: d, date: dayStr, events: calData[dayStr] || [] });
  }

  const selectedEvents = selectedDay ? calData[selectedDay] || [] : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Panel</h1>
          <p className="text-sm text-slate-500">Bienvenido, {user?.name}</p>
        </div>
        {user?.role === "administrador" && (
          <Link to="/events"
            className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm hover:bg-cyan-400 transition">
            + Nuevo evento
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
              <p className="text-3xl font-bold text-vento-navy mt-1">{events.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-green-200">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Activos</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{active.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Borradores</p>
              <p className="text-3xl font-bold text-slate-600 mt-1">{draft.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-blue-200">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Completados</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{completed.length}</p>
            </div>
          </div>

          {/* Calendario + lista lateral */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else { setCalMonth(calMonth - 1); } }}
                  className="text-xs px-2 py-1 text-slate-500 hover:text-vento-navy transition">&larr;</button>
                <h2 className="text-xs font-semibold">{monthNames[calMonth]} {calYear}</h2>
                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else { setCalMonth(calMonth + 1); } }}
                  className="text-xs px-2 py-1 text-slate-500 hover:text-vento-navy transition">&rarr;</button>
              </div>
              <div className="grid grid-cols-7 gap-px text-center">
                {dayNames.map((d) => (
                  <div key={d} className="text-[9px] text-slate-400 font-medium py-0.5">{d}</div>
                ))}
                {calDays.map((cell, i) => {
                  const isPast = cell && cell.date < todayStr;
                  return (
                    <div key={i} className="min-h-[58px] p-0.5">
                      {cell ? (
                        <button
                          onClick={() => setSelectedDay(selectedDay === cell.date ? null : cell.date)}
                          className={`w-full h-full flex flex-col items-center rounded-md text-[11px] transition p-0.5 ${
                            cell.date === todayStr ? "ring-2 ring-vento-cyan" : ""
                          } ${
                            selectedDay === cell.date ? "bg-vento-cyan/10 text-vento-cyan font-bold" :
                            cell.events.length > 0 ? "bg-blue-50 hover:bg-blue-100" :
                            "hover:bg-slate-50 text-slate-600"
                          } ${isPast ? "opacity-60" : ""}`}>
                          <span className={`${selectedDay === cell.date ? "" : "font-medium"} ${cell.events.length > 0 ? "text-vento-navy" : ""}`}>{cell.day}</span>
                          {cell.events.slice(0, 2).map((ev) => (
                            <span key={ev.id} className="text-[8px] leading-tight truncate w-full text-left px-0.5 text-vento-navy font-medium">
                              {ev.name}
                            </span>
                          ))}
                          {cell.events.length > 2 && (
                            <span className="text-[7px] text-vento-cyan font-bold">+{cell.events.length - 2}</span>
                          )}
                        </button>
                      ) : <div />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Eventos del día seleccionado */}
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <h3 className="text-xs font-semibold mb-2">
                {selectedDay ? (
                  <>{new Date(selectedDay + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long" })} ({selectedEvents.length})</>
                ) : "Selecciona un día"}
              </h3>
              {!selectedDay && <p className="text-[11px] text-slate-400">Haz clic en un día del calendario para ver sus eventos</p>}
              {selectedDay && selectedEvents.length === 0 && (
                <p className="text-[11px] text-slate-400">Sin eventos este día</p>
              )}
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {selectedEvents.map((ev) => (
                  <Link key={ev.id} to={`/events/${ev.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:border-vento-cyan/50 transition">
                    <div className="w-1.5 h-1.5 rounded-full bg-vento-cyan shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate">{ev.name}</p>
                      {ev.venue && <p className="text-[9px] text-slate-400 truncate">{ev.venue}</p>}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                      ev.status === "activo" ? "bg-green-100 text-green-700" :
                      ev.status === "borrador" ? "bg-slate-100 text-slate-600" :
                      ev.status === "completado" ? "bg-blue-100 text-blue-700" :
                      "bg-red-100 text-red-700"
                    }`}>{statusMap[ev.status] || ev.status}</span>
                  </Link>
                ))}
              </div>
              {selectedDay && selectedEvents.length > 1 && (
                <p className="text-[9px] text-amber-600 mt-2 font-medium">⚠ {selectedEvents.length} eventos este día</p>
              )}
            </div>
          </div>

          {/* Próximos eventos */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Próximos eventos</h2>
            {upcoming.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
                <p className="text-slate-400 mb-4">No hay eventos próximos</p>
                {user?.role === "administrador" && (
                  <Link to="/events"
                    className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm">
                    Crear evento
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 5).map((event) => {
                  const daysUntil = Math.ceil(
                    (new Date(event.date) - now) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="bg-white rounded-xl p-4 border border-slate-200 hover:border-vento-cyan/50 transition flex items-center justify-between group"
                    >
                      <div>
                        <h3 className="font-semibold">{event.name}</h3>
                        <p className="text-sm text-slate-500">
                          {fmtDate(event.date)}
                          {event.venue && ` — ${event.venue}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          daysUntil <= 7 ? "bg-red-100 text-red-600" :
                          daysUntil <= 30 ? "bg-amber-100 text-amber-600" :
                          "bg-green-100 text-green-600"
                        }`}>
                          {daysUntil === 0 ? "Hoy" :
                           daysUntil === 1 ? "Mañana" :
                           `En ${daysUntil} días`}
                        </span>
                         <span className={`text-xs px-2 py-1 rounded-full ${
                            event.status === "activo" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                         }`}>{statusMap[event.status] || event.status}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumen rápido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold mb-3 text-sm">Presupuesto total</h3>
              <p className="text-2xl font-bold text-vento-navy">
                {user?.role === "administrador" ? `$${events.reduce((s, e) => s + Number(e.total_budget || 0), 0).toLocaleString()}` : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">Suma de todos los eventos</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold mb-3 text-sm">Tu rol</h3>
              <p className="text-2xl font-bold text-vento-navy capitalize">{user?.role}</p>
              <p className="text-xs text-slate-400 mt-1">
                {user?.role === "administrador" ? "Acceso completo al sistema" :
                 user?.role === "staff" ? "Acceso a eventos asignados" :
                 "Acceso de solo lectura"}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
