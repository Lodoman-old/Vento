import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    company_name: "", logo_url: "", address: "", phone: "", email: "", tax_id: "", quote_footer: "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const toast = useToast();

  useEffect(() => {
    api.get("/settings").then((data) => {
      if (data) setSettings(data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "logo");
      const data = await api.upload("/upload", fd);
      setSettings({ ...settings, logo_url: data.url });
      toast("Logo subido correctamente");
    } catch (err) {
      toast("Error al subir el logo", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(false);
    try {
      const data = await api.put("/settings", settings);
      setSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast("Error al guardar cambios", "error");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Configuración de la empresa</h1>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre de la empresa</label>
            <input type="text" value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Logo</label>
            <div className="flex items-center gap-4">
              {settings.logo_url && (
                <img src={settings.logo_url} alt="logo" className="h-16 w-16 object-contain rounded border" />
              )}
              <input type="file" accept="image/*" ref={fileRef} onChange={handleLogoUpload} className="text-sm" />
              {uploading && <span className="text-sm text-slate-400">Subiendo...</span>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Dirección</label>
            <textarea value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Teléfono</label>
              <input type="text" value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">RFC</label>
            <input type="text" value={settings.tax_id} onChange={(e) => setSettings({ ...settings, tax_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Pie de página en cotizaciones</label>
            <textarea value={settings.quote_footer} onChange={(e) => setSettings({ ...settings, quote_footer: e.target.value })}
              rows={3} placeholder="Gracias por su preferencia..." className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
          </div>

          <button type="submit" className="px-6 py-2.5 bg-vento-cyan text-vento-navy font-semibold rounded-lg hover:bg-cyan-400 transition">
            {saved ? "✓ Guardado" : "Guardar cambios"}
          </button>
        </form>
      )}
    </div>
  );
}
