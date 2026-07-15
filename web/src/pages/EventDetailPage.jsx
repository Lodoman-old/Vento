import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { fmtDateTime, fmtTime } from "../lib/format";
import { useToast } from "../components/Toast";

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [event, setEvent] = useState(null);
  const [agenda, setAgenda] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [clientAccess, setClientAccess] = useState(null);
  const [showClientCreds, setShowClientCreds] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [editingInvItem, setEditingInvItem] = useState(null);
  const [invEditQty, setInvEditQty] = useState(1);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", date: "", venue: "", description: "", total_budget: "", status: "" });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [evt, ag, sup, quo, ca, cl] = await Promise.allSettled([
        api.get(`/events/${id}`),
        api.get(`/agenda?event_id=${id}`),
        api.get(`/event-suppliers?event_id=${id}`),
        api.get(`/quotes?event_id=${id}`),
        user?.role === "administrador" ? api.get(`/events/${id}/client-access`) : Promise.resolve(null),
        api.get(`/checklist?event_id=${id}`),
      ]);
      if (evt.status === "fulfilled") setEvent(evt.value);
      else setErrors((e) => ({ ...e, event: evt.reason?.message }));
      if (ag.status === "fulfilled") setAgenda(ag.value);
      if (sup.status === "fulfilled") setSuppliers(sup.value);
      if (quo.status === "fulfilled") setQuotes(quo.value);
      if (ca.status === "fulfilled") setClientAccess(ca.value);
      if (cl.status === "fulfilled") setChecklist(cl.value);
setLoading(false);
    }

    load();
  }, [id, user?.role]);

  useEffect(() => {
    if (tab === "inventory") {
      setLoadingInventory(true);
      api.get(`/events/${id}/inventory`).then(setInventory).catch(() => {}).finally(() => setLoadingInventory(false));
    }
  }, [tab, id]);
  async function generateAccess() {
    setGenerating(true);
    try {
      const res = await api.post(`/events/${id}/client-access`);
      setShowClientCreds(res);
      setClientAccess(res);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setGenerating(false);
    }
  }

  async function resetPassword() {
    try {
      const res = await api.post(`/events/${id}/reset-client-password`);
      setShowClientCreds({ ...showClientCreds, password: res.password });
      toast("Nueva contraseña generada");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function revokeAccess() {
    try {
      await api.delete(`/events/${id}/client-access`);
      setClientAccess(null);
      setShowClientCreds(null);
      toast("Acceso revocado");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function generateReport() {
    setGeneratingReport(true);
    try {
      const [company, allQuotes, allPayments] = await Promise.all([
        api.get("/settings"),
        api.get(`/quotes?event_id=${id}`),
        api.get(`/payments?event_id=${id}`).catch(() => []),
      ]);

      let allPaymentsResolved = [];
      if (allQuotes.length > 0) {
        const paymentPromises = allQuotes.map((q) =>
          api.get(`/payments?quote_id=${q.id}`).catch(() => [])
        );
        const paymentArrays = await Promise.all(paymentPromises);
        allPaymentsResolved = paymentArrays.flat();
      }

      const { default: pdfMake } = await import("pdfmake/build/pdfmake");
      const { default: pdfFonts } = await import("pdfmake/build/vfs_fonts");
      pdfMake.vfs = pdfFonts.vfs;

      const totalQuoted = allQuotes.reduce((s, q) => s + Number(q.total), 0);
      const totalPaid = allPaymentsResolved.reduce((s, p) => s + Number(p.amount), 0);
      const completedChecklist = checklist.filter((c) => c.is_completed).length;
      const completedAgendaCount = agenda.filter((a) => a.is_completed).length;
      const hiredSuppliersCount = suppliers.filter((s) => s.contract_status === "contratado").length;

      const fm = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const docDefinition = {
        pageSize: "A4",
        pageMargins: [40, 50, 40, 50],
        content: [
          { text: "REPORTE DEL EVENTO", fontSize: 22, bold: true, color: "#0F172A" },
          { text: event.name, fontSize: 14, color: "#64748B", margin: [0, 4, 0, 2] },
          { text: `${new Date(event.date).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`, fontSize: 10, color: "#94A3B8", margin: [0, 0, 0, 2] },
          event.venue ? { text: event.venue, fontSize: 10, color: "#94A3B8", margin: [0, 0, 0, 14] } : { margin: [0, 0, 0, 14] },
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#E2E8F0" }], margin: [0, 0, 0, 14] },

          { text: "Resumen", fontSize: 14, bold: true, color: "#0F172A", margin: [0, 0, 0, 8] },
          { text: `Presupuesto total: ${fm(event.total_budget)}`, fontSize: 10, margin: [0, 0, 0, 2] },
          { text: `Total cotizado: ${fm(totalQuoted)}`, fontSize: 10, margin: [0, 0, 0, 2] },
          { text: `Total pagado: ${fm(totalPaid)}`, fontSize: 10, margin: [0, 0, 0, 2] },
          { text: `Saldo pendiente: ${fm(totalQuoted - totalPaid)}`, fontSize: 10, margin: [0, 0, 0, 14], color: totalQuoted - totalPaid > 0 ? "#D97706" : "#16A34A" },

          { text: "Avance", fontSize: 14, bold: true, color: "#0F172A", margin: [0, 0, 0, 8] },
          { text: `Agenda: ${completedAgendaCount}/${agenda.length} completados`, fontSize: 10, margin: [0, 0, 0, 2] },
          { text: `Checklist: ${completedChecklist}/${checklist.length} completados`, fontSize: 10, margin: [0, 0, 0, 2] },
          { text: `Proveedores: ${hiredSuppliersCount}/${suppliers.length} contratados`, fontSize: 10, margin: [0, 0, 0, 14] },

          agenda.length > 0 ? { text: "Agenda", fontSize: 14, bold: true, color: "#0F172A", margin: [0, 0, 0, 6] } : null,
          agenda.length > 0 ? {
            ul: agenda.map((a) => ({ text: `${a.title}${a.is_completed ? " ✓" : ""}`, fontSize: 9, margin: [0, 1, 0, 1] })),
            margin: [0, 0, 0, 10],
          } : null,

          company?.company_name ? { text: `Generado por ${company.company_name}`, fontSize: 8, color: "#94A3B8", margin: [0, 20, 0, 0] } : null,
        ].filter(Boolean),
        defaultStyle: { fontSize: 10, color: "#334155" },
      };

      pdfMake.createPdf(docDefinition).download(`Reporte_${event.name.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("Report error:", err);
      toast("Error al generar reporte", "error");
    } finally {
      setGeneratingReport(false);
    }
  }

  if (loading) return <p className="text-slate-400 p-6">Cargando...</p>;
  if (!event) return <p className="text-red-500 p-6">Evento no encontrado</p>;

  const completedAgenda = agenda.filter((a) => a.is_completed).length;
  const hiredSuppliers = suppliers.filter((s) => s.contract_status === "contratado").length;
  const budgetUsed = suppliers.reduce((sum, s) => sum + Number(s.budget_amount || 0), 0);
  const acceptedQuote = quotes.find((q) => q.status === "aceptado");
  const assignedTotal = acceptedQuote ? Number(acceptedQuote.total) : budgetUsed;
  const budgetPct = event.total_budget > 0
    ? Math.min(100, Math.round((assignedTotal / event.total_budget) * 100))
    : 0;

  const allTabs = [
    { id: "overview", label: "Resumen" },
    { id: "agenda", label: `Agenda (${agenda.length})` },
    { id: "checklist", label: `Checklist (${checklist.filter((c) => c.is_completed).length}/${checklist.length})` },
    { id: "suppliers", label: `Proveedores (${suppliers.length})` },
    { id: "quotes", label: `Cotizaciones (${quotes.length})`, adminOnly: true },
    { id: "inventory", label: "Inventario" },
  ];
  const tabs = allTabs.filter((t) => !t.adminOnly || user?.role === "administrador");

  return (
    <div>
      <Link to="/events" className="text-sm text-vento-cyan hover:underline mb-4 inline-block">&larr; Volver a eventos</Link>

      {/* Header */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{event.name}</h1>
              <p className="text-slate-500 text-sm mt-1">{fmtDateTime(event.date)}</p>
              {event.venue && <p className="text-slate-500 text-sm mt-0.5">📍 {event.venue}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {user?.role === "administrador" && (
                <button onClick={() => {
                  setEditForm({
                    name: event.name,
                    date: event.date?.slice(0, 16) || "",
                    venue: event.venue || "",
                    description: event.description || "",
                    total_budget: event.total_budget?.toString() || "",
                    status: event.status || "borrador",
                  });
                  setShowEditForm(true);
                }}
                  className="text-[11px] px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  Editar
                </button>
              )}
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                event.status === "activo" ? "bg-green-100 text-green-700" :
                event.status === "borrador" ? "bg-slate-100 text-slate-600" :
                event.status === "completado" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
              }`}>{event.status === "borrador" ? "Borrador" : event.status === "activo" ? "Activo" : event.status === "completado" ? "Completado" : "Cancelado"}</span>
            </div>
          </div>
        {user?.role === "administrador" && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">Acceso cliente:</span>
              {clientAccess && clientAccess.is_active ? (
                <>
                  <span className="text-xs text-green-600 font-medium">Activo</span>
                  <span className="text-xs text-slate-400">Expira: {new Date(clientAccess.expires_at).toLocaleDateString("es-MX")}</span>
                  <button onClick={() => setShowClientCreds(showClientCreds ? null : clientAccess)}
                    className="text-[11px] px-2 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                    {showClientCreds ? "Ocultar" : "Ver credenciales"}
                  </button>
                  <button onClick={revokeAccess}
                    className="text-[11px] px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
                    Revocar
                  </button>
                  <button onClick={resetPassword}
                    className="text-[11px] px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition">
                    Reset pass
                  </button>
                </>
              ) : (
                <button onClick={generateAccess} disabled={generating}
                  className="text-[11px] px-2 py-1 bg-vento-cyan text-vento-navy rounded-lg font-medium hover:bg-cyan-400 transition disabled:opacity-50">
                  {generating ? "Generando..." : "Generar acceso"}
                </button>
              )}
            </div>
            {showClientCreds && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs space-y-1">
                <p><span className="font-medium">Usuario:</span> {showClientCreds.username || clientAccess?.username}</p>
                <p><span className="font-medium">Contraseña:</span> {showClientCreds.password || "Confidencial"}</p>
                <p className="text-yellow-700">Comparte estas credenciales con el cliente. Expiran automáticamente.</p>
              </div>
            )}
            <div className="mt-2 flex">
              <button onClick={generateReport} disabled={generatingReport}
                className="text-[11px] px-2 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 transition disabled:opacity-50">
                {generatingReport ? "Generando..." : "📄 Reporte final"}
              </button>
            </div>
          </div>
        )}
        {event.description && <p className="text-slate-600 text-sm mt-3">{event.description}</p>}
        <div className="flex gap-6 mt-4 text-sm">
          <div>
            <span className="text-slate-400">Presupuesto:</span>
            <span className="ml-1 font-semibold">{user?.role === "administrador" ? `$${Number(event.total_budget).toLocaleString()}` : "—"}</span>
          </div>
          <div>
            <span className="text-slate-400">Asignado:</span>
            <span className="ml-1 font-semibold">{user?.role === "administrador" ? `$${assignedTotal.toLocaleString()}` : "—"}</span>
          </div>
          <div>
            <span className="text-slate-400">Uso:</span>
            <span className={`ml-1 font-semibold ${budgetPct > 80 ? "text-red-500" : "text-green-600"}`}>{budgetPct}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.id
                ? "border-vento-cyan text-vento-cyan"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <p className="text-sm text-slate-500">Agenda</p>
            <p className="text-3xl font-bold text-vento-navy mt-1">{completedAgenda}/{agenda.length}</p>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-vento-cyan rounded-full" style={{ width: `${agenda.length ? (completedAgenda / agenda.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <p className="text-sm text-slate-500">Proveedores</p>
            <p className="text-3xl font-bold text-vento-navy mt-1">{hiredSuppliers}/{suppliers.length}</p>
            <p className="text-xs text-slate-400 mt-1">contratados</p>
          </div>
          {user?.role === "administrador" && (
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <p className="text-sm text-slate-500">Cotizaciones</p>
            <p className="text-3xl font-bold text-vento-navy mt-1">{quotes.length}</p>
            <p className="text-xs text-slate-400 mt-1">
              {quotes.filter((q) => q.status === "aceptado").length} aceptadas
            </p>
          </div>
          )}
        </div>
      )}

      {tab === "agenda" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{completedAgenda}/{agenda.length} completados</p>
            {user?.role === "administrador" && (
              <Link to={`/events/${id}/agenda`}
                className="text-xs px-3 py-1.5 bg-vento-cyan text-vento-navy rounded-lg font-medium">
                Gestionar
              </Link>
            )}
          </div>
          <div className="space-y-1.5">
            {agenda.slice(0, 8).map((item) => (
              <div key={item.id} className={`flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border text-sm ${
                item.is_completed ? "border-green-200 bg-green-50/50" : "border-slate-200"
              }`}>
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  item.is_completed ? "bg-green-500 border-green-500" : "border-slate-300"
                }`}>
                  {item.is_completed && <span className="text-white text-[8px]">✓</span>}
                </span>
                <span className={item.is_completed ? "line-through text-slate-400 flex-1" : "flex-1"}>{item.title}</span>
                <span className="text-xs text-slate-400">{fmtTime(item.start_time)}</span>
              </div>
            ))}
            {agenda.length > 8 && (
              <Link to={`/events/${id}/agenda`}
                className="block text-center text-sm text-vento-cyan hover:underline py-2">
                Ver las {agenda.length} tareas →
              </Link>
            )}
            {agenda.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin tareas en la agenda</p>
            )}
          </div>
        </div>
      )}

      {tab === "checklist" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{checklist.filter((c) => c.is_completed).length}/{checklist.length} completados</p>
          </div>
          {user?.role === "administrador" && (
            <form onSubmit={async (e) => { e.preventDefault(); if (!newCheckItem.trim()) return; try { const res = await api.post("/checklist", { event_id: id, title: newCheckItem }); setChecklist([...checklist, res]); setNewCheckItem(""); } catch {} }}
              className="flex gap-2 mb-4">
              <input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" placeholder="Agregar tarea..." />
              <button type="submit" className="px-3 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium">Agregar</button>
            </form>
          )}
          <div className="space-y-1.5">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border text-sm">
                <button onClick={async () => {
                  const res = await api.patch(`/checklist/${item.id}`, { is_completed: !item.is_completed });
                  setChecklist(checklist.map((c) => c.id === item.id ? res : c));
                }}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                    item.is_completed ? "bg-green-500 border-green-500" : "border-slate-300 hover:border-vento-cyan"
                  }`}>
                  {item.is_completed && <span className="text-white text-[10px]">✓</span>}
                </button>
                <span className={item.is_completed ? "line-through text-slate-400 flex-1" : "flex-1"}>{item.title}</span>
                {user?.role === "administrador" && (
                  <button onClick={async () => { await api.delete(`/checklist/${item.id}`); setChecklist(checklist.filter((c) => c.id !== item.id)); }}
                    className="text-red-400 hover:text-red-600 text-xs p-1">✕</button>
                )}
              </div>
            ))}
            {checklist.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin tareas en el checklist</p>
            )}
          </div>
        </div>
      )}

      {tab === "suppliers" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{hiredSuppliers} contratados de {suppliers.length}</p>
            {user?.role === "administrador" && (
              <Link to={`/events/${id}/suppliers`}
                className="text-xs px-3 py-1.5 bg-vento-cyan text-vento-navy rounded-lg font-medium">
                Gestionar
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-white rounded-lg px-4 py-3 border border-slate-200 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    s.contract_status === "contratado" ? "bg-green-100 text-green-700" :
                    s.contract_status === "contactado" ? "bg-yellow-100 text-yellow-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>{s.contract_status}</span>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-slate-400">
                  <span className="capitalize">{s.category}</span>
                  {s.budget_amount > 0 && user?.role === "administrador" && <span>${Number(s.budget_amount).toLocaleString()}</span>}
                  {s.actual_arrival_time && <span className="text-green-600">✓ llegó</span>}
                </div>
              </div>
            ))}
            {suppliers.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin proveedores</p>
            )}
          </div>
        </div>
      )}

      {/* Modal editar evento */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowEditForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => {
            e.preventDefault();
            setEditSaving(true);
            try {
              const payload = { ...editForm, total_budget: editForm.total_budget ? Number(editForm.total_budget) : 0, status: editForm.status };
              const updated = await api.put(`/events/${id}`, payload);
              setEvent(updated);
              setShowEditForm(false);
              toast("Evento actualizado");
            } catch (err) {
              toast(err.message, "error");
            } finally {
              setEditSaving(false);
            }
          }}
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl animate-slide-up space-y-4">
            <h2 className="text-lg font-bold">Editar evento</h2>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Nombre *</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Fecha *</label>
                <input type="datetime-local" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Presupuesto</label>
                <input type="number" value={editForm.total_budget} onChange={(e) => setEditForm({ ...editForm, total_budget: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-500 block mb-1">Lugar</label>
                <input value={editForm.venue} onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" />
              </div>
              <div>
                <label className="text-sm text-slate-500 block mb-1">Estado</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan bg-white">
                  <option value="borrador">Borrador</option>
                  <option value="activo">Activo</option>
                  <option value="completado">Completado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-1">Descripción</label>
              <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" rows="2" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={editSaving}
                className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium hover:bg-cyan-400 transition disabled:opacity-50">
                {editSaving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button type="button" onClick={() => setShowEditForm(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === "inventory" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">Inventario para montaje</p>
          </div>
          {loadingInventory ? (
            <p className="text-sm text-slate-400">Calculando inventario...</p>
          ) : inventory.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <p className="text-slate-400 mb-2">No hay cotización aceptada</p>
              <p className="text-xs text-slate-300">Acepta una cotización para generar el inventario</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inventory.map((item, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.needs_return && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Regresa</span>}
                      <h3 className="font-semibold text-sm">{item.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-vento-cyan/10 text-vento-cyan px-2 py-0.5 rounded-full font-medium">{item.quantity} pz</span>
                      {item.llevado > 0 && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{item.llevado} en montaje</span>
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex gap-2 flex-wrap">
                    <button onClick={async () => { try { await api.post(`/events/${id}/inventory-movement`, { item_name: item.name, quantity: item.quantity - item.llevado, movement_type: 'llevado' }); const res = await api.get(`/events/${id}/inventory`); setInventory(res); } catch (e) { alert(e.message); } }}
                      disabled={item.llevado >= item.quantity}
                      className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      Llevar a montaje
                    </button>
                    <button onClick={async () => { try { await api.post(`/events/${id}/inventory-movement`, { item_name: item.name, quantity: item.llevado, movement_type: 'regresado' }); const res = await api.get(`/events/${id}/inventory`); setInventory(res); } catch (e) { alert(e.message); } }}
                      disabled={item.llevado <= 0}
                      className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      Regresar
                    </button>
                    {item.quote_item_id && editingInvItem === item.quote_item_id ? (
                      <div className="flex items-center gap-1">
                        <input type="number" value={invEditQty} min="0" onChange={(e) => setInvEditQty(Number(e.target.value))}
                          className="w-16 px-2 py-1 border border-slate-200 rounded text-xs" />
                        <button onClick={async () => { try { await api.put(`/quote-items/${item.quote_item_id}`, { quantity: invEditQty }); setEditingInvItem(null); const res = await api.get(`/events/${id}/inventory`); setInventory(res); toast("Cantidad actualizada"); } catch (e) { toast(e.message, "error"); } }}
                          className="text-xs px-2 py-1 bg-vento-cyan text-vento-navy rounded">OK</button>
                        <button onClick={() => setEditingInvItem(null)} className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600">✕</button>
                      </div>
                    ) : (
                      <>
                        {user?.role === "administrador" && (
                          <button onClick={() => { setEditingInvItem(item.quote_item_id); setInvEditQty(item.quantity); }}
                            className="text-xs px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition">
                            Editar
                          </button>
                        )}
                        {user?.role === "administrador" && (
                          <button onClick={async () => { if (!confirm(`Eliminar "${item.name}" del inventario?`)) return; try { await api.delete(`/quote-items/${item.quote_item_id}`); const res = await api.get(`/events/${id}/inventory`); setInventory(res); toast("Producto eliminado"); } catch (e) { toast(e.message, "error"); } }}
                            className="text-xs px-3 py-1.5 bg-white border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition">
                            Eliminar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "quotes" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{quotes.length} cotizaciones</p>
            {user?.role === "administrador" && (
              <Link to={`/events/${id}/quotes`}
                className="text-xs px-3 py-1.5 bg-vento-cyan text-vento-navy rounded-lg font-medium">
                Gestionar
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {quotes.map((q) => (
              <div key={q.id} className="bg-white rounded-lg px-4 py-3 border border-slate-200 text-sm flex items-center justify-between">
                <div>
                  <span className="font-medium">{q.client_name || "Sin cliente"}</span>
                  <span className="text-slate-400 ml-2">${Number(q.total).toLocaleString()}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  q.status === "aceptado" ? "bg-green-100 text-green-700" :
                  q.status === "enviado" ? "bg-blue-100 text-blue-700" :
                  q.status === "rechazado" ? "bg-red-100 text-red-700" :
                  "bg-slate-100 text-slate-600"
                }`}>{q.status}</span>
              </div>
            ))}
            {quotes.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin cotizaciones</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
