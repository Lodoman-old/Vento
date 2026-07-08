import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";

const roleLabels = {
  administrador: "Administrador",
  staff: "Staff",
  cliente: "Cliente",
};

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ display_name: "", email: "", password: "", phone: "", role: "staff" });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await api.get("/users"));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function resetForm() {
    setForm({ display_name: "", email: "", password: "", phone: "", role: "staff" });
    setEditingUser(null);
  }

  function startEdit(user) {
    setForm({
      display_name: user.display_name || "",
      email: user.email || "",
      password: "",
      phone: user.phone || "",
      role: user.role || "staff",
    });
    setEditingUser(user);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingUser) {
        const body = { ...form };
        if (!body.password) delete body.password;
        await api.put(`/users/${editingUser.id}`, body);
        toast("Usuario actualizado");
      } else {
        await api.post("/users", form);
        toast("Usuario creado");
      }
      setShowForm(false);
      resetForm();
      loadUsers();
    } catch (err) { toast(err.message, "error"); }
  }

  async function handleDelete(userId) {
    try {
      await api.delete(`/users/${userId}`);
      setDeleteTarget(null);
      toast("Usuario desactivado");
      loadUsers();
    } catch (err) { toast(err.message, "error"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm hover:bg-cyan-400 transition">
          + Nuevo usuario
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in"
          onClick={() => { setShowForm(false); resetForm(); }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-slide-up space-y-4">
            <h2 className="text-lg font-bold">{editingUser ? "Editar usuario" : "Nuevo usuario"}</h2>

            <div>
              <label className="text-sm text-slate-500 block mb-1">Nombre *</label>
              <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">
                Contraseña {editingUser && <span className="text-slate-300 font-normal">(dejar vacío para no cambiar)</span>}
              </label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan"
                required={!editingUser} />
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Rol</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan">
                <option value="staff">Staff</option>
                <option value="administrador">Administrador</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit"
                className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium hover:bg-cyan-400 transition">
                {editingUser ? "Guardar cambios" : "Crear usuario"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Teléfono</th>
              <th className="text-left px-4 py-3 font-medium">Rol</th>
              <th className="text-left px-4 py-3 font-medium">Estado</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium">{u.display_name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3 text-slate-500">{u.phone || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize
                    ${u.role === "administrador" ? "bg-purple-100 text-purple-700"
                    : u.role === "staff" ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700"}`}>
                    {roleLabels[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                    ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {u.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(u)}
                    className="text-xs text-vento-cyan hover:underline mr-3">Editar</button>
                  {u.is_active && (
                    <button onClick={() => setDeleteTarget(u.id)}
                      className="text-xs text-red-400 hover:underline">Desactivar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">No hay usuarios</p>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          message="¿Desactivar este usuario?"
          description="El usuario no podrá iniciar sesión."
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          confirmLabel="Desactivar"
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
