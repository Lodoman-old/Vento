import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/Toast";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({ display_name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    api.get("/auth/me").then((data) => {
      setProfile({ display_name: data.display_name || "", email: data.email || "", phone: data.phone || "" });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleProfileSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put("/auth/profile", profile);
      // Update local auth state
      setUser((prev) => ({ ...prev, name: updated.display_name, email: updated.email }));
      toast("Perfil actualizado");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      return toast("Las contraseñas no coinciden", "error");
    }
    if (passwords.new_password.length < 6) {
      return toast("La nueva contraseña debe tener al menos 6 caracteres", "error");
    }
    setChangingPw(true);
    try {
      await api.post("/auth/change-password", {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      toast("Contraseña actualizada");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setChangingPw(false);
    }
  }

  if (loading) return <div className="max-w-xl"><p className="text-slate-400">Cargando...</p></div>;

  return (
    <div className="max-w-xl">
      <Link to="/" className="text-sm text-vento-cyan hover:underline mb-4 inline-block">&larr; Volver al panel</Link>
      <h1 className="text-2xl font-bold mb-6">Mi perfil</h1>

      {/* Profile form */}
      <form onSubmit={handleProfileSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Datos personales</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input type="text" value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input type="text" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
        </div>
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 bg-vento-cyan text-vento-navy font-semibold rounded-lg hover:bg-cyan-400 transition disabled:opacity-50">
          {saving ? "Guardando..." : "Guardar perfil"}
        </button>
      </form>

      {/* Change password */}
      <form onSubmit={handleChangePassword} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Cambiar contraseña</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Contraseña actual</label>
          <input type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
          <input type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" required minLength={6} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirmar nueva contraseña</label>
          <input type="password" value={passwords.confirm_password} onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" required minLength={6} />
        </div>
        <button type="submit" disabled={changingPw}
          className="px-6 py-2.5 bg-vento-navy text-white font-semibold rounded-lg hover:bg-slate-800 transition disabled:opacity-50">
          {changingPw ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}
