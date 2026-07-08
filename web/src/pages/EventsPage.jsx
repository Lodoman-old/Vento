import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { fmtDate } from "../lib/format";

const emptyForm = { name: "", date: "", venue: "", description: "", totalBudget: "" };

export default function EventsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [conflictEvents, setConflictEvents] = useState([]);

  async function loadEvents(p) {
    try {
      const res = await api.get(`/events?page=${p}&limit=20`);
      setEvents(res.data);
      setTotalPages(res.totalPages);
      setPage(p);
    } catch (err) { console.error(err); }
  }
  useEffect(() => { loadEvents(1); }, []);

  useEffect(() => {
    if (!form.date) { setConflictEvents([]); return; }
    const d = new Date(form.date);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const dayStr = d.toISOString().slice(0, 10);
    api.get(`/events/calendar?year=${year}&month=${month}`).then((r) => {
      setConflictEvents((r.days && r.days[dayStr]) || []);
    }).catch(() => setConflictEvents([]));
  }, [form.date]);

  function openCreate() { setEditing(null); setForm(emptyForm); setShowForm(true); }

  function openEdit(event) {
    setEditing(event.id);
    setForm({
      name: event.name,
      date: event.date?.slice(0, 16) || "",
      venue: event.venue || "",
      description: event.description || "",
      totalBudget: event.total_budget?.toString() || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = { ...form, total_budget: form.totalBudget ? Number(form.totalBudget) : 0 };
      if (editing) {
        await api.put(`/events/${editing}`, payload);
        toast("Evento actualizado");
      } else {
        await api.post("/events", payload);
        toast("Evento creado");
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);
      loadEvents(1);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/events/${id}`);
      setDeleteTarget(null);
      toast("Evento eliminado");
      loadEvents(1);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleStatus(id, status) {
    try {
      await api.put(`/events/${id}`, { status });
      setStatusTarget(null);
      toast(`Evento marcado como ${status}`);
      loadEvents(1);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  const statusColors = {
    borrador: "bg-slate-100 text-slate-600",
    activo: "bg-green-100 text-green-700",
    completado: "bg-blue-100 text-blue-700",
    cancelado: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Eventos</h1>
        {user?.role === "administrador" && (
          <button onClick={openCreate}
            className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm hover:bg-cyan-400 transition">
            + Nuevo evento
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="mb-4">
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar eventos por nombre..."
          className="w-full max-w-sm px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
      </div>

      {/* Formulario crear/editar */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl animate-slide-up space-y-4">
            <h2 className="text-lg font-bold">{editing ? "Editar evento" : "Nuevo evento"}</h2>

            <div>
              <label className="text-sm text-slate-500 block mb-1">Nombre *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Fecha *</label>
                <input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
                {conflictEvents.filter((e) => editing !== e.id).length > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    ⚠ {conflictEvents.filter((e) => editing !== e.id).length} evento(s) ya registrado(s) en esta fecha
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Presupuesto</label>
                <input type="number" value={form.totalBudget} onChange={(e) => setForm({ ...form, totalBudget: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Lugar</label>
              <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" rows="2" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit"
                className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium hover:bg-cyan-400 transition">
                {editing ? "Guardar cambios" : "Crear evento"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmar eliminación */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slide-up text-center space-y-4">
            <p className="text-lg font-semibold">¿Eliminar evento?</p>
            <p className="text-sm text-slate-500">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition">
                Sí, eliminar
              </button>
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selector de status */}
      {statusTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setStatusTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl animate-slide-up text-center space-y-3">
            <p className="text-lg font-semibold">Cambiar estado</p>
            {["borrador", "activo", "completado", "cancelado"].map((s) => (
              <button key={s} onClick={() => handleStatus(statusTarget, s)}
                className={`w-full py-2 rounded-lg text-sm font-medium capitalize transition ${
                  s === "cancelado" ? "bg-red-50 text-red-600 hover:bg-red-100" :
                  s === "activo" ? "bg-green-50 text-green-600 hover:bg-green-100" :
                  s === "completado" ? "bg-blue-50 text-blue-600 hover:bg-blue-100" :
                  "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}>
                {s === "borrador" ? "Borrador" : s === "activo" ? "Activo" : s === "completado" ? "Completado" : "Cancelado"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de eventos */}
      <div className="space-y-3">
        {events.filter((e) => !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase())).map((event) => (
          <div key={event.id}
            className="bg-white rounded-xl p-4 border border-slate-200 hover:border-vento-cyan/50 transition flex items-center justify-between group">
            <Link to={`/events/${event.id}`} className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{event.name}</h3>
              <p className="text-sm text-slate-500">
                {fmtDate(event.date)} {event.venue ? `— ${event.venue}` : ""}
                {event.total_budget > 0 && user?.role === "administrador" && ` — $${Number(event.total_budget).toLocaleString()}`}
              </p>
            </Link>
            <div className="flex items-center gap-2 ml-4">
              <button onClick={() => setStatusTarget(event.id)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColors[event.status]}`}>
                {event.status === "borrador" ? "Borrador" : event.status === "activo" ? "Activo" : event.status === "completado" ? "Completado" : event.status === "cancelado" ? "Cancelado" : event.status}
              </button>
              {user?.role === "administrador" && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openEdit(event)}
                    className="text-xs px-2 py-1 text-slate-500 hover:text-vento-cyan transition">
                    ✎
                  </button>
                  <button onClick={() => setDeleteTarget(event.id)}
                    className="text-xs px-2 py-1 text-slate-500 hover:text-red-500 transition">
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => loadEvents(page - 1)} disabled={page <= 1}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
            ← Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => loadEvents(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                p === page ? "bg-vento-cyan text-vento-navy font-medium" : "border border-slate-200 hover:bg-slate-50"
              }`}>
              {p}
            </button>
          ))}
          <button onClick={() => loadEvents(page + 1)} disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
            Siguiente →
          </button>
        </div>
      )}

      {events.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
          <p className="text-slate-400 mb-4">No hay eventos aún</p>
          {user?.role === "administrador" && (
            <button onClick={openCreate}
              className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm">
              Crear primer evento
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </div>
  );
}
