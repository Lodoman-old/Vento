import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { connectSocket, joinEvent } from "../lib/socket";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { fmtTime } from "../lib/format";

const emptyForm = { title: "", description: "", startTime: "", endTime: "", assignedTo: "", category: "other" };
const categories = ["logistica", "ceremonia", "comida", "musica", "otro"];

export default function AgendaPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterCat, setFilterCat] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadAgenda = useCallback(async () => {
    try { setItems(await api.get(`/agenda?event_id=${id}`)); } catch (err) { console.error(err); }
  }, [id]);

  useEffect(() => {
    Promise.all([
      loadAgenda(),
      api.get(`/events/${id}/staff`).then(setStaff).catch(() => {}),
    ]).finally(() => setLoading(false));

    const socket = connectSocket(user?.id);
    joinEvent(id);
    socket.on("agenda:updated", (updated) => {
      setItems((prev) => {
        const exists = prev.findIndex((i) => i.id === updated.id);
        if (exists >= 0) {
          const next = [...prev];
          next[exists] = updated;
          return next;
        }
        return [...prev, updated];
      });
    });
    socket.on("agenda:deleted", ({ agendaId }) => {
      setItems((prev) => prev.filter((i) => i.id !== agendaId));
    });
    return () => { socket.off("agenda:updated"); socket.off("agenda:deleted"); };
  }, [id, loadAgenda, user?.id]);

  async function toggleComplete(item) {
    try {
      await api.patch(`/agenda/${item.id}`, { is_completed: !item.is_completed });
      toast(item.is_completed ? "Tarea desmarcada" : "Tarea completada");
    } catch (err) { toast(err.message, "error"); }
  }

  function openCreate() { setEditing(null); setForm(emptyForm); setShowForm(true); }

  function openEdit(item) {
    setEditing(item.id);
    setForm({
      title: item.title,
      description: item.description || "",
      startTime: item.start_time?.slice(0, 16) || "",
      endTime: item.end_time?.slice(0, 16) || "",
      assignedTo: item.assigned_to || "",
      category: item.category || "other",
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        title: form.title, description: form.description, category: form.category,
        start_time: form.startTime, end_time: form.endTime, assigned_to: form.assignedTo,
        event_id: id,
      };
      if (editing) {
        await api.put(`/agenda/${editing}`, payload);
        toast("Tarea actualizada");
      } else {
        await api.post("/agenda", payload);
        toast("Tarea creada");
      }
      setShowForm(false); setEditing(null); setForm(emptyForm);
      loadAgenda();
    } catch (err) { toast(err.message, "error"); }
  }

  async function handleDelete(agendaId) {
    try {
      await api.delete(`/agenda/${agendaId}`);
      setDeleteTarget(null);
      setShowForm(false); setEditing(null);
      toast("Tarea eliminada");
      loadAgenda();
    } catch (err) { toast(err.message, "error"); }
  }

  if (loading) return <p className="text-slate-400">Cargando...</p>;

  const filtered = items.filter((i) => {
    if (filterCat && i.category !== filterCat) return false;
    if (searchTerm && !i.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
  const completed = filtered.filter((i) => i.is_completed).length;

  return (
    <div>
      <Link to={`/events/${id}`} className="text-sm text-vento-cyan hover:underline mb-4 inline-block">&larr; Volver al evento</Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{completed}/{filtered.length}</span>
          {user?.role === "administrador" && (
            <button onClick={openCreate}
              className="px-3 py-1.5 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium hover:bg-cyan-400 transition">
              + Agregar
            </button>
          )}
        </div>
      </div>

      {/* Progreso */}
      <div className="w-full h-2 bg-slate-200 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-vento-cyan rounded-full transition-all duration-500"
          style={{ width: `${filtered.length ? (completed / filtered.length) * 100 : 0}%` }} />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button onClick={() => setFilterCat("")}
          className={`text-xs px-3 py-1 rounded-full transition ${!filterCat ? "bg-vento-cyan text-vento-navy" : "bg-white border border-slate-200 hover:border-vento-cyan"}`}>
          Todas
        </button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className={`text-xs px-3 py-1 rounded-full capitalize transition ${filterCat === cat ? "bg-vento-cyan text-vento-navy" : "bg-white border border-slate-200 hover:border-vento-cyan"}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="mb-4">
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar tarea por nombre..."
          className="w-full max-w-sm px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
      </div>

      {/* Modal crear/editar */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl animate-slide-up space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? "Editar tarea" : "Nueva tarea"}</h2>
              {editing && (
                <button type="button" onClick={() => setDeleteTarget(editing)}
                  className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition">
                  Eliminar
                </button>
              )}
            </div>

            <div>
              <label className="text-sm text-slate-500 block mb-1">Título *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Inicio *</label>
                <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Fin</label>
                <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Asignar a</label>
                <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan bg-white">
                  <option value="">Sin asignar</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Categoría</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan bg-white">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="capitalize">{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Notas</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" rows="2" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit"
                className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium hover:bg-cyan-400 transition">
                {editing ? "Guardar cambios" : "Agregar"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {filtered.map((item) => (
          <div key={item.id}
            className={`group bg-white rounded-xl p-4 border flex items-center gap-4 transition ${
              item.is_completed ? "border-green-200 bg-green-50/50" : "border-slate-200 hover:border-vento-cyan/30"
            }`}>
            <button onClick={() => toggleComplete(item)}
              disabled={user?.role === "administrador" ? false : item.assigned_to !== user?.id && user?.role !== "administrador"}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition disabled:cursor-not-allowed ${
                item.is_completed ? "bg-green-500 border-green-500" : "border-slate-300 hover:border-vento-cyan"
              }`}>
              {item.is_completed && <span className="text-white text-xs">✓</span>}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`font-medium text-sm ${item.is_completed ? "line-through text-slate-400" : ""}`}>
                  {item.title}
                </p>
                  {item.is_completed && item.completed_at && (
                    <span className="text-[10px] text-green-500">{fmtTime(item.completed_at)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>{fmtTime(item.start_time)}</span>
                  {item.end_time && <span>— {fmtTime(item.end_time)}</span>}
                {item.assigned_name && <span>· {item.assigned_name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.category && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">
                  {item.category}
                </span>
              )}
              {user?.role === "administrador" && (
                <button onClick={() => openEdit(item)}
                  className="text-xs text-slate-400 hover:text-vento-cyan opacity-0 group-hover:opacity-100 transition p-1">
                  ✎
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && !loading && (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
          <p className="text-slate-400 mb-4">La agenda está vacía</p>
          {user?.role === "administrador" && (
            <button onClick={openCreate}
              className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium">
              Agregar primer ítem
            </button>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message="¿Eliminar tarea?"
          description="Esta acción no se puede deshacer."
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
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
