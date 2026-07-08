import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/Toast";

function imgSrc(url) {
  return url?.startsWith("http") ? url : url || "/placeholder.svg";
}

const emptyForm = { name: "", category: "", unitPrice: "",   unitType: "pieza", description: "", stockAvailable: "", imageUrl: "" };
const unitTypes = ["pieza", "persona", "metro", "juego", "kg", "litro"];

export default function CatalogPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileRef = useRef(null);

  async function load() {
    const qs = showInactive ? "?showAll=true" : "";
    try { setItems(await api.get("/catalog" + qs)); } catch (err) { console.error(err); }
    try { setCategories(await api.get("/catalog/categories" + qs)); } catch (err) { console.error(err); }
  }

  useEffect(() => { load(); }, [showInactive]);

  const filtered = items.filter((i) => {
    if (filter && i.category !== filter) return false;
    if (searchTerm && !i.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach((i) => {
      if (!g[i.category]) g[i.category] = [];
      g[i.category].push(i);
    });
    return g;
  }, [filtered]);

  function openCreate() { setEditing(null); setForm(emptyForm); setShowForm(true); }

  function openEdit(item) {
    setEditing(item.id);
    setForm({
      name: item.name,
      category: item.category,
      unitPrice: item.unit_price?.toString() || "",
      unitType: item.unit_type || "unit",
      description: item.description || "",
      stockAvailable: item.stock_available?.toString() || "",
      imageUrl: item.image_url || "",
    });
    setShowForm(true);
  }

  async function handleUpload(file) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { url } = await api.post("/upload", fd, true);
      setForm({ ...form, imageUrl: url });
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        name: form.name, category: form.category, unitType: form.unitType,
        unitPrice: Number(form.unitPrice), description: form.description || null,
        stockAvailable: form.stockAvailable ? Number(form.stockAvailable) : 0,
        imageUrl: form.imageUrl || null,
      };
      if (editing) {
        await api.put(`/catalog/${editing}`, payload);
        toast("Producto actualizado");
      } else {
        await api.post("/catalog", payload);
        toast("Producto creado");
      }
      setShowForm(false); setEditing(null); setForm(emptyForm);
      load();
    } catch (err) { toast(err.message, "error"); }
  }

  async function toggleActive(item) {
    try {
      await api.put(`/catalog/${item.id}`, {
        name: item.name, category: item.category,
        unitPrice: Number(item.unit_price), unitType: item.unit_type,
        description: item.description || null,
        stockAvailable: item.stock_available || 0,
        imageUrl: item.image_url || null,
        isActive: !item.is_active,
      });
      toast(item.is_active ? "Producto desactivado" : "Producto activado");
      load();
    } catch (err) { toast(err.message, "error"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Catálogo</h1>
        {user?.role === "administrador" && (
          <button onClick={openCreate}
            className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm hover:bg-cyan-400 transition">
            + Agregar producto
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button onClick={() => setFilter("")}
          className={`text-sm px-3 py-1 rounded-full transition ${!filter ? "bg-vento-cyan text-vento-navy" : "bg-white border border-slate-200 hover:border-vento-cyan"}`}>
          Todas ({items.length})
        </button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`text-sm px-3 py-1 rounded-full capitalize transition ${filter === cat ? "bg-vento-cyan text-vento-navy" : "bg-white border border-slate-200 hover:border-vento-cyan"}`}>
            {cat} ({items.filter((i) => i.category === cat).length})
          </button>
        ))}
        {user?.role === "administrador" && (
          <button onClick={() => setShowInactive(!showInactive)}
            className={`text-sm px-3 py-1 rounded-full transition ml-auto ${showInactive ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-white border border-slate-200 text-slate-400 hover:border-amber-300"}`}>
            {showInactive ? "Ocultar desactivados" : "Ver desactivados"}
          </button>
        )}
      </div>
      <div className="mb-6">
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar producto por nombre..."
          className="w-full max-w-sm px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-slide-up space-y-4">
            <h2 className="text-lg font-bold">{editing ? "Editar producto" : "Nuevo producto"}</h2>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Nombre *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Categoría *</label>
                <input list="categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
                <datalist id="categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Tipo</label>
                <select value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan bg-white">
                  {unitTypes.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Precio unitario *</label>
                <input type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Stock</label>
                <input type="number" value={form.stockAvailable} onChange={(e) => setForm({ ...form, stockAvailable: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" rows="2" />
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Foto del producto</label>
              <div className="flex items-center gap-3">
                {form.imageUrl ? (
                  <div className="relative">
                    <img src={imgSrc(form.imageUrl)} alt="preview" className="w-24 h-24 object-cover rounded-lg border"
                      onError={(e) => { e.target.style.display = "none"; }} />
                    <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-600">✕</button>
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-slate-100 rounded-lg border flex items-center justify-center text-slate-300 text-xs">
                    {uploading ? "..." : "Sin foto"}
                  </div>
                )}
                <div>
                  <input type="file" ref={fileRef} accept="image/*" onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])} className="text-sm" />
                  {uploading && <p className="text-xs text-vento-cyan mt-1">Subiendo...</p>}
                </div>
              </div>
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

      {/* Grid */}
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold capitalize mb-3 text-slate-700">{category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {catItems.map((item) => (
              <div key={item.id} className={`bg-white rounded-xl border relative group overflow-hidden ${
                item.is_active ? "border-slate-200" : "border-red-200 bg-red-50/30"
              }`}>
                {item.image_url ? (
                  <img src={imgSrc(item.image_url)} alt={item.name} className="w-full h-32 object-cover"
                    onError={(e) => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-300 text-xs">Sin foto</div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-vento-cyan font-bold mt-2">{user?.role === "administrador" ? `$${Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</p>
                      <p className="text-xs text-slate-400 capitalize">{item.unit_type}</p>
                      {item.stock_available > 0 && (
                        <p className="text-xs text-slate-400 mt-1">Stock: {item.stock_available}</p>
                      )}
                      {!item.is_active && (
                        <span className="text-[10px] text-red-500 font-medium">Desactivado</span>
                      )}
                    </div>
                    {user?.role === "administrador" && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEdit(item)}
                          className="text-xs p-1 text-slate-400 hover:text-vento-cyan">✎</button>
                        <button onClick={() => toggleActive(item)}
                          className={`text-xs p-1 ${item.is_active ? "text-slate-400 hover:text-red-500" : "text-green-400 hover:text-green-600"}`}>
                          {item.is_active ? "⊘" : "✓"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
          <p className="text-slate-400">Catálogo vacío</p>
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
