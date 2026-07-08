import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { connectSocket, joinEvent } from "../lib/socket";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { fmtDateTime } from "../lib/format";

const contractColors = {
  pendiente: "bg-slate-100 text-slate-600",
  contactado: "bg-yellow-100 text-yellow-700",
  contratado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export default function EventSuppliersPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [assignBudget, setAssignBudget] = useState("");
  const [assignArrival, setAssignArrival] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editBudget, setEditBudget] = useState("");
  const [editArrival, setEditArrival] = useState("");

  async function loadSuppliers() {
    try { setSuppliers(await api.get(`/event-suppliers?event_id=${id}`)); } catch (err) { console.error(err); }
  }

  async function loadCatalog() {
    try { setCatalog(await api.get("/supplier-catalog")); } catch (err) { console.error(err); }
  }

  useEffect(() => {
    Promise.all([loadSuppliers(), loadCatalog()]).finally(() => setLoading(false));
    const socket = connectSocket(user?.id);
    joinEvent(id);
    socket.on("supplier:updated", (updated) => {
      setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    });
    socket.on("supplier:removed", ({ id: removedId }) => {
      setSuppliers((prev) => prev.filter((s) => s.id !== removedId));
    });
    return () => { socket.off("supplier:updated"); socket.off("supplier:removed"); };
  }, [id, user?.id]);

  async function handleAssign(e) {
    e.preventDefault();
    if (!selectedSupplier) return;
    try {
      const payload = { event_id: id, supplier_id: selectedSupplier };
      if (assignBudget) payload.budget_amount = Number(assignBudget);
      if (assignArrival) payload.arrival_time = assignArrival;
      await api.post("/event-suppliers", payload);
      toast("Proveedor asignado al evento");
      setShowAssign(false);
      setSelectedSupplier("");
      setAssignBudget("");
      setAssignArrival("");
      await loadSuppliers();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function updateSupplier(supId, data) {
    try {
      await api.patch(`/event-suppliers/${supId}`, data);
      toast("Proveedor actualizado");
      await loadSuppliers();
    } catch (err) { toast(err.message, "error"); }
  }

  async function reportArrival(supId) {
    await updateSupplier(supId, { actual_arrival_time: new Date().toISOString() });
  }

  function openEdit(s) {
    setEditTarget(s);
    setEditBudget(s.budget_amount?.toString() || "");
    setEditArrival(s.arrival_time || "");
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (!editTarget) return;
    const data = {};
    if (editBudget) data.budget_amount = Number(editBudget);
    if (editArrival) data.arrival_time = editArrival;
    await updateSupplier(editTarget.id, data);
    setEditTarget(null);
  }

  async function removeSupplier(supId) {
    try {
      await api.delete(`/event-suppliers/${supId}`);
      setDeleteTarget(null);
      toast("Proveedor retirado del evento");
      await loadSuppliers();
    } catch (err) { toast(err.message, "error"); }
  }

  const unassignedCatalog = catalog.filter((c) => !suppliers.some((s) => s.supplier_id === c.id));

  if (loading) return <p className="text-slate-400">Cargando...</p>;

  return (
    <div>
      <Link to={`/events/${id}`} className="text-sm text-vento-cyan hover:underline mb-4 inline-block">&larr; Volver al evento</Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Proveedores del evento</h1>
        <div className="flex gap-2">
          <Link to="/suppliers"
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
            Catálogo global
          </Link>
          {user?.role === "administrador" && (
            <button onClick={() => setShowAssign(true)}
              className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm hover:bg-cyan-400 transition">
              + Asignar proveedor
            </button>
          )}
        </div>
      </div>

      {/* Modal asignar proveedor */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in">
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleAssign}
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl animate-slide-up space-y-4">
            <h2 className="text-lg font-bold">Asignar proveedor al evento</h2>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Proveedor *</label>
              <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan bg-white" required>
                <option value="">Seleccionar...</option>
                {unassignedCatalog.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.category}</option>
                ))}
              </select>
              {unassignedCatalog.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">Todos los proveedores ya están asignados a este evento</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Presupuesto</label>
                <input type="number" value={assignBudget} onChange={(e) => setAssignBudget(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Llegada pactada</label>
                <input type="datetime-local" value={assignArrival} onChange={(e) => setAssignArrival(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit"
                className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium hover:bg-cyan-400 transition">
                Asignar
              </button>
              <button type="button" onClick={() => setShowAssign(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de proveedores asignados */}
      <div className="space-y-2">
        {suppliers.map((s) => (
          <div key={s.id}
            className="bg-white rounded-xl p-4 border border-slate-200 group">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${contractColors[s.contract_status]}`}>
                    {s.contract_status === "pendiente" ? "Pendiente" :
                     s.contract_status === "contactado" ? "Contactado" :
                     s.contract_status === "contratado" ? "Contratado" : "Cancelado"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-600">{s.category}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {s.contact_name && `Contacto: ${s.contact_name}`}
                  {s.phone && ` — ${s.phone}`}
                  {s.email && ` — ${s.email}`}
                  {s.budget_amount > 0 && user?.role === "administrador" && ` — Presupuesto: $${Number(s.budget_amount).toLocaleString()}`}
                </p>
                <div className="flex gap-4 mt-1 text-xs text-slate-500">
                  {s.arrival_time && (
                    <span>Llegada pactada: {fmtDateTime(s.arrival_time)}</span>
                  )}
                  {s.actual_arrival_time ? (
                    <span className="text-green-600">✓ Reportado: {fmtDateTime(s.actual_arrival_time)}</span>
                  ) : s.arrival_time && (
                    <span className="text-amber-500">Pendiente de llegar</span>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 ml-4 shrink-0">
                {user?.role === "administrador" ? (
                  <>
                    {s.contract_status === "pendiente" && (
                      <button onClick={() => updateSupplier(s.id, { contract_status: "contactado" })}
                        className="text-[10px] px-2 py-1 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition">
                        Contactado
                      </button>
                    )}
                    {s.contract_status === "contactado" && (
                      <button onClick={() => updateSupplier(s.id, { contract_status: "contratado" })}
                        className="text-[10px] px-2 py-1 bg-green-500 text-white rounded-full hover:bg-green-600 transition">
                        Contratar
                      </button>
                    )}
                    {s.contract_status === "contratado" && !s.actual_arrival_time && s.arrival_time && (
                      <button onClick={() => reportArrival(s.id)}
                        className="text-[10px] px-2 py-1 bg-amber-500 text-white rounded-full hover:bg-amber-600 transition">
                        Llegó
                      </button>
                    )}
                    <button onClick={() => openEdit(s)}
                      className="text-xs p-1 text-slate-400 hover:text-vento-cyan opacity-0 group-hover:opacity-100 transition"
                      title="Editar presupuesto/llegada">
                      ✎
                    </button>
                    <button onClick={() => setDeleteTarget(s.id)}
                      className="text-xs p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                      title="Retirar del evento">
                      ✕
                    </button>
                  </>
                ) : (
                  s.contract_status === "contratado" && !s.actual_arrival_time && s.arrival_time && (
                    <button onClick={() => reportArrival(s.id)}
                      className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition">
                      Reportar llegada
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {suppliers.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
          <p className="text-slate-400 mb-4">No hay proveedores asignados a este evento</p>
          {user?.role === "administrador" && (
            <button onClick={() => setShowAssign(true)}
              className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm">
              Asignar proveedor
            </button>
          )}
        </div>
      )}

      {/* Modal editar proveedor */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in">
          <form onSubmit={handleEditSave} onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-slide-up space-y-4">
            <h2 className="text-lg font-bold">Editar: {editTarget.name}</h2>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Presupuesto</label>
              <input type="number" value={editBudget} onChange={(e) => setEditBudget(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Llegada pactada</label>
              <input type="datetime-local" value={editArrival} onChange={(e) => setEditArrival(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit"
                className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium hover:bg-cyan-400 transition">
                Guardar
              </button>
              <button type="button" onClick={() => setEditTarget(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message="¿Retirar este proveedor del evento? No se eliminará del catálogo global."
          onConfirm={() => removeSupplier(deleteTarget)}
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
