import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";

const TABS = [
  { id: "empresa", label: "Empresa" },
  { id: "database", label: "Base de datos" },
  { id: "firebase", label: "Firebase Push" },
  { id: "storage", label: "Almacenamiento" },
  { id: "templates", label: "Plantillas" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("empresa");
  const toast = useToast();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>

      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 -mb-px ${
              activeTab === tab.id
                ? "text-vento-cyan border-vento-cyan"
                : "text-slate-400 border-transparent hover:text-slate-600"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "empresa" && <EmpresaTab toast={toast} />}
      {activeTab === "database" && <DatabaseTab toast={toast} />}
      {activeTab === "firebase" && <FirebaseTab toast={toast} />}
      {activeTab === "storage" && <StorageTab toast={toast} />}
      {activeTab === "templates" && <TemplatesTab toast={toast} />}
    </div>
  );
}

function EmpresaTab({ toast }) {
  const [settings, setSettings] = useState({
    company_name: "", logo_url: "", address: "", phone: "", email: "", tax_id: "", quote_footer: "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

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

  if (loading) return <p className="text-slate-400">Cargando...</p>;

  return (
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
  );
}

function DatabaseTab({ toast }) {
  const [config, setConfig] = useState({ host: "", port: "5432", name: "", user: "", password: "", url: "" });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/settings").then((data) => {
      if (data?.db_config && typeof data.db_config === "object") {
        setConfig((prev) => ({ ...prev, ...data.db_config }));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaved(false);
    try {
      await api.put("/settings", { db_config: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast("Configuración de BD guardada y .env actualizado");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (loading) return <p className="text-slate-400">Cargando...</p>;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <p className="text-sm text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Estos valores se guardarán en la BD y se sincronizarán al archivo <code>.env</code>. El servidor necesita reiniciarse para aplicar cambios de conexión.
      </p>
      <div>
        <label className="block text-sm font-medium mb-1">DATABASE_URL (prioridad)</label>
        <input type="text" value={config.url} onChange={(e) => setConfig({ ...config, url: e.target.value })}
          placeholder="postgres://user:pass@host:port/dbname"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan font-mono text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Host</label>
          <input type="text" value={config.host} onChange={(e) => setConfig({ ...config, host: e.target.value })}
            placeholder="localhost" className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Puerto</label>
          <input type="text" value={config.port} onChange={(e) => setConfig({ ...config, port: e.target.value })}
            placeholder="5432" className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre de BD</label>
          <input type="text" value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="vento" className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Usuario</label>
          <input type="text" value={config.user} onChange={(e) => setConfig({ ...config, user: e.target.value })}
            placeholder="vento" className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Contraseña</label>
        <input type="password" value={config.password} onChange={(e) => setConfig({ ...config, password: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
      </div>
      <button type="submit" className="px-6 py-2.5 bg-vento-cyan text-vento-navy font-semibold rounded-lg hover:bg-cyan-400 transition">
        {saved ? "✓ Guardado" : "Guardar configuración"}
      </button>
    </form>
  );
}

function FirebaseTab({ toast }) {
  const [config, setConfig] = useState({ service_account: "" });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/settings").then((data) => {
      if (data?.firebase_config && typeof data.firebase_config === "object") {
        setConfig((prev) => ({ ...prev, ...data.firebase_config }));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaved(false);
    try {
      await api.put("/settings", { firebase_config: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast("Configuración de Firebase guardada y .env actualizado");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (loading) return <p className="text-slate-400">Cargando...</p>;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <p className="text-sm text-slate-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
        Configura las credenciales de Firebase Admin SDK para enviar notificaciones push.
        El valor debe ser la cuenta de servicio en formato Base64.
      </p>
      <div>
        <label className="block text-sm font-medium mb-1">FCM_SERVICE_ACCOUNT (Base64)</label>
        <textarea value={config.service_account} onChange={(e) => setConfig({ ...config, service_account: e.target.value })}
          rows={6} placeholder="eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6..."
          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan font-mono text-xs" />
      </div>
      <div className="text-sm text-slate-500">
        <p className="font-medium mb-1">Cómo obtener el archivo:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Ve a <span className="font-medium">Firebase Console → Configuración del proyecto → Cuentas de servicio</span></li>
          <li>Haz clic en "Generar nueva clave privada"</li>
          <li>Descarga el archivo JSON</li>
          <li>Conviértelo a Base64: <code className="bg-slate-100 px-1 rounded">cat archivo.json | base64</code></li>
          <li>Pega el resultado arriba</li>
        </ol>
      </div>
      <button type="submit" className="px-6 py-2.5 bg-vento-cyan text-vento-navy font-semibold rounded-lg hover:bg-cyan-400 transition">
        {saved ? "✓ Guardado" : "Guardar configuración"}
      </button>
    </form>
  );
}

function StorageTab({ toast }) {
  const [config, setConfig] = useState({ cloud_name: "", api_key: "", api_secret: "" });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/settings").then((data) => {
      if (data?.storage_config && typeof data.storage_config === "object") {
        setConfig((prev) => ({ ...prev, ...data.storage_config }));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaved(false);
    try {
      await api.put("/settings", { storage_config: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast("Configuración de almacenamiento guardada y .env actualizado");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (loading) return <p className="text-slate-400">Cargando...</p>;

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <p className="text-sm text-slate-500 bg-purple-50 border border-purple-200 rounded-lg p-3">
        Configura Cloudinary para el almacenamiento de imágenes (logos, fotos, etc.)
      </p>
      <div>
        <label className="block text-sm font-medium mb-1">Cloud Name</label>
        <input type="text" value={config.cloud_name} onChange={(e) => setConfig({ ...config, cloud_name: e.target.value })}
          placeholder="donvyblde" className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">API Key</label>
          <input type="text" value={config.api_key} onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">API Secret</label>
          <input type="password" value={config.api_secret} onChange={(e) => setConfig({ ...config, api_secret: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-vento-cyan" />
        </div>
      </div>
      <button type="submit" className="px-6 py-2.5 bg-vento-cyan text-vento-navy font-semibold rounded-lg hover:bg-cyan-400 transition">
        {saved ? "✓ Guardado" : "Guardar configuración"}
      </button>
    </form>
  );
}

function TemplatesTab({ toast }) {
  const [activeTemplate, setActiveTemplate] = useState("agenda");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("logistica");
  const [newHours, setNewHours] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});

  useEffect(() => {
    loadTemplates();
  }, [activeTemplate]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await api.get(`/templates?type=${activeTemplate}`);
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function addTemplate(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const payload = {
        template_type: activeTemplate,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        category: newCategory,
      };
      if (activeTemplate === "agenda" && newHours !== "") {
        payload.hours_from_base = Number(newHours);
      }
      await api.post("/templates", payload);
      setNewTitle("");
      setNewDesc("");
      setNewHours("");
      loadTemplates();
      toast("Plantilla agregada");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function updateTemplate(id) {
    try {
      await api.put(`/templates/${id}`, editFields);
      setEditingId(null);
      setEditFields({});
      loadTemplates();
      toast("Actualizado");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function deleteTemplate(id) {
    try {
      await api.delete(`/templates/${id}`);
      loadTemplates();
      toast("Eliminado");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function toggleActive(id, current) {
    try {
      await api.put(`/templates/${id}`, { is_active: !current });
      loadTemplates();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  const agendaCategories = ["logistica", "decoracion", "ceremonia", "comida", "musica", "otro"];

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTemplate("agenda")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTemplate === "agenda" ? "bg-vento-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          Agenda (tareas de montaje)
        </button>
        <button onClick={() => setActiveTemplate("checklist")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTemplate === "checklist" ? "bg-vento-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
          Checklist (herramientas)
        </button>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        {activeTemplate === "agenda"
          ? "Estos items se generan automáticamente al activar un evento. Puedes agregar, editar o eliminar pasos."
          : "Estos items se cargan automáticamente en el checklist al activar un evento."}
      </p>

      {/* Add form */}
      <form onSubmit={addTemplate} className="bg-slate-50 rounded-lg p-4 mb-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-500 mb-1">Título *</label>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" required />
        </div>
        {activeTemplate === "agenda" && (
          <>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-slate-500 mb-1">Descripción</label>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
            </div>
            <div className="w-32">
              <label className="block text-xs text-slate-500 mb-1">Categoría</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                {agendaCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs text-slate-500 mb-1">Horas base</label>
              <input type="number" step="0.5" value={newHours} onChange={(e) => setNewHours(e.target.value)}
                placeholder="ej: 3" className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
            </div>
          </>
        )}
        <button type="submit" className="px-4 py-1.5 bg-vento-cyan text-vento-navy rounded text-sm font-medium">
          + Agregar
        </button>
      </form>

      {/* List */}
      {loading ? (
        <p className="text-slate-400 text-sm">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t, i) => (
            <div key={t.id} className={`bg-white rounded-lg border px-4 py-3 flex items-center gap-3 text-sm ${!t.is_active ? "opacity-50" : ""}`}>
              <span className="text-slate-300 text-xs w-5 text-right">{i + 1}</span>
              {editingId === t.id ? (
                <div className="flex-1 flex flex-wrap gap-2">
                  <input value={editFields.title ?? t.title} onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
                    className="flex-1 min-w-[150px] px-2 py-1 border border-slate-200 rounded text-sm" />
                  {activeTemplate === "agenda" && (
                    <>
                      <input value={editFields.description ?? t.description ?? ""} onChange={(e) => setEditFields({ ...editFields, description: e.target.value })}
                        placeholder="Descripción" className="flex-1 min-w-[150px] px-2 py-1 border border-slate-200 rounded text-sm" />
                      <select value={editFields.category ?? t.category} onChange={(e) => setEditFields({ ...editFields, category: e.target.value })}
                        className="px-2 py-1 border border-slate-200 rounded text-sm">
                        {agendaCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="number" step="0.5" value={editFields.hours_from_base ?? t.hours_from_base ?? ""}
                        onChange={(e) => setEditFields({ ...editFields, hours_from_base: Number(e.target.value) })}
                        className="w-20 px-2 py-1 border border-slate-200 rounded text-sm" placeholder="Hrs" />
                    </>
                  )}
                  <button onClick={() => updateTemplate(t.id)} className="px-2 py-1 bg-green-500 text-white rounded text-xs">OK</button>
                  <button onClick={() => { setEditingId(null); setEditFields({}); }} className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-xs">Cancelar</button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <span className="font-medium">{t.title}</span>
                    {activeTemplate === "agenda" && t.description && (
                      <span className="text-slate-400 ml-2">— {t.description}</span>
                    )}
                    {activeTemplate === "agenda" && (
                      <span className="text-xs text-slate-300 ml-2">({t.category}, {t.hours_from_base}h)</span>
                    )}
                  </div>
                  <button onClick={() => toggleActive(t.id, t.is_active)}
                    className={`text-xs px-2 py-1 rounded ${t.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                    {t.is_active ? "Activo" : "Inactivo"}
                  </button>
                  <button onClick={() => { setEditingId(t.id); setEditFields({}); }}
                    className="text-xs px-2 py-1 text-slate-400 hover:text-vento-cyan">✎</button>
                  <button onClick={() => deleteTemplate(t.id)}
                    className="text-xs px-2 py-1 text-slate-400 hover:text-red-500">✕</button>
                </>
              )}
            </div>
          ))}
          {templates.length === 0 && <p className="text-sm text-slate-400">No hay plantillas. Agrega items arriba.</p>}
        </div>
      )}
    </div>
  );
}
