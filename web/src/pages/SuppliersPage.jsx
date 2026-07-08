import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";

const emptyForm = { name: "", contact_name: "", phone: "", email: "", category: "otro", service_description: "" };
const categories = ["catering", "decoracion", "musica", "fotografia", "transporte", "otro"];

export default function SuppliersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    try { setSuppliers(await api.get("/supplier-catalog")); } catch (err) { console.error(err); }
  }
  useEffect(() => { load(); }, []);

  function openCreate() { setEditing(null); setForm(emptyForm); setShowForm(true); }

  function openEdit(s) {
    setEditing(s.id);
    setForm({ name: s.name, contact_name: s.contact_name || "", phone: s.phone || "", email: s.email || "", category: s.category, service_description: s.service_description || "" });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/supplier-catalog/${editing}`, form);
        toast("Proveedor actualizado");
      } else {
        await api.post("/supplier-catalog", form);
        toast("Proveedor creado");
      }
      setShowForm(false); setEditing(null); setForm(emptyForm);
      load();
    } catch (err) { toast(err.message, "error"); }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/supplier-catalog/${id}`);
      setDeleteTarget(null);
      toast("Proveedor eliminado");
      load();
    } catch (err) { toast(err.message, "error"); }
  }

  const filtered = suppliers.filter((s) => !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Proveedores</h1>
        {user?.role === "administrador" && (
          <button onClick={openCreate}
            className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm hover:bg-cyan-400 transition">
            + Agregar proveedor
          </button>
        )}
      </div>

      <div className="mb-4">
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar proveedor por nombre..."
          className="w-full max-w-sm px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
      </div>

      {/* Modal crear/editar */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl animate-slide-up space-y-4">
            <h2 className="text-lg font-bold">{editing ? "Editar proveedor" : "Nuevo proveedor"}</h2>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Nombre *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Categoría</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan bg-white">
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Teléfono</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Contacto</label>
                <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="Nombre de contacto"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Descripción del servicio</label>
              <textarea value={form.service_description} onChange={(e) => setForm({ ...form, service_description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" rows="2" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit"
                className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium hover:bg-cyan-400 transition">
                {editing ? "Guardar" : "Agregar"}
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
        {filtered.map((s) => (
          <div key={s.id}
            className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{s.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-600">{s.category}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {s.contact_name && `Contacto: ${s.contact_name}`}
                {s.phone && ` — ${s.phone}`}
                {s.email && ` — ${s.email}`}
              </p>
              {s.service_description && (
                <p className="text-xs text-slate-500 mt-1">{s.service_description}</p>
              )}
            </div>
            {user?.role === "administrador" && (
              <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => openEdit(s)}
                  className="text-xs p-1 text-slate-400 hover:text-vento-cyan">✎</button>
                <button onClick={() => setDeleteTarget(s.id)}
                  className="text-xs p-1 text-slate-400 hover:text-red-500">✕</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
          <p className="text-slate-400">No hay proveedores registrados</p>
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          message="¿Eliminar este proveedor del catálogo? Se desvinculará de todos los eventos."
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
